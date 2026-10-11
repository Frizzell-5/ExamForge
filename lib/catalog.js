// Shared vocabulary for the UI and the prompts.

export const QUESTION_TYPES = [
  { id: 'mcq', label: 'Multiple choice', hint: 'Single best answer' },
  { id: 'multi_select', label: 'Select all that apply', hint: 'Several correct options' },
  { id: 'true_false', label: 'True / False', hint: 'Precise claims, subtle traps' },
  { id: 'fill_blank', label: 'Fill in the blank', hint: 'Exact term recall' },
  { id: 'numeric', label: 'Numeric', hint: 'Calculated answer with tolerance' },
  { id: 'matching', label: 'Matching', hint: 'Pair items across two columns' },
  { id: 'short_answer', label: 'Short answer', hint: '2–5 sentences, AI-graded' },
  { id: 'essay', label: 'Essay / long-form', hint: 'Extended argument, rubric-graded' },
];

export const MCQ_STYLES = [
  { id: 'best_answer', label: 'Single best answer', example: 'Which of the following best explains…?' },
  { id: 'which_false', label: 'Which is FALSE', example: 'Which of the following statements is FALSE?' },
  { id: 'except', label: 'All of the following… EXCEPT', example: 'All of the following are true of X EXCEPT:' },
  { id: 'least_likely', label: 'LEAST likely / NOT', example: 'Which is LEAST likely to…?' },
  { id: 'most_likely', label: 'MOST likely', example: 'Which is the MOST likely outcome…?' },
  { id: 'scenario', label: 'Scenario / vignette', example: 'A researcher observes… What is the most likely explanation?' },
  { id: 'data_interpretation', label: 'Data interpretation', example: 'Based on the table above, which conclusion is supported?' },
  { id: 'assertion_reason', label: 'Assertion–reason', example: 'Assertion: … Reason: … (both true, reason explains / doesn\'t…)' },
  { id: 'roman_numeral', label: 'Roman-numeral combos (I, II, III)', example: 'Which of the following are correct? I. … II. … III. …' },
  { id: 'two_statement', label: 'Two-statement evaluation', example: 'Statement 1 … Statement 2 … (True/True, True/False …)' },
  { id: 'multi_step_calc', label: 'Multi-step calculation', example: 'Given…, what is the resulting value of…?' },
  { id: 'error_spotting', label: 'Spot the flawed reasoning', example: 'A student argues… Which step contains the error?' },
  { id: 'next_step', label: 'FIRST / NEXT step', example: 'What is the most appropriate NEXT step?' },
  { id: 'compare_contrast', label: 'Compare & contrast', example: 'Which feature distinguishes X from Y?' },
  { id: 'cause_effect', label: 'Cause → effect / prediction', example: 'If X were inhibited, which would occur?' },
  { id: 'counterexample', label: 'Counterexample', example: 'Which of the following is a counterexample to…?' },
  { id: 'experimental_design', label: 'Experimental design', example: 'Which control would best isolate…?' },
  { id: 'double_negation', label: 'Double-negation / precise wording', example: 'Which statement is NOT incorrect?' },
  { id: 'all_none_above', label: 'All / None of the above (honest use)', example: '…  E. None of the above' },
];

export const DIFFICULTIES = [
  { id: 'foundational', label: 'Foundational', blurb: 'Recall and comprehension of single concepts.' },
  { id: 'intermediate', label: 'Intermediate', blurb: 'Application and two-step reasoning.' },
  { id: 'advanced', label: 'Advanced', blurb: 'Analysis across concepts; misconception-based distractors.' },
  { id: 'graduate', label: 'Graduate', blurb: 'Graduate-course rigor: synthesis, novel scenarios, fine distinctions.' },
  { id: 'qualifying', label: 'Qualifying / Boards', blurb: 'Doctoral-qualifier severity: multi-hop, edge cases, near-miss distractors.' },
  { id: 'ramp', label: 'Ramp (mixed)', blurb: 'Starts accessible and escalates to graduate level.' },
];

export const ADAPT_MODES = [
  { id: 'blend', label: 'Influence', blurb: 'Reference exams nudge style and topic weighting.' },
  { id: 'mirror', label: 'Mirror', blurb: 'Match the format, phrasing, weighting and difficulty of your past exams with all-new questions.' },
  { id: 'harder', label: 'Mirror, but harder', blurb: 'Same style as your past exams, escalated one or two difficulty tiers.' },
  { id: 'isomorphic', label: 'Isomorphic variants', blurb: 'Same structure and tested skill as the reference questions, different specifics.' },
];

export const DIFFICULTY_GUIDE = {
  foundational: 'Recall and comprehension. One concept per item. Distractors are clearly wrong to a student who studied, but still on-topic.',
  intermediate: 'Application and two-step reasoning. Distractors reflect common, textbook-level mistakes.',
  advanced: 'Analysis across two or more concepts. Every distractor encodes a specific, realistic misconception or a correct fact misapplied.',
  graduate: 'Graduate-course rigor. Items integrate several concepts, use unfamiliar scenarios, and hinge on precise distinctions, conditions, exceptions and mechanisms. Distractors are true statements in the wrong context, near-synonyms, partially correct claims, or the answer to a closely related but different question.',
  qualifying: 'Doctoral qualifying / board-exam severity. Multi-hop reasoning, edge cases, limits of theories, quantitative traps, and distractors that an expert would need to pause on. Each item should separate genuine mastery from strong familiarity.',
  ramp: 'Order items so difficulty rises steadily: roughly first 20% foundational/intermediate, middle 50% advanced, final 30% graduate or qualifying.',
};

export function catalog() {
  return { types: QUESTION_TYPES, styles: MCQ_STYLES, difficulties: DIFFICULTIES, adaptModes: ADAPT_MODES };
}
