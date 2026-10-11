// The generation workflow:
//   ingest -> architect (Fable 5.1) -> forge (Opus 5.5, parallel batches) -> red team (Fable 5.1) -> calibrate -> finalize
// Every step emits events that the browser renders live over SSE.
import * as store from './store.js';
import { runModel, newUsage, models } from './llm.js';
import { estimateTokens } from './ingest.js';
import {
  ARCHITECT_SYSTEM, FORGE_SYSTEM, REDTEAM_SYSTEM, BLUEPRINT_SCHEMA, BATCH_SCHEMA, REVIEW_SCHEMA,
  architectTask, forgeContext, forgeTask, redteamTask, typeCounts,
} from './prompts.js';

export const STAGES = ['ingest', 'architect', 'forge', 'redteam', 'calibrate', 'finalize'];
const jobs = new Map();
const MAX_SOURCE_CHARS = 3_000_000; // ~790k tokens, leaves room inside the 1M context
const MAX_NATIVE_BYTES = 28 * 1024 * 1024;
const BATCH_SIZE = 5;
const REVIEW_CHUNK = 20;

export const getJob = (id) => jobs.get(id);
export const listJobs = () => [...jobs.values()].map(publicJob);
const publicJob = (j) => ({ id: j.id, title: j.title, status: j.status, examId: j.examId, startedAt: j.startedAt, error: j.error });

function emit(job, type, data = {}) {
  const ev = { seq: job.events.length, t: Date.now() - job.startedAt, type, ...data };
  job.events.push(ev);
  for (const fn of job.listeners) fn(ev);
}

export function subscribe(job, fn, fromSeq = 0) {
  for (const ev of job.events.slice(fromSeq)) fn(ev);
  job.listeners.add(fn);
  return () => job.listeners.delete(fn);
}

function thinkingSink(job, stage, lane) {
  let buf = '';
  let timer = null;
  const flush = () => { timer = null; if (buf) { emit(job, 'thinking', { stage, lane, text: buf }); buf = ''; } };
  const fn = (text) => { buf += text; if (!timer) timer = setTimeout(flush, 350); };
  fn.flush = () => { clearTimeout(timer); flush(); };
  return fn;
}

async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; results[i] = await worker(items[i], i); }
  }));
  return results;
}

const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

// Builds the shared, cacheable prefix: every source document, then the reference exams.
async function buildSources(cfg) {
  const blocks = [];
  let chars = 0, nativeBytes = 0;
  const describe = [];
  const section = async (ids, tag) => {
    const parts = [];
    for (const [i, id] of ids.entries()) {
      const meta = await store.getMaterialMeta(id);
      if (!meta) continue;
      const label = `${tag === 'reference_exams' ? 'R' : 'S'}${i + 1}`;
      const text = await store.getMaterialText(id);
      if (meta.native) {
        const blob = await store.getMaterialBlob(id);
        if (blob) {
          nativeBytes += blob.length;
          const source = { type: 'base64', media_type: meta.native.mediaType, data: blob.toString('base64') };
          blocks.push({ type: 'text', text: `[${label}] ${meta.name} (${tag === 'reference_exams' ? 'reference exam' : 'course material'}, shown as ${meta.kind === 'image' ? 'an image' : 'a document'}):` });
          blocks.push(meta.kind === 'image' ? { type: 'image', source } : { type: 'document', source, title: meta.name });
        }
      }
      if (text) {
        chars += text.length;
        parts.push(`<source id="${label}" name="${meta.name.replace(/"/g, "'")}" kind="${meta.kind}">\n${text}\n</source>`);
      }
      describe.push({ id, label, name: meta.name, kind: meta.kind, chars: text.length, native: !!meta.native, role: tag });
    }
    if (parts.length) blocks.push({ type: 'text', text: `<${tag}>\n${parts.join('\n\n')}\n</${tag}>` });
  };
  await section(cfg.materialIds, 'materials');
  await section(cfg.referenceIds, 'reference_exams');
  if (!blocks.length) throw new Error('Select at least one source with readable content.');
  if (chars > MAX_SOURCE_CHARS) throw new Error(`Selected sources total ~${estimateTokens(chars).toLocaleString()} tokens, more than fits in one exam run. Deselect some sources.`);
  if (nativeBytes > MAX_NATIVE_BYTES) throw new Error('Scanned PDFs/images selected exceed 28 MB in total. Deselect some or upload text-based versions.');
  blocks[blocks.length - 1] = { ...blocks[blocks.length - 1], cache_control: { type: 'ephemeral' } };
  return { blocks, chars, describe };
}

function normaliseConfig(raw) {
  const cfg = {
    title: String(raw.title || '').slice(0, 200),
    materialIds: Array.isArray(raw.materialIds) ? raw.materialIds : [],
    referenceIds: Array.isArray(raw.referenceIds) ? raw.referenceIds : [],
    count: Math.max(1, Math.min(200, Number(raw.count) || 20)),
    difficulty: raw.difficulty || 'graduate',
    types: raw.types && typeof raw.types === 'object' ? raw.types : { mcq: 1 },
    styles: Array.isArray(raw.styles) && raw.styles.length ? raw.styles : ['best_answer'],
    optionsCount: Math.max(3, Math.min(6, Number(raw.optionsCount) || 4)),
    deception: Math.max(1, Math.min(5, Number(raw.deception) || 3)),
    timeLimit: Math.max(0, Number(raw.timeLimit) || 0),
    focus: String(raw.focus || '').slice(0, 4000),
    notes: String(raw.notes || '').slice(0, 8000),
    adaptMode: raw.adaptMode || 'blend',
    redTeam: raw.redTeam !== false,
    mode: raw.mode === 'tutor' ? 'tutor' : 'exam',
    parentAttemptId: raw.parentAttemptId || null,
  };
  return cfg;
}

export function startGeneration(rawCfg) {
  const cfg = normaliseConfig(rawCfg);
  const job = { id: store.newId('job'), title: cfg.title || 'New exam', status: 'running', events: [], listeners: new Set(), startedAt: Date.now(), usage: newUsage(), cfg };
  jobs.set(job.id, job);
  run(job).catch((err) => {
    job.status = 'error';
    job.error = err.message || String(err);
    emit(job, 'error', { message: job.error });
  });
  return job;
}

async function run(job) {
  const { cfg, usage } = job;
  const { thinker, builder } = await models();
  const stage = (name, status, detail = '') => emit(job, 'stage', { stage: name, status, detail });
  const log = (stageName, text, level = 'info') => emit(job, 'log', { stage: stageName, text, level });
  const pushUsage = () => emit(job, 'usage', { usage });
  emit(job, 'init', { config: cfg, models: { thinker, builder }, stages: STAGES });

  // 1. Ingest -------------------------------------------------------------
  stage('ingest', 'active', 'Loading sources');
  const src = await buildSources(cfg);
  for (const d of src.describe) log('ingest', `${d.label} · ${d.name} — ${d.native ? 'visual + ' : ''}${d.chars.toLocaleString()} chars${d.role === 'reference_exams' ? ' · reference exam' : ''}`);
  const hasRefs = src.describe.some((d) => d.role === 'reference_exams');
  stage('ingest', 'done', `${src.describe.length} sources · ~${estimateTokens(src.chars).toLocaleString()} tokens`);

  // 2. Architect (thinker) ------------------------------------------------
  const counts = typeCounts(cfg.count, cfg.types);
  stage('architect', 'active', `${thinker} is designing the blueprint`);
  const archThink = thinkingSink(job, 'architect', 'main');
  let blueprint = await runModel({
    model: thinker,
    effort: ['graduate', 'qualifying'].includes(cfg.difficulty) ? 'xhigh' : 'high',
    system: ARCHITECT_SYSTEM,
    messages: [{ role: 'user', content: [...src.blocks, { type: 'text', text: architectTask(cfg, counts, hasRefs) }] }],
    schema: BLUEPRINT_SCHEMA,
    usage,
    onThinking: archThink,
    onNotice: (m) => log('architect', m, 'warn'),
  });
  archThink.flush();
  pushUsage();

  let specs = (blueprint.specs || []).slice(0, cfg.count);
  if (!specs.length) throw new Error('The architect returned an empty blueprint.');
  while (specs.length < cfg.count) specs.push({ ...specs[specs.length % Math.max(1, blueprint.specs.length)], angle: 'Test a different facet of this concept than the other questions.' });
  specs = specs.map((s, i) => ({ ...s, n: i + 1 }));
  blueprint = { ...blueprint, specs };
  job.title = cfg.title || blueprint.title;
  emit(job, 'blueprint', {
    title: blueprint.title, overview: blueprint.overview, styleProfile: blueprint.style_profile,
    concepts: blueprint.concepts, misconceptions: blueprint.misconceptions,
    specs: specs.map((s) => ({ n: s.n, type: s.type, style: s.style, concept: s.concept, difficulty: s.difficulty })),
  });
  stage('architect', 'done', `${blueprint.concepts.length} concepts · ${blueprint.misconceptions.length} traps · ${specs.length} specs`);

  // 3. Forge (builder, parallel batches sharing a cached prefix) ----------
  const batches = [];
  for (let i = 0; i < specs.length; i += BATCH_SIZE) batches.push(specs.slice(i, i + BATCH_SIZE));
  stage('forge', 'active', `${builder} writing ${specs.length} questions in ${batches.length} parallel batches`);
  emit(job, 'batches', { batches: batches.map((b, i) => ({ index: i, specs: b.map((s) => s.n) })) });
  const prefix = [...src.blocks, { type: 'text', text: forgeContext(cfg, blueprint), cache_control: { type: 'ephemeral' } }];
  const cfgConcurrency = Math.max(1, Math.min(8, Number((await store.getConfig()).concurrency) || 4));

  const forgeBatch = async (batch, index) => {
    for (let attempt = 1; attempt <= 2; attempt++) {
      emit(job, 'batch', { index, status: 'active', attempt });
      const think = thinkingSink(job, 'forge', `batch-${index}`);
      try {
        const out = await runModel({
          model: builder,
          effort: ['graduate', 'qualifying'].includes(cfg.difficulty) ? 'xhigh' : 'high',
          system: FORGE_SYSTEM,
          messages: [{ role: 'user', content: [...prefix, { type: 'text', text: forgeTask(batch, specs) }] }],
          schema: BATCH_SCHEMA,
          usage,
          onThinking: think,
          onNotice: (m) => log('forge', m, 'warn'),
        });
        think.flush();
        const qs = (out.questions || []).filter((q) => q && q.stem);
        if (!qs.length) throw new Error('empty batch');
        for (const q of qs) emit(job, 'question', { n: Number(String(q.id).replace(/\D/g, '')) || null, qtype: q.type, style: q.style, concept: q.concept, stem: q.stem.slice(0, 220) });
        emit(job, 'batch', { index, status: 'done', count: qs.length });
        pushUsage();
        return qs;
      } catch (err) {
        think.flush();
        log('forge', `Batch ${index + 1} attempt ${attempt} failed: ${err.message}`, 'warn');
        if (attempt === 2) { emit(job, 'batch', { index, status: 'error' }); return []; }
      }
    }
    return [];
  };

  // The first batch runs alone so it writes the prompt cache the rest then read from.
  const first = await forgeBatch(batches[0], 0);
  const rest = await pool(batches.slice(1), cfgConcurrency, (b, i) => forgeBatch(b, i + 1));
  let questions = [first, ...rest].flat();
  if (!questions.length) throw new Error('No questions were generated. Check the log for errors.');
  questions = questions.map((q, i) => ({ ...q, id: `q${i + 1}` }));
  stage('forge', 'done', `${questions.length} questions forged`);

  // 4. Red team (thinker) -------------------------------------------------
  let reviewSummary = '';
  if (cfg.redTeam) {
    stage('redteam', 'active', `${thinker} is attacking every question`);
    const chunks = [];
    for (let i = 0; i < questions.length; i += REVIEW_CHUNK) chunks.push(questions.slice(i, i + REVIEW_CHUNK));
    let fixed = 0;
    const results = await pool(chunks, 3, async (chunk, ci) => {
      const think = thinkingSink(job, 'redteam', `chunk-${ci}`);
      try {
        const out = await runModel({
          model: thinker,
          effort: 'high',
          system: REDTEAM_SYSTEM,
          messages: [{ role: 'user', content: [...src.blocks, { type: 'text', text: redteamTask(cfg, chunk) }] }],
          schema: REVIEW_SCHEMA,
          usage,
          onThinking: think,
          onNotice: (m) => log('redteam', m, 'warn'),
        });
        think.flush();
        pushUsage();
        return out;
      } catch (err) {
        think.flush();
        log('redteam', `Review chunk ${ci + 1} failed (${err.message}); keeping those questions as written.`, 'warn');
        return null;
      }
    });
    const byId = new Map(questions.map((q) => [q.id, q]));
    for (const r of results.filter(Boolean)) {
      for (const rev of r.reviews || []) emit(job, 'review', { id: rev.id, verdict: rev.verdict, issue: rev.issue });
      for (const q of r.revisions || []) {
        if (byId.has(q.id) && q.stem) { byId.set(q.id, q); fixed++; }
      }
      if (r.summary) reviewSummary += `${r.summary} `;
    }
    questions = questions.map((q) => byId.get(q.id));
    stage('redteam', 'done', `${fixed} question${fixed === 1 ? '' : 's'} hardened or corrected`);
  } else {
    stage('redteam', 'skipped', 'Red team disabled');
  }

  // 5. Calibrate ----------------------------------------------------------
  stage('calibrate', 'active', 'Balancing the answer key and checking for tells');
  const cal = calibrate(questions);
  for (const line of cal.notes) log('calibrate', line);
  stage('calibrate', 'done', cal.headline);

  // 6. Finalize -----------------------------------------------------------
  stage('finalize', 'active', 'Saving exam');
  const exam = {
    id: store.newId('exam'),
    title: job.title,
    createdAt: Date.now(),
    config: cfg,
    models: { thinker, builder },
    blueprint: { title: blueprint.title, overview: blueprint.overview, style_profile: blueprint.style_profile, concepts: blueprint.concepts, misconceptions: blueprint.misconceptions },
    review: reviewSummary.trim(),
    calibration: cal.stats,
    sources: src.describe.map(({ id, name, kind, role }) => ({ id, name, kind, role })),
    questions,
    usage,
    durationMs: Date.now() - job.startedAt,
  };
  await store.saveExam(exam);
  job.examId = exam.id;
  job.status = 'done';
  stage('finalize', 'done', 'Exam ready');
  pushUsage();
  emit(job, 'done', { examId: exam.id, title: exam.title, count: questions.length, durationMs: exam.durationMs });
}

// Shuffle options so keyed positions are evenly spread, and report key tells.
export function calibrate(questions) {
  const mcqs = questions.filter((q) => (q.type === 'mcq' || q.type === 'multi_select') && Array.isArray(q.options) && q.options.length > 1);
  const shufflable = mcqs.filter((q) => !q.fixed_order && q.type === 'mcq' && q.options.filter((o) => o.correct).length === 1);
  if (shufflable.length) {
    const n = Math.min(...shufflable.map((q) => q.options.length));
    const targets = shuffle(Array.from({ length: shufflable.length }, (_, i) => i % n));
    shufflable.forEach((q, i) => {
      const key = q.options.find((o) => o.correct);
      const others = shuffle(q.options.filter((o) => !o.correct));
      others.splice(Math.min(targets[i], others.length), 0, key);
      q.options = others;
    });
  }
  for (const q of mcqs) if (q.type === 'multi_select' && !q.fixed_order) shuffle(q.options);
  for (const q of questions) {
    if (q.type === 'matching' && Array.isArray(q.match_right) && q.match_right.length) {
      const order = shuffle(q.match_right.map((_, i) => i));
      const right = order.map((i) => q.match_right[i]);
      q.match_key = (q.match_key || []).map((k) => order.indexOf(k));
      q.match_right = right;
    }
  }

  const single = mcqs.filter((q) => q.type === 'mcq' && q.options.filter((o) => o.correct).length === 1);
  const dist = {};
  let longest = 0;
  for (const q of single) {
    const idx = q.options.findIndex((o) => o.correct);
    const letter = String.fromCharCode(65 + idx);
    dist[letter] = (dist[letter] || 0) + 1;
    const lens = q.options.map((o) => o.text.length);
    if (lens[idx] === Math.max(...lens) && lens.filter((l) => l === lens[idx]).length === 1) longest++;
  }
  const longestPct = single.length ? Math.round((100 * longest) / single.length) : 0;
  const expected = single.length ? Math.round(100 / Math.max(1, Math.round(single.reduce((s, q) => s + q.options.length, 0) / single.length))) : 0;
  const notes = [];
  if (single.length) {
    notes.push(`Answer-key spread: ${Object.entries(dist).sort().map(([k, v]) => `${k}=${v}`).join('  ')}`);
    notes.push(`Key is the uniquely longest option in ${longestPct}% of items (chance ≈ ${expected}%).`);
  }
  const typeMix = questions.reduce((m, q) => ((m[q.type] = (m[q.type] || 0) + 1), m), {});
  notes.push(`Type mix: ${Object.entries(typeMix).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  return {
    notes,
    headline: single.length ? `Key spread ${Object.values(dist).join('/')} · longest-option tell ${longestPct}%` : 'Calibrated',
    stats: { keyDistribution: dist, longestOptionPct: longestPct, typeMix },
  };
}
