// Claude access: one streaming helper used by every stage of the pipeline.
import Anthropic from '@anthropic-ai/sdk';
import { getConfig } from './store.js';
import { runModelCli, ModelUnavailableError } from './cli.js';

export const DEFAULT_MODELS = {
  thinker: 'claude-fable-5-1', // architect + red-team reviewer
  builder: 'claude-opus-5-5', // question writer + grader
};
// On a Claude subscription, Fable 5.1 needs paid usage credits, so Opus 5.5 does every stage by default.
export const SUBSCRIPTION_MODELS = { thinker: 'claude-opus-5-5', builder: 'claude-opus-5-5' };

// "subscription" runs through the local `claude` CLI (Claude plan); "api" uses an API key.
export async function backend() {
  const cfg = await getConfig();
  if (cfg.backend === 'api' || cfg.backend === 'subscription') return cfg.backend;
  return cfg.apiKey || process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN ? 'api' : 'subscription';
}

// USD per million tokens (estimates for the cost meter only).
const PRICES = {
  'claude-fable-5-1': { input: 10, output: 50, cacheRead: 0.25 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2 },
  'claude-opus-4-8': { input: 5, output: 25, cacheRead: 0.5 },
};
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

let client = null;
// Remembers, per model, the first request variant the API accepted.
const acceptedVariant = new Map();
let clientKey = undefined;

export async function models() {
  const cfg = await getConfig();
  const defaults = (await backend()) === 'subscription' ? SUBSCRIPTION_MODELS : DEFAULT_MODELS;
  return { thinker: cfg.thinkerModel || defaults.thinker, builder: cfg.builderModel || defaults.builder };
}

export async function getClient() {
  const cfg = await getConfig();
  if (client && clientKey === cfg.apiKey) return client;
  try {
    client = new Anthropic({ ...(cfg.apiKey ? { apiKey: cfg.apiKey } : {}), timeout: 30 * 60 * 1000, maxRetries: 4 });
  } catch (err) {
    throw new Error('No Anthropic credentials found. Add your API key in Settings, or export ANTHROPIC_API_KEY before launching.');
  }
  clientKey = cfg.apiKey;
  return client;
}

export function newUsage() { return { byModel: {}, costUsd: 0 }; }

function addUsage(usage, model, u) {
  if (!usage || !u) return;
  const m = (usage.byModel[model] ||= { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0 });
  m.input += u.input_tokens || 0;
  m.output += u.output_tokens || 0;
  m.cacheRead += u.cache_read_input_tokens || 0;
  m.cacheWrite += u.cache_creation_input_tokens || 0;
  m.calls += 1;
  const p = PRICES[model] || PRICES['claude-opus-5-5'];
  usage.costUsd += ((u.input_tokens || 0) * p.input + (u.output_tokens || 0) * p.output
    + (u.cache_read_input_tokens || 0) * p.cacheRead + (u.cache_creation_input_tokens || 0) * p.input * 1.25) / 1e6;
}

export function parseJson(text) {
  try { return JSON.parse(text); } catch { /* fall through */ }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) { try { return JSON.parse(fenced[1]); } catch { /* fall through */ } }
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a >= 0 && b > a) return JSON.parse(text.slice(a, b + 1));
  throw new Error('Model did not return valid JSON');
}

/**
 * Streams one Claude call. Thinking summaries and text arrive via callbacks so the UI can
 * show the model working. With `schema`, the response is constrained to that JSON schema.
 *
 * Tries the richest request first (server-side refusal fallback + structured output) and
 * steps down if the API rejects a feature for this model, so a beta drift never kills a run.
 */
export async function runModel(opts) {
  if ((await backend()) === 'api') return runModelApi(opts);
  try {
    return await runModelCli(opts);
  } catch (err) {
    // e.g. Fable 5.1 without usage credits: fall back to the builder model rather than failing the run.
    const { builder } = await models();
    if (err instanceof ModelUnavailableError && opts.model !== builder) {
      opts.onNotice?.(`${opts.model} isn't available on your plan (${err.message.slice(0, 120)}); using ${builder} instead.`);
      return runModelCli({ ...opts, model: builder });
    }
    throw err;
  }
}

async function runModelApi({ model, system, messages, effort = 'high', schema, maxTokens = 64000, usage, onThinking, onText, onNotice, signal }) {
  const anthropic = await getClient();
  const base = {
    model,
    max_tokens: maxTokens,
    system,
    messages,
    thinking: { type: 'adaptive', display: 'summarized' },
    output_config: { effort, ...(schema ? { format: { type: 'json_schema', schema } } : {}) },
  };
  const variants = [
    { label: 'fallbacks+schema', params: { ...base, betas: [FALLBACK_BETA], fallbacks: 'default' } },
    { label: 'schema', params: base },
  ];
  if (schema) {
    const loose = { ...base, output_config: { effort } };
    loose.system = [...(Array.isArray(system) ? system : [{ type: 'text', text: system }]),
      { type: 'text', text: `Respond with a single JSON object only (no prose, no code fences) matching this JSON schema:\n${JSON.stringify(schema)}` }];
    variants.push({ label: 'prompted-json', params: loose });
  }

  const known = acceptedVariant.get(model);
  const ordered = known ? variants.filter((v) => v.label === known).concat(variants.filter((v) => v.label !== known)) : variants;
  let lastErr;
  for (const v of ordered) {
    try {
      const stream = anthropic.beta.messages.stream(v.params, { signal });
      for await (const ev of stream) {
        if (ev.type !== 'content_block_delta') continue;
        if (ev.delta.type === 'thinking_delta' && ev.delta.thinking) onThinking?.(ev.delta.thinking);
        else if (ev.delta.type === 'text_delta') onText?.(ev.delta.text);
      }
      const msg = await stream.finalMessage();
      acceptedVariant.set(model, v.label);
      addUsage(usage, msg.model || model, msg.usage);
      if (msg.stop_reason === 'refusal') {
        throw new Error(`${model} declined this request${msg.stop_details?.category ? ` (${msg.stop_details.category})` : ''}.`);
      }
      if (msg.stop_reason === 'max_tokens') throw new Error('Response hit the output limit; try fewer questions per batch.');
      const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
      return schema ? parseJson(text) : text;
    } catch (err) {
      if (err instanceof Anthropic.BadRequestError) {
        lastErr = err;
        onNotice?.(`${model}: request variant "${v.label}" rejected (${err.message.slice(0, 160)}); retrying with a simpler request.`);
        continue;
      }
      if (err instanceof Anthropic.AuthenticationError) {
        throw new Error('Anthropic rejected the API key. Update it in Settings.');
      }
      throw err;
    }
  }
  throw lastErr;
}
