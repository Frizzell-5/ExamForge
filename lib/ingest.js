// Turns uploaded files into study text. Scanned PDFs and images are kept as
// bytes too, so Claude can read them visually.
import path from 'node:path';
import JSZip from 'jszip';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

const IMAGE_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };
const TEXT_EXTS = new Set(['.txt', '.md', '.markdown', '.csv', '.tsv', '.json', '.tex', '.rtf', '.log']);
export const SUPPORTED = ['.pdf', '.pptx', '.docx', '.vtt', '.srt', '.html', '.htm', ...TEXT_EXTS, ...Object.keys(IMAGE_TYPES)];

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_NATIVE_PDF_BYTES = 24 * 1024 * 1024;

const decodeXml = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, '&');

const tidy = (s) => s.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

function drawingMLText(xml) {
  // One line per paragraph, runs concatenated.
  return xml.split(/<\/a:p>/).map((p) => [...p.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => decodeXml(m[1])).join(''))
    .map((l) => l.trim()).filter(Boolean).join('\n');
}

async function extractPptx(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const num = (f) => Number(f.match(/(\d+)\.xml$/)[1]);
  const slides = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f)).sort((a, b) => num(a) - num(b));
  const out = [];
  for (const f of slides) {
    const n = num(f);
    const body = drawingMLText(await zip.file(f).async('string'));
    let notes = '';
    const rels = zip.file(`ppt/slides/_rels/slide${n}.xml.rels`);
    if (rels) {
      const target = (await rels.async('string')).match(/Target="\.\.\/notesSlides\/(notesSlide\d+\.xml)"/);
      const nf = target && zip.file(`ppt/notesSlides/${target[1]}`);
      if (nf) notes = drawingMLText(await nf.async('string')).replace(/^\d+$/gm, '').trim();
    }
    out.push(`--- Slide ${n} ---\n${body || '(no text on slide)'}${notes ? `\n[Speaker notes] ${notes}` : ''}`);
  }
  return { text: out.join('\n\n'), pages: slides.length };
}

function cleanTranscript(raw) {
  return tidy(raw
    .replace(/^WEBVTT.*$/m, '')
    .replace(/^NOTE[\s\S]*?(\n\n|$)/gm, '')
    .replace(/^\d+\s*$/gm, '')
    .replace(/^.*\d{1,2}:\d{2}(:\d{2})?[.,]\d{1,3}\s*-->.*$/gm, '')
    .replace(/<\/?v[^>]*>/g, '')
    .replace(/<[^>]+>/g, '')
    // Captions repeat lines as they scroll; collapse consecutive duplicates and join lines into prose.
    .split('\n').map((l) => l.trim()).filter((l, i, arr) => l && l !== arr[i - 1]).join(' '))
    .replace(/([.?!])\s+/g, '$1\n');
}

const stripHtml = (html) => tidy(decodeXml(html
  .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
  .replace(/<\/(p|div|h\d|li|tr|br)>/gi, '\n')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, '')));

/**
 * @returns {{kind, text, pages?, native?: {mediaType}}} native => also keep the original bytes for vision.
 */
export async function extract(buffer, filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.pdf') {
    let text = '', pages = 0;
    try { const d = await pdfParse(buffer); text = tidy(d.text); pages = d.numpages; } catch { /* scanned or unusual PDF */ }
    const sparse = text.replace(/\s+/g, '').length < Math.max(1, pages) * 120;
    if (sparse && buffer.length > MAX_NATIVE_PDF_BYTES) {
      throw new Error('This PDF looks scanned (no text layer) and is over 24 MB. Split it or run OCR first.');
    }
    return { kind: 'pdf', text, pages, native: sparse ? { mediaType: 'application/pdf' } : null };
  }
  if (ext === '.pptx') return { kind: 'slides', ...(await extractPptx(buffer)) };
  if (ext === '.docx') return { kind: 'document', text: tidy((await mammoth.extractRawText({ buffer })).value) };
  if (ext === '.vtt' || ext === '.srt') return { kind: 'transcript', text: cleanTranscript(buffer.toString('utf8')) };
  if (ext === '.html' || ext === '.htm') return { kind: 'document', text: stripHtml(buffer.toString('utf8')) };
  if (TEXT_EXTS.has(ext)) return { kind: 'text', text: tidy(buffer.toString('utf8')) };
  if (IMAGE_TYPES[ext]) {
    if (buffer.length > MAX_IMAGE_BYTES) throw new Error('Images must be under 5 MB.');
    return { kind: 'image', text: '', native: { mediaType: IMAGE_TYPES[ext] } };
  }
  if (ext === '.ppt' || ext === '.key' || ext === '.doc' || ext === '.pages') {
    throw new Error(`${ext} is a legacy/binary format. Export it to .pptx, .docx or .pdf and upload that.`);
  }
  throw new Error(`Unsupported file type ${ext || '(none)'}. Supported: ${SUPPORTED.join(' ')}`);
}

export const estimateTokens = (chars) => Math.ceil(chars / 3.8);
