// Plain JSON-on-disk storage under ./data. Everything stays on this Mac.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.EXAMFORGE_DATA || path.join(here, '..', 'data');
const DIRS = {
  library: path.join(DATA_DIR, 'library'),
  blobs: path.join(DATA_DIR, 'blobs'),
  exams: path.join(DATA_DIR, 'exams'),
  attempts: path.join(DATA_DIR, 'attempts'),
};
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

export async function init() {
  for (const d of Object.values(DIRS)) await fs.mkdir(d, { recursive: true });
}

export const newId = (prefix) => `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;

async function readJson(file, fallback = null) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}
async function writeJson(file, value) {
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2));
  await fs.rename(tmp, file);
}
async function listJson(dir) {
  const names = (await fs.readdir(dir)).filter((n) => n.endsWith('.json'));
  const items = await Promise.all(names.map((n) => readJson(path.join(dir, n))));
  return items.filter(Boolean).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
const safe = (id) => String(id).replace(/[^a-zA-Z0-9_-]/g, '');

// ---- materials ----------------------------------------------------------
// meta: library/<id>.json, text: library/<id>.txt, original bytes for vision: blobs/<id>
export async function saveMaterial(meta, text, blob) {
  await fs.writeFile(path.join(DIRS.library, `${safe(meta.id)}.txt`), text || '');
  if (blob) await fs.writeFile(path.join(DIRS.blobs, safe(meta.id)), blob);
  await writeJson(path.join(DIRS.library, `${safe(meta.id)}.json`), meta);
  return meta;
}
export const listMaterials = () => listJson(DIRS.library);
export const getMaterialMeta = (id) => readJson(path.join(DIRS.library, `${safe(id)}.json`));
export async function updateMaterialMeta(id, patch) {
  const meta = await getMaterialMeta(id);
  if (!meta) return null;
  Object.assign(meta, patch);
  await writeJson(path.join(DIRS.library, `${safe(id)}.json`), meta);
  return meta;
}
export async function getMaterialText(id) {
  try { return await fs.readFile(path.join(DIRS.library, `${safe(id)}.txt`), 'utf8'); } catch { return ''; }
}
export async function getMaterialBlob(id) {
  try { return await fs.readFile(path.join(DIRS.blobs, safe(id))); } catch { return null; }
}
export async function deleteMaterial(id) {
  for (const f of [path.join(DIRS.library, `${safe(id)}.json`), path.join(DIRS.library, `${safe(id)}.txt`), path.join(DIRS.blobs, safe(id))]) {
    await fs.rm(f, { force: true });
  }
}

// ---- exams & attempts ---------------------------------------------------
export const saveExam = (exam) => writeJson(path.join(DIRS.exams, `${safe(exam.id)}.json`), exam);
export const getExam = (id) => readJson(path.join(DIRS.exams, `${safe(id)}.json`));
export const listExams = () => listJson(DIRS.exams);
export const deleteExam = (id) => fs.rm(path.join(DIRS.exams, `${safe(id)}.json`), { force: true });

export const saveAttempt = (a) => writeJson(path.join(DIRS.attempts, `${safe(a.id)}.json`), a);
export const getAttempt = (id) => readJson(path.join(DIRS.attempts, `${safe(id)}.json`));
export const listAttempts = () => listJson(DIRS.attempts);

// ---- config -------------------------------------------------------------
export const getConfig = () => readJson(CONFIG_FILE, {});
export async function setConfig(patch) {
  const cfg = { ...(await getConfig()), ...patch };
  for (const [k, v] of Object.entries(cfg)) if (v === '' || v === null) delete cfg[k];
  await writeJson(CONFIG_FILE, cfg);
  return cfg;
}
