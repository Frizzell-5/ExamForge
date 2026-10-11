// Scores an attempt: objective items locally, free-response items with Claude.
import { runModel, newUsage, models } from './llm.js';
import { GRADER_SYSTEM, GRADE_SCHEMA } from './prompts.js';

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9.+-]+/g, ' ').trim();

export function gradeObjective(q, answer) {
  const pts = q.points || 1;
  const result = (score, verdict) => ({ id: q.id, score, earned: +(score * pts).toFixed(2), points: pts, verdict });
  if (answer === undefined || answer === null || answer === '' || (Array.isArray(answer) && !answer.length)) return result(0, 'unanswered');
  switch (q.type) {
    case 'mcq':
    case 'true_false': {
      const key = q.options.findIndex((o) => o.correct);
      return result(Number(answer) === key ? 1 : 0, Number(answer) === key ? 'correct' : 'incorrect');
    }
    case 'multi_select': {
      const keys = new Set(q.options.map((o, i) => (o.correct ? i : -1)).filter((i) => i >= 0));
      const chosen = new Set((answer || []).map(Number));
      const hits = [...chosen].filter((i) => keys.has(i)).length;
      const wrong = chosen.size - hits;
      if (hits === keys.size && wrong === 0) return result(1, 'correct');
      const s = Math.max(0, (hits - wrong) / keys.size);
      return result(+s.toFixed(3), s > 0 ? 'partial' : 'incorrect');
    }
    case 'matching': {
      const key = q.match_key || [];
      const got = key.filter((k, i) => Number(answer?.[i]) === k).length;
      const s = key.length ? got / key.length : 0;
      return result(+s.toFixed(3), s === 1 ? 'correct' : s > 0 ? 'partial' : 'incorrect');
    }
    case 'numeric': {
      const target = parseFloat(String(q.answer).replace(/[^0-9eE.+-]/g, ''));
      const got = parseFloat(String(answer).replace(/,/g, ''));
      if (Number.isNaN(got) || Number.isNaN(target)) return null;
      const tol = q.tolerance > 0 ? q.tolerance : Math.abs(target) * 0.01;
      const ok = Math.abs(got - target) <= tol + 1e-12;
      return result(ok ? 1 : 0, ok ? 'correct' : 'incorrect');
    }
    case 'fill_blank': {
      const accepted = [q.answer, ...(q.accepted_answers || [])].map(norm).filter(Boolean);
      if (accepted.includes(norm(answer))) return result(1, 'correct');
      return null; // let the AI judge near-misses
    }
    default:
      return null;
  }
}

export async function gradeAttempt(exam, answers) {
  const usage = newUsage();
  const results = {};
  const pending = [];
  for (const q of exam.questions) {
    const r = gradeObjective(q, answers[q.id]);
    if (r) results[q.id] = r;
    else pending.push(q);
  }
  const ask = pending.filter((q) => String(answers[q.id] ?? '').trim());
  for (const q of pending) if (!ask.includes(q)) results[q.id] = { id: q.id, score: 0, earned: 0, points: q.points || 1, verdict: 'unanswered' };

  if (ask.length) {
    const { builder } = await models();
    const payload = ask.map((q) => ({
      id: q.id, type: q.type, difficulty: q.difficulty, context: q.context, question: q.stem,
      model_answer: q.answer, accepted_answers: q.accepted_answers, rubric: q.rubric, student_answer: String(answers[q.id]),
    }));
    try {
      const out = await runModel({
        model: builder,
        effort: 'medium',
        maxTokens: 32000,
        system: GRADER_SYSTEM,
        messages: [{ role: 'user', content: `Grade these answers:\n${payload.map((p) => JSON.stringify(p)).join('\n')}` }],
        schema: GRADE_SCHEMA,
        usage,
      });
      for (const g of out.grades || []) {
        const q = ask.find((x) => x.id === g.id);
        if (!q) continue;
        const score = Math.max(0, Math.min(1, Number(g.score) || 0));
        results[q.id] = { id: q.id, score, earned: +(score * (q.points || 1)).toFixed(2), points: q.points || 1, verdict: g.verdict, feedback: g.feedback, aiGraded: true };
      }
    } catch (err) {
      for (const q of ask) if (!results[q.id]) results[q.id] = { id: q.id, score: 0, earned: 0, points: q.points || 1, verdict: 'ungraded', feedback: `AI grading failed: ${err.message}` };
    }
    for (const q of ask) if (!results[q.id]) results[q.id] = { id: q.id, score: 0, earned: 0, points: q.points || 1, verdict: 'ungraded', feedback: 'The grader skipped this item.' };
  }

  const total = exam.questions.reduce((s, q) => s + (q.points || 1), 0);
  const earned = Object.values(results).reduce((s, r) => s + r.earned, 0);
  const breakdown = (key) => {
    const m = {};
    for (const q of exam.questions) {
      const k = q[key] || 'other';
      const b = (m[k] ||= { earned: 0, points: 0, n: 0 });
      b.earned += results[q.id].earned; b.points += q.points || 1; b.n += 1;
    }
    return m;
  };
  return {
    results,
    earned: +earned.toFixed(2),
    total,
    pct: total ? Math.round((1000 * earned) / total) / 10 : 0,
    byConcept: breakdown('concept'),
    byType: breakdown('type'),
    byDifficulty: breakdown('difficulty'),
    usage,
  };
}
