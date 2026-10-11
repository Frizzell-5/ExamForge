import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as store from './lib/store.js';
import { extract, estimateTokens, SUPPORTED } from './lib/ingest.js';
import { startGeneration, getJob, listJobs, subscribe } from './lib/pipeline.js';
import { gradeAttempt } from './lib/grader.js';
import { catalog } from './lib/catalog.js';
import { DEFAULT_MODELS, SUBSCRIPTION_MODELS, models, backend, runModel } from './lib/llm.js';
import { cliVersion, findClaude } from './lib/cli.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4317;
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 150 * 1024 * 1024, files: 40 } });

await store.init();
app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(here, 'public')));

const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((err) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || String(err) });
});
const notFound = (what) => Object.assign(new Error(`${what} not found`), { status: 404 });

// ---- meta ------------------------------------------------------------------
app.get('/api/catalog', (req, res) => res.json({ ...catalog(), supported: SUPPORTED }));

app.get('/api/settings', wrap(async (req, res) => {
  const cfg = await store.getConfig();
  res.json({
    hasStoredKey: !!cfg.apiKey,
    storedKeyHint: cfg.apiKey ? `…${cfg.apiKey.slice(-4)}` : '',
    hasEnvKey: !!process.env.ANTHROPIC_API_KEY || !!process.env.ANTHROPIC_AUTH_TOKEN,
    models: await models(),
    defaults: (await backend()) === 'subscription' ? SUBSCRIPTION_MODELS : DEFAULT_MODELS,
    backend: await backend(),
    claudePath: await findClaude(),
    cliVersion: await cliVersion(),
    concurrency: cfg.concurrency || 4,
  });
}));

app.post('/api/settings', wrap(async (req, res) => {
  const patch = {};
  if (typeof req.body.apiKey === 'string') patch.apiKey = req.body.apiKey.trim();
  if (typeof req.body.thinkerModel === 'string') patch.thinkerModel = req.body.thinkerModel.trim();
  if (typeof req.body.builderModel === 'string') patch.builderModel = req.body.builderModel.trim();
  if (req.body.backend === 'api' || req.body.backend === 'subscription') {
    const prev = await backend();
    patch.backend = req.body.backend;
    // Model choices differ per backend (Fable needs credits on a plan), so reset them on a switch.
    if (prev !== req.body.backend) { patch.thinkerModel = ''; patch.builderModel = ''; }
  }
  if (typeof req.body.claudePath === 'string') patch.claudePath = req.body.claudePath.trim();
  if (req.body.concurrency) patch.concurrency = Math.max(1, Math.min(8, Number(req.body.concurrency)));
  await store.setConfig(patch);
  res.json({ ok: true });
}));

app.post('/api/test-connection', wrap(async (req, res) => {
  const { builder } = await models();
  const t0 = Date.now();
  const out = await runModel({
    model: builder, effort: 'low', maxTokens: 2000, system: 'Reply with the requested JSON only.',
    messages: [{ role: 'user', content: 'Return {"ok": true}.' }],
    schema: { type: 'object', additionalProperties: false, required: ['ok'], properties: { ok: { type: 'boolean' } } },
  });
  res.json({ ok: out.ok === true, backend: await backend(), model: builder, ms: Date.now() - t0 });
}));

// ---- library ---------------------------------------------------------------
const publicMaterial = (m) => ({ ...m, tokens: estimateTokens(m.chars || 0) });

app.get('/api/materials', wrap(async (req, res) => res.json((await store.listMaterials()).map(publicMaterial))));

app.post('/api/materials', upload.array('files'), wrap(async (req, res) => {
  const role = req.body.role === 'exam' ? 'exam' : 'material';
  const results = [];
  for (const f of req.files || []) {
    const name = Buffer.from(f.originalname, 'latin1').toString('utf8');
    try {
      const ex = await extract(f.buffer, name);
      if (!ex.text && !ex.native) throw new Error('No readable text found in this file.');
      const meta = {
        id: store.newId('src'), name, role, kind: ex.kind, chars: ex.text.length, pages: ex.pages || null,
        bytes: f.size, native: ex.native || null, createdAt: Date.now(), preview: ex.text.slice(0, 400),
      };
      await store.saveMaterial(meta, ex.text, ex.native ? f.buffer : null);
      results.push({ ok: true, material: publicMaterial(meta) });
    } catch (err) {
      results.push({ ok: false, name, error: err.message });
    }
  }
  res.json(results);
}));

app.post('/api/materials/text', wrap(async (req, res) => {
  const text = String(req.body.text || '').trim();
  if (!text) throw Object.assign(new Error('Paste some text first.'), { status: 400 });
  const meta = {
    id: store.newId('src'), name: String(req.body.name || 'Pasted text').slice(0, 200), role: req.body.role === 'exam' ? 'exam' : 'material',
    kind: req.body.kind === 'transcript' ? 'transcript' : 'text', chars: text.length, bytes: text.length, native: null,
    createdAt: Date.now(), preview: text.slice(0, 400),
  };
  await store.saveMaterial(meta, text, null);
  res.json(publicMaterial(meta));
}));

app.patch('/api/materials/:id', wrap(async (req, res) => {
  const patch = {};
  if (req.body.role) patch.role = req.body.role === 'exam' ? 'exam' : 'material';
  if (req.body.name) patch.name = String(req.body.name).slice(0, 200);
  const meta = await store.updateMaterialMeta(req.params.id, patch);
  if (!meta) throw notFound('Source');
  res.json(publicMaterial(meta));
}));

app.get('/api/materials/:id/text', wrap(async (req, res) => {
  const meta = await store.getMaterialMeta(req.params.id);
  if (!meta) throw notFound('Source');
  res.json({ ...meta, text: await store.getMaterialText(req.params.id) });
}));

app.delete('/api/materials/:id', wrap(async (req, res) => { await store.deleteMaterial(req.params.id); res.json({ ok: true }); }));

// ---- generation ------------------------------------------------------------
app.post('/api/generate', wrap(async (req, res) => {
  const job = startGeneration(req.body || {});
  res.json({ jobId: job.id });
}));

app.get('/api/jobs', (req, res) => res.json(listJobs()));

app.get('/api/jobs/:id/events', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).end();
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const send = (ev) => res.write(`data: ${JSON.stringify(ev)}\n\n`);
  const unsubscribe = subscribe(job, send, Number(req.query.from) || 0);
  const ping = setInterval(() => res.write(': ping\n\n'), 15000);
  req.on('close', () => { clearInterval(ping); unsubscribe(); });
});

// ---- exams & attempts ------------------------------------------------------
app.get('/api/exams', wrap(async (req, res) => {
  const [exams, attempts] = await Promise.all([store.listExams(), store.listAttempts()]);
  res.json(exams.map((e) => {
    const mine = attempts.filter((a) => a.examId === e.id);
    return {
      id: e.id, title: e.title, createdAt: e.createdAt, count: e.questions.length, config: e.config, models: e.models,
      costUsd: e.usage?.costUsd || 0, subscription: !!e.usage?.subscription, attempts: mine.length, best: mine.length ? Math.max(...mine.map((a) => a.pct)) : null,
      last: mine[0] ? { id: mine[0].id, pct: mine[0].pct } : null,
    };
  }));
}));

app.get('/api/exams/:id', wrap(async (req, res) => {
  const exam = await store.getExam(req.params.id);
  if (!exam) throw notFound('Exam');
  res.json(exam);
}));

app.delete('/api/exams/:id', wrap(async (req, res) => { await store.deleteExam(req.params.id); res.json({ ok: true }); }));

app.post('/api/exams/:id/attempts', wrap(async (req, res) => {
  const exam = await store.getExam(req.params.id);
  if (!exam) throw notFound('Exam');
  const answers = req.body.answers || {};
  const graded = await gradeAttempt(exam, answers);
  const attempt = {
    id: store.newId('att'), examId: exam.id, examTitle: exam.title, createdAt: Date.now(),
    startedAt: req.body.startedAt || null, timeUsedSec: req.body.timeUsedSec || null, flagged: req.body.flagged || [],
    answers, ...graded,
  };
  await store.saveAttempt(attempt);
  res.json(attempt);
}));

app.post('/api/exams/:id/check', wrap(async (req, res) => {
  // Tutor mode: grade a single answer immediately.
  const exam = await store.getExam(req.params.id);
  if (!exam) throw notFound('Exam');
  const q = exam.questions.find((x) => x.id === req.body.qid);
  if (!q) throw notFound('Question');
  const graded = await gradeAttempt({ ...exam, questions: [q] }, { [q.id]: req.body.answer });
  res.json(graded.results[q.id]);
}));

app.get('/api/attempts', wrap(async (req, res) => {
  const all = await store.listAttempts();
  res.json(all.filter((a) => !req.query.examId || a.examId === req.query.examId)
    .map(({ id, examId, examTitle, createdAt, pct, earned, total, timeUsedSec }) => ({ id, examId, examTitle, createdAt, pct, earned, total, timeUsedSec })));
}));

app.get('/api/attempts/:id', wrap(async (req, res) => {
  const attempt = await store.getAttempt(req.params.id);
  if (!attempt) throw notFound('Attempt');
  res.json(attempt);
}));

// Adaptive follow-up exam built from what this attempt got wrong.
app.post('/api/attempts/:id/remediate', wrap(async (req, res) => {
  const attempt = await store.getAttempt(req.params.id);
  if (!attempt) throw notFound('Attempt');
  const exam = await store.getExam(attempt.examId);
  if (!exam) throw notFound('Exam');
  const missed = exam.questions.filter((q) => (attempt.results[q.id]?.score ?? 0) < 1);
  if (!missed.length) throw Object.assign(new Error('Nothing missed — try "Forge a harder version" instead.'), { status: 400 });
  const describe = (q) => {
    const a = attempt.answers[q.id];
    let picked = '';
    if ((q.type === 'mcq' || q.type === 'true_false') && a !== undefined && q.options[a]) picked = `student chose "${q.options[a].text}"`;
    else if (a !== undefined && a !== '') picked = `student answered ${JSON.stringify(a).slice(0, 300)}`;
    else picked = 'left blank';
    return `- [${q.concept}] ${q.stem.slice(0, 300)} — ${picked}. Trap: ${q.trap}`;
  };
  const concepts = [...new Set(missed.map((q) => q.concept))];
  const cfg = {
    ...exam.config,
    title: `Remediation · ${exam.title}`.slice(0, 200),
    count: Math.min(40, Math.max(10, missed.length * 2)),
    focus: concepts.join('; '),
    notes: `${exam.config.notes ? `${exam.config.notes}\n\n` : ''}This is an adaptive remediation exam. The student just missed these questions:\n${missed.map(describe).join('\n')}\n\nTarget the same concepts and the same misconceptions from new angles, so the student must prove they've fixed the underlying misunderstanding (not just memorised the old answer). Mix in a few questions on adjacent concepts.`,
    parentAttemptId: attempt.id,
  };
  const job = startGeneration(cfg);
  res.json({ jobId: job.id });
}));

app.post('/api/exams/:id/variant', wrap(async (req, res) => {
  const exam = await store.getExam(req.params.id);
  if (!exam) throw notFound('Exam');
  const ladder = ['foundational', 'intermediate', 'advanced', 'graduate', 'qualifying'];
  const harder = req.body.harder !== false;
  const i = ladder.indexOf(exam.config.difficulty);
  const cfg = {
    ...exam.config,
    title: `${harder ? 'Harder' : 'Fresh'} · ${exam.title}`.slice(0, 200),
    difficulty: harder && i >= 0 ? ladder[Math.min(ladder.length - 1, i + 1)] : exam.config.difficulty,
    deception: harder ? Math.min(5, exam.config.deception + 1) : exam.config.deception,
    notes: `${exam.config.notes || ''}\n\nWrite entirely new questions; do not repeat these existing ones:\n${exam.questions.map((q) => `- ${q.stem.slice(0, 160)}`).join('\n')}`.trim(),
  };
  res.json({ jobId: startGeneration(cfg).id });
}));

app.get('*', (req, res) => res.sendFile(path.join(here, 'public', 'index.html')));

app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  ⚡ ExamForge running at http://localhost:${PORT}\n`);
});
