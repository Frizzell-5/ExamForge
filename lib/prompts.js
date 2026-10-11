// Prompts and JSON schemas for each pipeline stage.
import { QUESTION_TYPES, MCQ_STYLES, DIFFICULTY_GUIDE, ADAPT_MODES } from './catalog.js';

const TYPE_IDS = QUESTION_TYPES.map((t) => t.id);
const str = { type: 'string' };
const obj = (properties) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });

export const QUESTION_SCHEMA = obj({
  id: str,
  type: { type: 'string', enum: TYPE_IDS },
  style: str,
  concept: str,
  difficulty: str,
  bloom: str,
  context: str,
  stem: str,
  options: { type: 'array', items: obj({ text: str, correct: { type: 'boolean' }, rationale: str }) },
  fixed_order: { type: 'boolean' },
  answer: str,
  accepted_answers: { type: 'array', items: str },
  tolerance: { type: 'number' },
  match_left: { type: 'array', items: str },
  match_right: { type: 'array', items: str },
  match_key: { type: 'array', items: { type: 'integer' } },
  rubric: str,
  explanation: str,
  trap: str,
  source: str,
  points: { type: 'integer' },
});

export const BLUEPRINT_SCHEMA = obj({
  title: str,
  overview: str,
  style_profile: str,
  concepts: { type: 'array', items: obj({ name: str, weight: { type: 'integer' }, key_facts: str }) },
  misconceptions: { type: 'array', items: str },
  specs: {
    type: 'array',
    items: obj({
      n: { type: 'integer' },
      type: { type: 'string', enum: TYPE_IDS },
      style: str,
      concept: str,
      difficulty: str,
      bloom: str,
      angle: str,
      trap: str,
    }),
  },
});

export const BATCH_SCHEMA = obj({ questions: { type: 'array', items: QUESTION_SCHEMA } });

export const REVIEW_SCHEMA = obj({
  summary: str,
  reviews: { type: 'array', items: obj({ id: str, verdict: { type: 'string', enum: ['pass', 'fixed'] }, issue: str }) },
  revisions: { type: 'array', items: QUESTION_SCHEMA },
});

export const GRADE_SCHEMA = obj({
  grades: { type: 'array', items: obj({ id: str, score: { type: 'number' }, verdict: str, feedback: str }) },
});

// ---------------------------------------------------------------------------

export const ARCHITECT_SYSTEM = `You are the Exam Architect inside ExamForge, a practice-exam generator for a serious student.
You read the student's course materials (and any past exams they uploaded) and design the blueprint for one exam: what each question will test, in what form, at what difficulty, and how it will try to catch a student who only half-understands.
A separate writer model turns each spec into a finished question, so every spec must be concrete enough to write from without guessing: name the precise idea, distinction, mechanism, calculation or scenario being tested.
Ground the blueprint in the materials. Weight concepts by how much the materials (and reference exams) emphasise them, cover the breadth of the material, and never spec two questions that test the same point the same way.`;

export const FORGE_SYSTEM = `You are the Question Forge inside ExamForge. You write finished exam questions from blueprint specs, grounded in the student's materials.

Craft standards (these define a good item; follow them closely):
- Every keyed answer must be correct according to the materials (standard domain knowledge consistent with them is fine). Deceptive means a careless or half-prepared student is drawn to a wrong option; it never means ambiguous. An expert must be able to defend exactly one key.
- Distractors: each one encodes a specific, plausible error — a real misconception, a correct fact applied in the wrong context, a reversed relationship, an off-by-one condition, a near-synonym, the answer to a closely related question, a calculation slip. Write the rationale for every option, including why the key is right.
- Remove giveaways: options are parallel in grammar, length and specificity; the key is not systematically the longest, most hedged, or the only one that repeats stem wording; avoid absolute words ("always", "never") as a cheap tell; no two distractors that are synonyms of each other; no "convergence" where the key shares the most features with the others.
- Negative styles (which_false, except, least_likely, double_negation): put the negating word in CAPITALS in the stem (FALSE, EXCEPT, LEAST, NOT). Mark correct=true on the option the student should SELECT (e.g. the false statement). All other options must be unambiguously true/likely.
- Never refer to another option by letter or position ("both A and C") unless fixed_order is true. Set fixed_order=true for roman_numeral, two_statement, assertion_reason, all_none_above and true_false items, and order their options in the conventional way. "All/None of the above" may be the key only when it genuinely is.
- multi_select: at least two correct options and at least two incorrect ones; say "Select ALL that apply." in the stem.
- true_false: options are exactly [{"text":"True"},{"text":"False"}] with the correct flag set; the stem is a single precise claim whose truth hinges on a detail.
- fill_blank: stem contains "_____"; put the canonical answer in "answer" and acceptable variants (spellings, abbreviations, synonyms) in accepted_answers.
- numeric: "answer" is the number only (no units, units go in the stem); "tolerance" is the absolute tolerance accepted (use a sensible rounding tolerance).
- matching: 4–6 match_left items; match_right has the same count plus 0–2 decoys, shuffled; match_key[i] is the index in match_right that matches match_left[i].
- short_answer / essay: "answer" holds a model answer; "rubric" lists the gradeable points with point allocation.
- Put any vignette, passage, data table (markdown) or code in "context"; "stem" is the actual question. Use markdown; write math as LaTeX in $...$ or $$...$$.
- "explanation" teaches: the core insight and how to reason to the key. "trap" names what makes the item deceptive. "source" cites where in the materials (source name + slide/page/section).
- Fill every field; use "" / [] / 0 for fields that do not apply to the type. points: 1 for objective items, 3–5 for short_answer, 8–15 for essay.
- Keep the spec's type, style, concept and difficulty. Write the questions in the language of the materials.`;

export const REDTEAM_SYSTEM = `You are the Red Team reviewer inside ExamForge. Another model wrote these exam questions; your job is to break them before a student sees them.
For each question, check against the materials:
1. Is the key actually correct? Is there exactly one defensible answer (or exactly the keyed set for select-all)? Could an expert argue for a distractor?
2. For negative styles (FALSE / EXCEPT / LEAST / NOT), is the option the student should select marked correct, and are all other options genuinely true/likely?
3. Giveaways: key longest or most qualified, grammatical mismatch with the stem, repeated stem wording, absolute-word tells, options referencing letters while shuffleable (fixed_order false).
4. Does it meet the requested difficulty, and is it deceptive rather than ambiguous or trivial?
5. Are explanation, rationales, rubric, accepted answers and numeric tolerance correct and complete?
Return a review for every question id. When a question needs any change, mark it "fixed" and include the complete corrected question (same id) in revisions; make it at least as hard as the original. Questions marked "pass" must not appear in revisions.`;

export const GRADER_SYSTEM = `You are the grader inside ExamForge. Grade each free-response answer against its rubric and model answer, as a fair but rigorous professor at the stated difficulty level.
score is a fraction from 0 to 1 (partial credit allowed). verdict is one of "correct", "partial", "incorrect". feedback: 1–3 sentences addressed to the student naming what earned credit and exactly what was missing or wrong. Accept equivalent wording, notation and spelling variants. A blank answer scores 0.`;

// ---------------------------------------------------------------------------

export function typeCounts(count, weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  if (!entries.length) return { mcq: count };
  const total = entries.reduce((s, [, w]) => s + w, 0);
  const raw = entries.map(([t, w]) => [t, (w / total) * count]);
  const out = Object.fromEntries(raw.map(([t, v]) => [t, Math.floor(v)]));
  let left = count - Object.values(out).reduce((a, b) => a + b, 0);
  raw.sort((a, b) => (b[1] % 1) - (a[1] % 1));
  for (let i = 0; left > 0; i = (i + 1) % raw.length, left--) out[raw[i][0]] += 1;
  return out;
}

const DECEPTION = {
  1: 'Straightforward: distractors are plausible but clearly wrong to a prepared student.',
  2: 'Moderate: distractors reflect common mistakes.',
  3: 'Tricky: every distractor encodes a realistic misconception; some stems include a detail that changes the answer.',
  4: 'Deceptive: distractors are near-misses (true-but-irrelevant, right idea wrong condition, reversed direction); wording rewards careful reading.',
  5: 'Ruthless: every option looks correct at first glance; only precise mastery separates the key. Use subtle qualifiers, exceptions, and the answer to an adjacent question as distractors. Still exactly one defensible key.',
};

const ADAPT_GUIDE = {
  blend: 'Use the reference exams as a guide to the instructor\'s emphasis and style, but feel free to range wider.',
  mirror: 'Mirror the reference exams closely: same question formats and their proportions, same phrasing conventions and stem length, same topic weighting, same difficulty level, same kinds of traps. All questions must be new — never copy a reference item.',
  harder: 'Mirror the reference exams\' format, phrasing and topic weighting, but escalate difficulty one to two tiers: deeper reasoning, subtler distractors, more integration across topics.',
  isomorphic: 'Create isomorphic variants of the reference questions: for each spec, pick a reference question and test the same skill with the same structure, but change the scenario, numbers, organism/system/example, and which option is keyed. Cite which reference question each spec is based on in its angle.',
};

export function architectTask(cfg, counts, hasRefs) {
  const styles = MCQ_STYLES.filter((s) => cfg.styles.includes(s.id));
  const styleList = styles.map((s) => `- ${s.id}: ${s.label} (e.g. "${s.example}")`).join('\n');
  const countLines = Object.entries(counts).map(([t, n]) => `- ${t}: ${n}`).join('\n');
  const adapt = hasRefs ? `\nReference exams are included in <reference_exams>. Adaptation mode "${cfg.adaptMode}": ${ADAPT_GUIDE[cfg.adaptMode] || ADAPT_GUIDE.blend}\nDescribe the reference exams' style concretely in style_profile so the writer can imitate it.\n` : '\nNo reference exams were provided; leave style_profile describing the house style you chose.\n';
  return `Design the blueprint for a ${cfg.count}-question exam${cfg.title ? ` titled "${cfg.title}"` : ''}.

Exact question-type counts (the specs must match these totals):
${countLines}

Multiple-choice and select-all styles to use (spread across these; vary them so consecutive questions differ; for other types put a short description of the form in "style"):
${styleList || '- best_answer'}

Difficulty target: ${cfg.difficulty}. ${DIFFICULTY_GUIDE[cfg.difficulty] || ''}
Deception level ${cfg.deception}/5: ${DECEPTION[cfg.deception] || DECEPTION[3]}
${cfg.focus ? `Focus topics requested by the student (prioritise these, but stay grounded): ${cfg.focus}\n` : ''}${cfg.notes ? `Additional instructions from the student: ${cfg.notes}\n` : ''}${adapt}
Produce:
- title: a crisp exam title.
- overview: 2–3 sentences on what the exam covers and how it will challenge the student.
- concepts: the concept map you are testing, weight 1–5, with key_facts the writer must get right.
- misconceptions: the specific misconceptions and confusions you will exploit as traps.
- specs: exactly ${cfg.count} items numbered n = 1..${cfg.count}, in exam order. For each: type, style, concept, difficulty (one of foundational/intermediate/advanced/graduate/qualifying), bloom (remember/understand/apply/analyze/evaluate/create), angle (the precise thing tested and the scenario or setup to use — specific, 1–3 sentences), trap (how the item will mislead a half-prepared student).`;
}

export function forgeContext(cfg, blueprint) {
  return `<blueprint>
Exam: ${blueprint.title}
Overview: ${blueprint.overview}
Style profile to imitate: ${blueprint.style_profile}
Concepts:
${blueprint.concepts.map((c) => `- ${c.name} (weight ${c.weight}): ${c.key_facts}`).join('\n')}
Misconceptions to exploit:
${blueprint.misconceptions.map((m) => `- ${m}`).join('\n')}
Global settings: difficulty target ${cfg.difficulty}; deception ${cfg.deception}/5 — ${DECEPTION[cfg.deception] || DECEPTION[3]}
Multiple choice items have exactly ${cfg.optionsCount} options; select-all items have ${Number(cfg.optionsCount) + 1}.
</blueprint>`;
}

export function forgeTask(specs, allSpecs) {
  const others = allSpecs.filter((s) => !specs.includes(s)).map((s) => `#${s.n} ${s.concept}: ${s.angle}`).join('\n');
  return `Write these ${specs.length} questions, one per spec, in order. Set each question's id to "q<n>" using the spec number.

<specs>
${specs.map((s) => JSON.stringify(s)).join('\n')}
</specs>

Other questions in this exam (do not duplicate what they test):
${others || '(none)'}`;
}

export function redteamTask(cfg, questions) {
  return `Target difficulty: ${cfg.difficulty}; deception ${cfg.deception}/5.
Review these ${questions.length} questions:
<questions>
${questions.map((q) => JSON.stringify(q)).join('\n')}
</questions>`;
}

export const adaptModeLabel = (id) => (ADAPT_MODES.find((m) => m.id === id) || {}).label || id;
