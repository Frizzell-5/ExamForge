// Subscription backend: runs prompts through the locally installed `claude` CLI
// (Claude Code in headless mode), which uses your Claude plan instead of an API key.
import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { DATA_DIR, getConfig } from './store.js';

const WORK_DIR = path.join(DATA_DIR, 'cli-work'); // empty dir so no project files/CLAUDE.md get picked up
const CANDIDATES = [
  path.join(os.homedir(), '.local/bin/claude'),
  path.join(os.homedir(), '.claude/local/claude'),
  '/opt/homebrew/bin/claude',
  '/usr/local/bin/claude',
];
const TIMEOUT_MS = 30 * 60 * 1000;

export async function findClaude() {
  const cfg = await getConfig();
  if (cfg.claudePath && fs.existsSync(cfg.claudePath)) return cfg.claudePath;
  return CANDIDATES.find((p) => fs.existsSync(p)) || 'claude';
}

export async function cliVersion() {
  const bin = await findClaude();
  return new Promise((resolve) => {
    execFile(bin, ['--version'], { timeout: 15000 }, (err, stdout) => resolve(err ? null : stdout.trim()));
  });
}

const stripCache = (blocks) => (typeof blocks === 'string' ? blocks : blocks.map(({ cache_control, ...b }) => b));
const systemText = (system) => (Array.isArray(system) ? system.map((b) => b.text).join('\n\n') : system || '');

export class PlanLimitError extends Error {}
export class ModelUnavailableError extends Error {}

export async function runModelCli({ model, system, messages, effort = 'high', schema, usage, onThinking, onText, signal }) {
  fs.mkdirSync(WORK_DIR, { recursive: true });
  const bin = await findClaude();
  const args = [
    '-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
    '--tools', '', '--model', model, '--effort', effort, '--system-prompt', systemText(system),
    '--no-session-persistence', '--setting-sources', '', '--strict-mcp-config', '--disable-slash-commands',
    ...(schema ? ['--json-schema', JSON.stringify(schema)] : []),
  ];
  // Drop API credentials so the CLI signs in with the Claude subscription.
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  delete env.ANTHROPIC_BASE_URL;

  const child = spawn(bin, args, { cwd: WORK_DIR, env, stdio: ['pipe', 'pipe', 'pipe'] });
  const kill = () => child.kill('SIGTERM');
  const timer = setTimeout(kill, TIMEOUT_MS);
  signal?.addEventListener('abort', kill);

  let stderr = '';
  child.stderr.on('data', (d) => { stderr += d; });
  const exited = new Promise((resolve, reject) => {
    child.on('error', (err) => reject(err.code === 'ENOENT'
      ? new Error('Could not find the `claude` command. Install Claude Code, or set its path in Settings.')
      : err));
    child.on('close', resolve);
  });

  for (const m of messages) {
    child.stdin.write(`${JSON.stringify({ type: 'user', message: { role: m.role, content: stripCache(m.content) } })}\n`);
  }
  child.stdin.end();

  // The CLI doesn't stream reasoning summaries, so surface the readable fields of the JSON
  // being written (stems, concepts, review findings) as live progress instead.
  let draft = '';
  let shown = 0;
  const FIELD = /"(title|name|angle|stem|issue|summary)"\s*:\s*"((?:[^"\\]|\\.){12,}?)"/g;
  const surface = () => {
    const found = [...draft.matchAll(FIELD)];
    for (; shown < found.length; shown++) {
      const [, key, raw] = found[shown];
      let val = raw;
      try { val = JSON.parse(`"${raw}"`); } catch { /* keep raw */ }
      onThinking?.(`${shown ? '\n' : ''}▸ ${key}: ${val.replace(/\s+/g, ' ').slice(0, 180)}`);
    }
  };

  let result = null;
  for await (const line of readline.createInterface({ input: child.stdout })) {
    let d;
    try { d = JSON.parse(line); } catch { continue; }
    if (d.type === 'stream_event' && d.event?.type === 'content_block_delta') {
      const delta = d.event.delta;
      if (delta.type === 'thinking_delta' && delta.thinking) onThinking?.(delta.thinking);
      else if (delta.type === 'text_delta') { onText?.(delta.text); draft += delta.text; surface(); }
      else if (delta.type === 'input_json_delta') { draft += delta.partial_json; surface(); }
    } else if (d.type === 'result') {
      result = d;
    }
  }
  await exited;
  clearTimeout(timer);

  if (!result) throw new Error(`claude CLI exited without a result${stderr ? `: ${stderr.trim().slice(0, 300)}` : ''}`);
  if (result.is_error) {
    const msg = String(result.result || result.errors || 'unknown error');
    if (/requires usage credits|not available|invalid model|model.*not (found|supported)/i.test(msg)) throw new ModelUnavailableError(msg);
    if (/limit|quota|usage/i.test(msg)) throw new PlanLimitError(`Your Claude plan's usage limit was reached: ${msg}`);
    throw new Error(msg);
  }

  if (usage) {
    const u = result.usage || {};
    const m = (usage.byModel[model] ||= { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0 });
    m.input += u.input_tokens || 0;
    m.output += u.output_tokens || 0;
    m.cacheRead += u.cache_read_input_tokens || 0;
    m.cacheWrite += u.cache_creation_input_tokens || 0;
    m.calls += 1;
    usage.subscription = true;
    usage.apiEquivalentUsd = (usage.apiEquivalentUsd || 0) + (result.total_cost_usd || 0);
  }
  if (!schema) return result.result;
  if (result.structured_output) return result.structured_output;
  const { parseJson } = await import('./llm.js');
  return parseJson(result.result || '');
}
