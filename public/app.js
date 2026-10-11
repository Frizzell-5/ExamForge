// ExamForge front-end: a small hash-routed SPA, no build step.
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const main = $('#main');
const LETTERS = 'ABCDEFGHIJ';
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* storage unavailable */ } },
};

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body && !(opts.body instanceof FormData) ? JSON.stringify(opts.body) : opts.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), kind === 'err' ? 7000 : 3500);
}

function modal(html, onMount) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="panel modal">${html}</div>`;
  const close = () => back.remove();
  back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('[data-close]')) close(); });
  document.body.append(back);
  onMount?.(back, close);
  return close;
}

// ---- markdown + math -------------------------------------------------------
function md(src) {
  const math = [];
  const keep = (m) => { math.push(m); return `@@M${math.length - 1}@@`; };
  const s = String(src ?? '')
    .replace(/\$\$[\s\S]+?\$\$/g, keep)
    .replace(/\\\[[\s\S]+?\\\]/g, keep)
    .replace(/\\\([\s\S]+?\\\)/g, keep)
    .replace(/(^|[^\\$])(\$[^\s$](?:[^$\n]*?[^\s$])?\$)/g, (_, pre, m) => pre + keep(m));
  const html = DOMPurify.sanitize(marked.parse(s, { breaks: true }));
  return html.replace(/@@M(\d+)@@/g, (_, i) => esc(math[i]));
}
function typeset(el) {
  if (!window.renderMathInElement) { setTimeout(() => window.renderMathInElement && typeset(el), 300); return; }
  window.renderMathInElement(el, {
    delimiters: [
      { left: '$$', right: '$$', display: true }, { left: '\\[', right: '\\]', display: true },
      { left: '$', right: '$', display: false }, { left: '\\(', right: '\\)', display: false },
    ],
    throwOnError: false,
  });
}

// ---- icons -------------------------------------------------------------------
const I = {
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4m0 0-5 5m5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>',
  brain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 1 5 3 3 0 0 0 4 3V3z"/><path d="M15 3a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-1 5 3 3 0 0 1-4 3V3z"/></svg>',
  hammer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m15 12-8.5 8.5a2.1 2.1 0 0 1-3-3L12 9"/><path d="M17.6 15 22 10.6 13.4 2 9 6.4z"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
  scale: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v18M5 21h14M6 7h12"/><path d="m6 7-3 7a3 3 0 0 0 6 0zM18 7l-3 7a3 3 0 0 0 6 0z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>',
  flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 22V4s1-1 4-1 5 2 8 2 4-1 4-1v11s-1 1-4 1-5-2-8-2-4 1-4 1"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>',
};
const KIND = { pdf: ['PDF', 'k-pdf'], slides: ['PPT', 'k-slides'], document: ['DOC', 'k-document'], transcript: ['VTT', 'k-transcript'], text: ['TXT', 'k-text'], image: ['IMG', 'k-image'] };

// ---- app state -------------------------------------------------------------------
const S = { catalog: null, settings: null, runs: new Map() };
let cleanup = null;

const fmtTime = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const fmtDate = (t) => new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const money = (n) => `$${(n || 0).toFixed(n >= 10 ? 1 : 2)}`;
const tokens = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n || 0));
const planMode = () => S.settings?.backend === 'subscription';
const costText = (usage) => (usage?.subscription ? 'Plan' : money(usage?.costUsd));
const modelTag = (m) => `<span class="tag ${/fable/.test(m || '') ? 'fable' : 'opus'}">${esc(shortModel(m))}</span>`;
const typeLabel = (id) => (S.catalog?.types.find((t) => t.id === id) || {}).label || id;
const styleLabel = (id) => (S.catalog?.styles.find((t) => t.id === id) || {}).label || id;

// ---- live workflow runs -------------------------------------------------------------
class Run {
  constructor(id) {
    Object.assign(this, { id, lastSeq: -1, stages: {}, batches: [], questions: [], reviews: [], logs: [], usage: null, blueprint: null, status: 'running', listeners: new Set(), models: {}, config: null, t: 0, startedAt: Date.now() });
    this.es = new EventSource(`/api/jobs/${id}/events`);
    this.es.onmessage = (e) => this.apply(JSON.parse(e.data));
    this.es.onerror = () => { if (this.status !== 'running') this.es.close(); };
  }
  apply(ev) {
    if (ev.seq <= this.lastSeq) return;
    this.lastSeq = ev.seq;
    this.t = ev.t;
    switch (ev.type) {
      case 'init': this.config = ev.config; this.models = ev.models; this.startedAt = Date.now() - ev.t; break;
      case 'stage': this.stages[ev.stage] = { status: ev.status, detail: ev.detail }; this.logs.push({ kind: 'stage', ...ev }); break;
      case 'log': this.logs.push({ kind: 'log', ...ev }); break;
      case 'thinking': {
        const last = this.logs[this.logs.length - 1];
        if (last && last.kind === 'thought' && last.lane === ev.lane && last.stage === ev.stage) last.text += ev.text;
        else this.logs.push({ kind: 'thought', ...ev });
        break;
      }
      case 'blueprint': this.blueprint = ev; break;
      case 'batches': this.batches = ev.batches.map((b) => ({ ...b, status: 'idle' })); break;
      case 'batch': if (this.batches[ev.index]) this.batches[ev.index].status = ev.status; break;
      case 'question': this.questions.push(ev); break;
      case 'review': this.reviews.push(ev); break;
      case 'usage': this.usage = ev.usage; break;
      case 'done': this.status = 'done'; this.examId = ev.examId; this.done = ev; this.es.close(); toast(`Exam ready: ${ev.title}`, 'ok'); break;
      case 'error': this.status = 'error'; this.error = ev.message; this.es.close(); toast(`Workflow failed: ${ev.message}`, 'err'); break;
    }
    updateRunBadge();
    for (const fn of this.listeners) fn(ev);
  }
}
function trackRun(id) {
  if (!S.runs.has(id)) S.runs.set(id, new Run(id));
  return S.runs.get(id);
}
function updateRunBadge() {
  const n = [...S.runs.values()].filter((r) => r.status === 'running').length;
  const b = $('#runBadge');
  b.hidden = !n;
  b.textContent = n;
}

// ---- router ------------------------------------------------------------------------
const routes = {
  library: viewLibrary, forge: viewForge, runs: viewRuns, run: viewRun, exams: viewExams,
  take: viewTake, results: viewResults, print: viewPrint, settings: viewSettings,
};
async function route() {
  if (cleanup) { cleanup(); cleanup = null; }
  const [name = 'library', arg] = location.hash.replace(/^#\/?/, '').split('?')[0].split('/');
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  $$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === name || (name === 'run' && a.dataset.route === 'runs')));
  main.scrollTop = 0;
  main.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    await (routes[name] || viewLibrary)(arg, params);
  } catch (err) {
    main.innerHTML = `<div class="view"><div class="panel empty"><h2>Something went wrong</h2><p class="muted">${esc(err.message)}</p><a class="btn" href="#/library">Back to library</a></div></div>`;
  }
}
window.addEventListener('hashchange', route);

// =====================================================================================
// LIBRARY
// =====================================================================================
async function viewLibrary() {
  const materials = await api('/api/materials');
  const role = store.get('ef-upload-role', 'material');
  const mats = materials.filter((m) => m.role !== 'exam');
  const exams = materials.filter((m) => m.role === 'exam');
  main.innerHTML = `<div class="view">
    <div class="page-head">
      <div><div class="eyebrow">Step 1 · Sources</div><h1>Your <span class="grad-text">study library</span></h1>
      <p class="lede">Drop in lecture slides, PDFs, readings, transcripts and notes. Upload past or practice exams too — the Architect studies their style and adapts new exams to match.</p></div>
      <div class="row"><button class="btn" id="pasteBtn">Paste text / transcript</button><a class="btn primary" href="#/forge">${I.bolt} Forge an exam</a></div>
    </div>
    <div class="dropzone" id="drop">
      <div class="orb">${I.upload}</div>
      <h2>Drop files here or click to browse</h2>
      <p class="muted" style="margin:6px 0 14px">Add them as</p>
      <div class="seg" id="roleSeg">
        <button data-role="material" class="${role === 'material' ? 'on' : ''}">Course material</button>
        <button data-role="exam" class="${role === 'exam' ? 'on' : ''}">Past / practice exam</button>
      </div>
      <div class="formats">${['PDF', 'PPTX', 'DOCX', 'VTT', 'SRT', 'TXT', 'MD', 'HTML', 'CSV', 'PNG', 'JPG'].map((f) => `<span class="tag">${f}</span>`).join('')}</div>
      <p class="faint small" style="margin-top:10px">Scanned PDFs and images are read visually by Claude. Legacy .ppt/.key/.doc: export to PDF or PPTX first.</p>
      <input type="file" id="fileIn" multiple hidden accept="${S.catalog.supported.join(',')}" />
    </div>
    <div id="uploading"></div>
    <div class="grid-2" style="margin-top:24px">
      <div class="panel"><div class="panel-title"><h2>Course material <span class="tag">${mats.length}</span></h2><span class="faint small mono">${tokens(mats.reduce((s, m) => s + m.tokens, 0))} tokens</span></div>
        <div class="src-list">${mats.map(srcRow).join('') || emptyBlock('No material yet', 'Upload slides, readings or transcripts above.')}</div></div>
      <div class="panel"><div class="panel-title"><h2>Reference exams <span class="tag">${exams.length}</span></h2><span class="faint small mono">${tokens(exams.reduce((s, m) => s + m.tokens, 0))} tokens</span></div>
        <div class="src-list">${exams.map(srcRow).join('') || emptyBlock('No past exams yet', 'Upload old exams to mirror their format, difficulty and traps.')}</div></div>
    </div>
  </div>`;

  const drop = $('#drop'), fileIn = $('#fileIn');
  $('#roleSeg').addEventListener('click', (e) => {
    e.stopPropagation();
    const b = e.target.closest('button'); if (!b) return;
    store.set('ef-upload-role', b.dataset.role);
    $$('#roleSeg button').forEach((x) => x.classList.toggle('on', x === b));
  });
  drop.addEventListener('click', (e) => { if (!e.target.closest('#roleSeg')) fileIn.click(); });
  fileIn.addEventListener('change', () => uploadFiles([...fileIn.files]));
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
  drop.addEventListener('drop', (e) => uploadFiles([...e.dataTransfer.files]));
  $('#pasteBtn').addEventListener('click', pasteModal);
  bindSrcRows($('.view', main));
}

function emptyBlock(title, sub) {
  return `<div class="empty">${I.doc}<div><b>${esc(title)}</b></div><div class="small">${esc(sub)}</div></div>`;
}

function srcRow(m) {
  const [label, cls] = KIND[m.kind] || ['FILE', 'k-text'];
  return `<div class="src" data-id="${m.id}">
    <div class="src-icon ${cls}">${label}</div>
    <div style="min-width:0"><div class="src-name" title="${esc(m.name)}">${esc(m.name)}</div>
      <div class="src-meta"><span>${m.kind}${m.pages ? ` · ${m.pages} ${m.kind === 'slides' ? 'slides' : 'pages'}` : ''}</span><span class="mono">~${tokens(m.tokens)} tok</span>${m.native ? '<span class="tag opus">vision</span>' : ''}<span>${fmtDate(m.createdAt)}</span></div></div>
    <div class="row">
      <button class="btn sm ghost" data-act="role" title="Switch between course material and reference exam">${m.role === 'exam' ? '→ Material' : '→ Exam'}</button>
      <button class="btn sm ghost" data-act="view" title="Preview extracted text">${I.eye}</button>
      <button class="btn sm ghost danger" data-act="del" title="Delete">${I.trash}</button>
    </div></div>`;
}

function bindSrcRows(root) {
  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]'); if (!btn) return;
    const row = btn.closest('.src'); const id = row?.dataset.id; if (!id) return;
    if (btn.dataset.act === 'del') {
      if (!confirm('Delete this source from your library?')) return;
      await api(`/api/materials/${id}`, { method: 'DELETE' }); route();
    } else if (btn.dataset.act === 'role') {
      const m = await api(`/api/materials/${id}/text`);
      await api(`/api/materials/${id}`, { method: 'PATCH', body: { role: m.role === 'exam' ? 'material' : 'exam' } }); route();
    } else if (btn.dataset.act === 'view') {
      const m = await api(`/api/materials/${id}/text`);
      modal(`<div class="panel-title"><h2>${esc(m.name)}</h2><button class="btn sm" data-close>Close</button></div>
        <p class="faint small">${m.native ? 'This file is also sent to Claude as a visual document/image. ' : ''}${m.chars.toLocaleString()} characters extracted.</p>
        <pre class="mono small" style="white-space:pre-wrap;max-height:60vh;overflow:auto;background:var(--bg-2);padding:14px;border-radius:12px">${esc(m.text.slice(0, 30000) || '(no text layer — Claude will read this visually)')}${m.text.length > 30000 ? '\n\n… (preview truncated; the full text is used for generation)' : ''}</pre>`);
    }
  });
}

async function uploadFiles(files) {
  if (!files.length) return;
  const role = store.get('ef-upload-role', 'material');
  const box = $('#uploading');
  box.innerHTML = `<div class="panel" style="margin-top:16px"><div class="row"><div class="spinner" style="width:22px;height:22px;border-width:2px"></div><span>Extracting ${files.length} file${files.length > 1 ? 's' : ''}…</span></div></div>`;
  const fd = new FormData();
  fd.append('role', role);
  for (const f of files) fd.append('files', f, f.name);
  try {
    const results = await api('/api/materials', { method: 'POST', body: fd });
    for (const r of results) r.ok ? toast(`Added ${r.material.name}`, 'ok') : toast(`${r.name}: ${r.error}`, 'err');
  } catch (err) { toast(err.message, 'err'); }
  route();
}

function pasteModal() {
  modal(`<div class="panel-title"><h2>Paste text or a transcript</h2><button class="btn sm" data-close>Close</button></div>
    <label class="field"><span>Name</span><input type="text" id="pName" placeholder="e.g. Lecture 7 transcript" /></label>
    <div class="row" style="margin-bottom:14px">
      <div class="seg" id="pKind"><button class="on" data-v="text">Notes / text</button><button data-v="transcript">Transcript</button></div>
      <div class="seg" id="pRole"><button class="on" data-v="material">Course material</button><button data-v="exam">Past exam</button></div>
    </div>
    <label class="field"><span>Content</span><textarea id="pText" rows="14" placeholder="Paste here…"></textarea></label>
    <div class="row"><span class="spacer"></span><button class="btn primary" id="pSave">Add to library</button></div>`, (el, close) => {
    const segVal = (id) => $(`#${id} .on`, el).dataset.v;
    $$('.seg', el).forEach((seg) => seg.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; $$('button', seg).forEach((x) => x.classList.toggle('on', x === b)); }));
    $('#pSave', el).addEventListener('click', async () => {
      try {
        await api('/api/materials/text', { method: 'POST', body: { name: $('#pName', el).value || 'Pasted text', text: $('#pText', el).value, kind: segVal('pKind'), role: segVal('pRole') } });
        close(); toast('Added to library', 'ok'); route();
      } catch (err) { toast(err.message, 'err'); }
    });
  });
}

// =====================================================================================
// FORGE (exam configuration)
// =====================================================================================
const PRESETS = {
  'Professor\'s mix': ['best_answer', 'which_false', 'except', 'scenario', 'roman_numeral', 'assertion_reason', 'data_interpretation', 'least_likely', 'error_spotting', 'cause_effect'],
  'Board exam': ['scenario', 'next_step', 'most_likely', 'least_likely', 'except', 'data_interpretation', 'best_answer'],
  'Negation gauntlet': ['which_false', 'except', 'least_likely', 'double_negation', 'two_statement', 'roman_numeral'],
  'Quant / problem-solving': ['multi_step_calc', 'data_interpretation', 'error_spotting', 'cause_effect', 'counterexample', 'best_answer'],
  'Research methods': ['experimental_design', 'data_interpretation', 'counterexample', 'compare_contrast', 'error_spotting', 'assertion_reason'],
};
const DEFAULT_FORM = {
  title: '', count: 25, difficulty: 'graduate', deception: 4, optionsCount: 4, timeLimit: 40, mode: 'exam', redTeam: true,
  adaptMode: 'mirror', focus: '', notes: '',
  types: { mcq: 5, multi_select: 1, true_false: 1, fill_blank: 0, numeric: 0, matching: 0, short_answer: 1, essay: 0 },
  styles: PRESETS['Professor\'s mix'], materialIds: [], referenceIds: [],
};
const DECEPTION_LABELS = ['', 'Straightforward', 'Moderate', 'Tricky', 'Deceptive', 'Ruthless'];

function estimate(f, materials) {
  const sel = materials.filter((m) => f.materialIds.includes(m.id) || f.referenceIds.includes(m.id));
  const T = sel.reduce((s, m) => s + m.tokens + (m.native ? (m.pages || 1) * 1600 : 0), 0) + 3000;
  const n = f.count;
  const batches = Math.ceil(n / 5);
  const hard = ['graduate', 'qualifying'].includes(f.difficulty);
  const arch = (T * 10 + (n * 160 + (hard ? 14000 : 8000)) * 50) / 1e6;
  const forgeOut = n * (hard ? 1700 : 1200);
  const forge = (T * 1.25 * 4 + (batches - 1) * T * 0.2 + forgeOut * 20 + batches * 2500 * 4) / 1e6;
  const chunks = Math.ceil(n / 20);
  const red = f.redTeam ? (chunks * (T * 1.25 * 10 + n / chunks * 900 * 10) + (n * 400 + chunks * 6000) * 50) / 1e6 : 0;
  return { T, arch, forge, red, total: arch + forge + red, batches };
}

async function viewForge(_, params) {
  const materials = await api('/api/materials');
  const f = { ...DEFAULT_FORM, ...store.get('ef-forge', {}) };
  f.types = { ...DEFAULT_FORM.types, ...f.types };
  const ids = new Set(materials.map((m) => m.id));
  f.materialIds = f.materialIds.filter((id) => ids.has(id));
  f.referenceIds = f.referenceIds.filter((id) => ids.has(id));
  if (!f.materialIds.length && !f.referenceIds.length) {
    f.materialIds = materials.filter((m) => m.role !== 'exam').map((m) => m.id);
    f.referenceIds = materials.filter((m) => m.role === 'exam').map((m) => m.id);
  }
  const save = () => store.set('ef-forge', f);
  const C = S.catalog;

  const render = () => {
    const est = estimate(f, materials);
    const mats = materials.filter((m) => m.role !== 'exam');
    const refs = materials.filter((m) => m.role === 'exam');
    const typeTotal = Object.values(f.types).reduce((a, b) => a + b, 0);
    const usesMcq = (f.types.mcq || 0) + (f.types.multi_select || 0) > 0;
    const diffIdx = { foundational: 1, intermediate: 2, advanced: 3, graduate: 4, qualifying: 5, ramp: 3 };
    main.innerHTML = `<div class="view">
      <div class="page-head"><div><div class="eyebrow">Step 2 · Configure</div><h1>Forge a <span class="grad-text">new exam</span></h1>
        <p class="lede">Every exam is unique. ${esc(shortModel(S.settings.models.thinker))} architects the blueprint and red-teams the result; ${esc(shortModel(S.settings.models.builder))} writes every question in parallel.</p></div></div>
      <div class="grid-forge">
        <div>
          <div class="panel">
            <div class="panel-title"><h2><span class="step-num">01</span> Sources</h2><a class="btn sm ghost" href="#/library">Manage library</a></div>
            ${materials.length ? '' : `<div class="empty">${I.doc}<div>Your library is empty.</div><a class="btn primary" style="margin-top:12px" href="#/library">Upload material</a></div>`}
            ${mats.length ? `<div class="faint small" style="margin-bottom:8px">COURSE MATERIAL</div>${mats.map((m) => srcCheck(m, f.materialIds.includes(m.id), 'materialIds')).join('')}` : ''}
            ${refs.length ? `<div class="faint small" style="margin:16px 0 8px">REFERENCE EXAMS — the Architect adapts to these</div>${refs.map((m) => srcCheck(m, f.referenceIds.includes(m.id), 'referenceIds')).join('')}
              <div style="margin-top:12px"><div class="faint small" style="margin-bottom:8px">ADAPTATION MODE</div>
              <div class="chips" id="adaptChips">${C.adaptModes.map((a) => `<span class="chip ${f.adaptMode === a.id ? 'on' : ''}" data-v="${a.id}" title="${esc(a.blurb)}">${esc(a.label)}</span>`).join('')}</div>
              <p class="faint small" style="margin:8px 0 0">${esc(C.adaptModes.find((a) => a.id === f.adaptMode)?.blurb || '')}</p></div>` : ''}
          </div>

          <div class="panel">
            <div class="panel-title"><h2><span class="step-num">02</span> Shape & difficulty</h2></div>
            <label class="field"><span>Exam title (optional — the Architect will name it otherwise)</span><input type="text" id="fTitle" value="${esc(f.title)}" placeholder="e.g. Advanced Immunology · Midterm 2" /></label>
            <label class="field"><span>Number of questions: <b class="mono" id="countOut">${f.count}</b></span><input type="range" id="fCount" min="5" max="150" step="1" value="${f.count}" /></label>
            <div class="faint small" style="margin-bottom:8px">DIFFICULTY</div>
            <div class="diff-cards" id="diffCards">${C.difficulties.map((d) => `<div class="diff-card ${f.difficulty === d.id ? 'on' : ''}" data-v="${d.id}"><b>${esc(d.label)}</b><span>${esc(d.blurb)}</span><div class="bars">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= diffIdx[d.id] ? 'lit' : ''}"></i>`).join('')}</div></div>`).join('')}</div>
            <hr class="sep" />
            <label class="field"><span>Deception level: <b id="decOut">${f.deception} · ${DECEPTION_LABELS[f.deception]}</b></span><input type="range" id="fDec" min="1" max="5" step="1" value="${f.deception}" /></label>
            <div class="row" style="gap:18px;align-items:flex-start">
              <label class="field" style="flex:1;min-width:160px"><span>Choices per MCQ</span><div class="seg" id="optSeg">${[3, 4, 5, 6].map((n) => `<button data-v="${n}" class="${f.optionsCount === n ? 'on' : ''}">${n}</button>`).join('')}</div></label>
              <label class="field" style="flex:1;min-width:160px"><span>Time limit (minutes, 0 = untimed)</span><input type="number" id="fTime" min="0" max="600" value="${f.timeLimit}" /></label>
              <label class="field" style="flex:1;min-width:160px"><span>Mode</span><div class="seg" id="modeSeg"><button data-v="exam" class="${f.mode === 'exam' ? 'on' : ''}">Exam</button><button data-v="tutor" class="${f.mode === 'tutor' ? 'on' : ''}">Tutor</button></div></label>
            </div>
          </div>

          <div class="panel">
            <div class="panel-title"><h2><span class="step-num">03</span> Question types</h2><span class="faint small">relative weights</span></div>
            <div class="type-grid">${C.types.map((t) => `<div class="type-row ${f.types[t.id] ? 'on' : ''}"><div><div class="name">${esc(t.label)}</div><div class="hint">${esc(t.hint)}</div></div>
              <div class="stepper" data-type="${t.id}"><button data-d="-1">−</button><output>${f.types[t.id] || 0}</output><button data-d="1">+</button></div></div>`).join('')}</div>
            <p class="faint small" style="margin:12px 0 0">≈ ${Object.entries(f.types).filter(([, w]) => w).map(([k, w]) => `${Math.round((w / Math.max(1, typeTotal)) * f.count)} ${typeLabel(k).toLowerCase()}`).join(' · ') || 'choose at least one type'}</p>
          </div>

          <div class="panel" style="${usesMcq ? '' : 'opacity:.5'}">
            <div class="panel-title"><h2><span class="step-num">04</span> Multiple-choice styles</h2><div class="row"><button class="btn sm ghost" id="allStyles">All</button><button class="btn sm ghost" id="noStyles">None</button></div></div>
            <div class="chips" style="margin-bottom:14px">${Object.keys(PRESETS).map((p) => `<span class="chip" data-preset="${esc(p)}">✦ ${esc(p)}</span>`).join('')}</div>
            <div class="chips" id="styleChips">${C.styles.map((s) => `<span class="chip ${f.styles.includes(s.id) ? 'on' : ''}" data-v="${s.id}" title="${esc(s.example)}">${esc(s.label)}</span>`).join('')}</div>
          </div>

          <div class="panel">
            <div class="panel-title"><h2><span class="step-num">05</span> Focus & instructions</h2></div>
            <label class="field"><span>Focus topics (optional)</span><input type="text" id="fFocus" value="${esc(f.focus)}" placeholder="e.g. T-cell activation, MHC restriction, complement cascade" /></label>
            <label class="field"><span>Notes to the Architect (optional)</span><textarea id="fNotes" rows="3" placeholder="e.g. My professor loves questions that hinge on exceptions; include at least two calculation questions; ignore lecture 3.">${esc(f.notes)}</textarea></label>
            <label class="switch"><input type="checkbox" id="fRed" ${f.redTeam ? 'checked' : ''}/><span class="track"></span><span><b>Red-team review</b> <span class="muted small">— Fable 5.1 attacks every question for wrong keys, ambiguity and giveaways, then repairs them.</span></span></label>
          </div>
        </div>

        <div class="sticky">
          <div class="panel">
            <div class="eyebrow">Workflow preview</div>
            <div class="mini-pipe">
              <div><span class="n">1</span>Ingest ${f.materialIds.length + f.referenceIds.length} sources <span class="spacer"></span><span class="mono faint small">~${tokens(est.T)}</span></div>
              <div><span class="n">2</span>Architect blueprint <span class="spacer"></span>${modelTag(S.settings.models.thinker)}</div>
              <div><span class="n">3</span>Forge ${est.batches} parallel batches <span class="spacer"></span>${modelTag(S.settings.models.builder)}</div>
              <div style="${f.redTeam ? '' : 'opacity:.4'}"><span class="n">4</span>Red-team review <span class="spacer"></span>${modelTag(S.settings.models.thinker)}</div>
              <div><span class="n">5</span>Calibrate answer key <span class="spacer"></span><span class="tag">local</span></div>
            </div>
            <hr class="sep" />
            ${planMode() ? `<div class="estimate"><div style="font-weight:700"><span>Cost</span><span class="tag good">Included in your Claude plan</span></div></div>
            <p class="faint small">Runs through Claude Code on your subscription. Large exams use a good share of your plan's usage limits; if you hit a limit, wait for it to reset or lower the question count.</p>` : `<div class="estimate">
              <div><span class="muted">Architect</span><span class="mono">${money(est.arch)}</span></div>
              <div><span class="muted">Forge</span><span class="mono">${money(est.forge)}</span></div>
              <div><span class="muted">Red team</span><span class="mono">${money(est.red)}</span></div>
              <div style="font-weight:700"><span>Rough API cost</span><span class="mono">≈ ${money(est.total)}</span></div>
            </div>
            <p class="faint small">Rough estimate from source size and question count; the live meter shows the real figure.</p>`}
            <button class="btn hot xl" id="forgeBtn" style="width:100%;justify-content:center;margin-top:8px" ${f.materialIds.length + f.referenceIds.length && typeTotal ? '' : 'disabled'}>${I.bolt} Forge exam</button>
          </div>
        </div>
      </div></div>`;
    bind();
  };

  const rerender = () => { const y = main.scrollTop; save(); render(); main.scrollTop = y; };
  const bind = () => {
    $$('.src-check').forEach((el) => el.addEventListener('click', (e) => {
      e.preventDefault();
      const list = f[el.dataset.list];
      const i = list.indexOf(el.dataset.id);
      i >= 0 ? list.splice(i, 1) : list.push(el.dataset.id);
      rerender();
    }));
    $('#adaptChips')?.addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (c) { f.adaptMode = c.dataset.v; rerender(); } });
    $('#fTitle').addEventListener('input', (e) => { f.title = e.target.value; save(); });
    $('#fCount').addEventListener('input', (e) => { f.count = +e.target.value; $('#countOut').textContent = f.count; });
    $('#fCount').addEventListener('change', rerender);
    $('#diffCards').addEventListener('click', (e) => { const c = e.target.closest('.diff-card'); if (c) { f.difficulty = c.dataset.v; rerender(); } });
    $('#fDec').addEventListener('input', (e) => { f.deception = +e.target.value; $('#decOut').textContent = `${f.deception} · ${DECEPTION_LABELS[f.deception]}`; save(); });
    $('#optSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { f.optionsCount = +b.dataset.v; rerender(); } });
    $('#modeSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { f.mode = b.dataset.v; rerender(); } });
    $('#fTime').addEventListener('change', (e) => { f.timeLimit = Math.max(0, +e.target.value || 0); save(); });
    $$('.stepper').forEach((st) => st.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      f.types[st.dataset.type] = Math.max(0, Math.min(9, (f.types[st.dataset.type] || 0) + Number(b.dataset.d)));
      rerender();
    }));
    $('#styleChips').addEventListener('click', (e) => {
      const c = e.target.closest('.chip'); if (!c) return;
      const i = f.styles.indexOf(c.dataset.v);
      i >= 0 ? f.styles.splice(i, 1) : f.styles.push(c.dataset.v);
      rerender();
    });
    $$('[data-preset]').forEach((c) => c.addEventListener('click', () => { f.styles = [...PRESETS[c.dataset.preset]]; rerender(); }));
    $('#allStyles').addEventListener('click', () => { f.styles = C.styles.map((s) => s.id); rerender(); });
    $('#noStyles').addEventListener('click', () => { f.styles = []; rerender(); });
    $('#fFocus').addEventListener('input', (e) => { f.focus = e.target.value; save(); });
    $('#fNotes').addEventListener('input', (e) => { f.notes = e.target.value; save(); });
    $('#fRed').addEventListener('change', (e) => { f.redTeam = e.target.checked; rerender(); });
    $('#forgeBtn').addEventListener('click', async () => {
      const btn = $('#forgeBtn');
      btn.disabled = true;
      try {
        const { jobId } = await api('/api/generate', { method: 'POST', body: { ...f, styles: f.styles.length ? f.styles : ['best_answer'] } });
        trackRun(jobId);
        location.hash = `#/run/${jobId}`;
      } catch (err) { toast(err.message, 'err'); btn.disabled = false; }
    });
  };
  render();
}

function srcCheck(m, on, list) {
  const [label, cls] = KIND[m.kind] || ['FILE', 'k-text'];
  return `<label class="src-check ${on ? 'on' : ''}" data-id="${m.id}" data-list="${list}">
    <input type="checkbox" ${on ? 'checked' : ''} tabindex="-1" />
    <div style="min-width:0;display:flex;align-items:center;gap:10px"><span class="src-icon ${cls}" style="width:28px;height:28px;border-radius:8px;font-size:8.5px">${label}</span><span class="src-name">${esc(m.name)}</span></div>
    <span class="mono faint small">~${tokens(m.tokens)}${m.native ? ' + vision' : ''}</span></label>`;
}

// =====================================================================================
// WORKFLOW (live pipeline)
// =====================================================================================
const STAGE_META = {
  ingest: { label: 'Ingest', icon: I.doc, who: 'local' },
  architect: { label: 'Architect', icon: I.brain, who: 'thinker' },
  forge: { label: 'Forge', icon: I.hammer, who: 'builder' },
  redteam: { label: 'Red Team', icon: I.shield, who: 'thinker' },
  calibrate: { label: 'Calibrate', icon: I.scale, who: 'local' },
  finalize: { label: 'Ready', icon: I.check, who: 'local' },
};
const shortModel = (m) => (m || '').replace('claude-', '').replace(/-(\d)-(\d)$/, ' $1.$2').replace(/-(\d)$/, ' $1');

async function viewRuns() {
  const jobs = await api('/api/jobs');
  for (const j of jobs) trackRun(j.id);
  const runs = [...S.runs.values()].sort((a, b) => b.startedAt - a.startedAt);
  main.innerHTML = `<div class="view"><div class="page-head"><div><div class="eyebrow">Live</div><h1>Workflows</h1><p class="lede">Every exam generation since ExamForge started. Open one to watch the agents work.</p></div><a class="btn primary" href="#/forge">${I.bolt} New exam</a></div>
    <div class="exam-grid">${runs.map((r) => `<a class="panel exam-card" href="#/run/${r.id}" style="text-decoration:none;color:inherit">
      <div class="row"><span class="tag ${r.status === 'done' ? 'good' : r.status === 'error' ? 'bad' : 'opus'}">${r.status}</span><span class="spacer"></span><span class="faint small">${fmtDate(r.startedAt)}</span></div>
      <h3>${esc(r.blueprint?.title || r.config?.title || 'Untitled exam')}</h3>
      <div class="faint small">${r.config ? `${r.config.count} questions · ${r.config.difficulty}` : ''}${r.usage ? ` · ${costText(r.usage)}` : ''}</div></a>`).join('') || `<div class="panel empty">No workflows yet. <a href="#/forge">Forge your first exam →</a></div>`}</div></div>`;
}

async function viewRun(id) {
  const run = trackRun(id);
  main.innerHTML = `<div class="view">
    <div class="wf-head">
      <div><div class="eyebrow" id="wfEyebrow">Workflow · ${esc(id)}</div><h1 id="wfTitle">${esc(run.blueprint?.title || run.config?.title || 'Forging your exam')}</h1>
        <p class="lede" id="wfSub">${esc(run.blueprint?.overview || 'The agents are reading your material…')}</p></div>
      <div class="meters">
        <div class="meter"><b id="mTime">0:00</b><span>Elapsed</span></div>
        <div class="meter"><b id="mQ">0</b><span>Questions</span></div>
        <div class="meter"><b id="mTok">0</b><span>Tokens</span></div>
        <div class="meter"><b id="mCost">$0.00</b><span>API cost</span></div>
      </div>
    </div>
    <div class="pipeline" id="pipe"></div>
    <div id="finale"></div>
    <div class="wf-body">
      <div>
        <div class="panel-title"><h2>Neural stream</h2><span class="faint small">summarized reasoning from each agent</span></div>
        <div class="console" id="console"></div>
      </div>
      <div>
        <div class="panel" id="bpPanel"><div class="panel-title"><h2>Blueprint</h2><span id="tagThinker1"></span></div><div id="bp" class="muted small">Waiting for the Architect…</div></div>
        <div class="panel"><div class="panel-title"><h2>Forge</h2><span id="tagBuilder"></span></div><div class="batch-grid" id="batches"><span class="faint small">Batches appear once the blueprint is ready.</span></div>
          <div class="ticker" id="ticker" style="margin-top:14px"></div></div>
        <div class="panel"><div class="panel-title"><h2>Red team verdicts</h2><span id="tagThinker2"></span></div><div id="reviews" class="small muted">${run.config?.redTeam === false ? 'Disabled for this exam.' : 'Pending.'}</div></div>
      </div>
    </div></div>`;

  const con = $('#console');
  const laneTag = (stage) => {
    const who = STAGE_META[stage]?.who;
    return who === 'thinker' ? 'fable' : who === 'builder' ? 'opus' : 'sys';
  };
  const laneName = (l) => (l.lane && l.lane.startsWith('batch-') ? `forge#${+l.lane.split('-')[1] + 1}` : l.lane && l.lane.startsWith('chunk-') ? `review#${+l.lane.split('-')[1] + 1}` : l.stage);
  const lineHtml = (l) => {
    const ts = `<span class="ts">${fmtTime(l.t)}</span>`;
    if (l.kind === 'thought') return `${ts}<span class="lane ${laneTag(l.stage)}">${esc(laneName(l))}</span><span class="thought">${esc(l.text)}</span>`;
    if (l.kind === 'stage') return `${ts}<span class="lane sys">${esc(l.stage)}</span>${l.status === 'active' ? '▸ ' : l.status === 'done' ? '✓ ' : ''}${esc(l.detail)}`;
    return `${ts}<span class="lane ${laneTag(l.stage)}">${esc(l.stage)}</span><span class="${l.level === 'warn' ? 'warn' : ''}">${esc(l.text)}</span>`;
  };
  let rendered = 0;
  const renderConsole = () => {
    const stick = con.scrollTop + con.clientHeight >= con.scrollHeight - 40;
    // The last line may still be growing (streamed thinking), so re-render it.
    if (rendered > 0) con.lastElementChild?.remove(), rendered--;
    for (; rendered < run.logs.length; rendered++) {
      const d = document.createElement('div');
      d.className = 'ln';
      d.innerHTML = lineHtml(run.logs[rendered]);
      con.append(d);
    }
    con.lastElementChild?.classList.toggle('cursor', run.status === 'running');
    $$('.ln.cursor', con).forEach((el) => el !== con.lastElementChild && el.classList.remove('cursor'));
    if (stick) con.scrollTop = con.scrollHeight;
  };

  const renderPipe = () => {
    const pipe = $('#pipe');
    pipe.innerHTML = Object.entries(STAGE_META).map(([k, m]) => {
      const st = run.stages[k] || { status: 'idle', detail: '' };
      const model = m.who === 'thinker' ? run.models.thinker : m.who === 'builder' ? run.models.builder : null;
      return `<div class="node ${st.status} ${/fable/.test(model || '') ? 'fable' : ''}" data-stage="${k}">
        <div class="ring">${m.icon}</div><div class="label">${m.label}</div>
        <div class="model-chip">${model ? modelTag(model) : '<span class="tag">local</span>'}</div>
        <div class="detail">${esc(st.detail || (st.status === 'idle' ? 'Waiting' : ''))}</div></div>`;
    }).join('') + '<svg class="wires" id="wires"><defs><linearGradient id="wireGrad"><stop offset="0" stop-color="#8b7bff"/><stop offset="1" stop-color="#2fd6f5"/></linearGradient></defs></svg>';
    drawWires();
  };
  const drawWires = () => {
    const svg = $('#wires'); if (!svg) return;
    const box = $('#pipe').getBoundingClientRect();
    const nodes = $$('.node', $('#pipe'));
    const keys = Object.keys(STAGE_META);
    let paths = '';
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = $('.ring', nodes[i]).getBoundingClientRect(), b = $('.ring', nodes[i + 1]).getBoundingClientRect();
      if (Math.abs(a.top - b.top) > 10) continue;
      const x1 = nodes[i].getBoundingClientRect().right - box.left, x2 = nodes[i + 1].getBoundingClientRect().left - box.left;
      const y = a.top + a.height / 2 - box.top;
      const s1 = run.stages[keys[i]]?.status, s2 = run.stages[keys[i + 1]]?.status;
      const cls = s2 === 'active' || (s1 === 'done' && !s2 && run.status === 'running') ? 'flow' : s1 === 'done' && (s2 === 'done' || s2 === 'skipped') ? 'lit' : '';
      paths += `<path class="wire ${cls}" d="M${x1 - 1} ${y} C ${x1 + 8} ${y}, ${x2 - 8} ${y}, ${x2 + 1} ${y}"/>`;
    }
    svg.querySelectorAll('path').forEach((p) => p.remove());
    svg.insertAdjacentHTML('beforeend', paths);
  };

  const renderBlueprint = () => {
    if (!run.blueprint) return;
    const b = run.blueprint;
    $('#wfTitle').textContent = b.title;
    $('#wfSub').textContent = b.overview;
    const maxW = Math.max(...b.concepts.map((c) => c.weight), 1);
    $('#bp').innerHTML = `<div class="concept-cloud">${b.concepts.map((c) => `<span class="chip on" style="font-size:${11 + (c.weight / maxW) * 3.5}px;opacity:${0.55 + (c.weight / maxW) * 0.45}" title="${esc(c.key_facts)}">${esc(c.name)}</span>`).join('')}</div>
      ${b.misconceptions.length ? `<div class="faint small" style="margin:14px 0 6px">TRAPS BEING SET</div><ul style="margin:0;padding-left:18px">${b.misconceptions.slice(0, 8).map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
      ${b.styleProfile ? `<div class="faint small" style="margin:14px 0 6px">STYLE PROFILE</div><div>${esc(b.styleProfile)}</div>` : ''}`;
  };
  const renderBatches = () => {
    if (!run.batches.length) return;
    $('#batches').innerHTML = run.batches.map((b) => `<div class="batch ${b.status}" title="Questions ${b.specs.join(', ')}">${b.status === 'done' ? '✓' : b.status === 'error' ? '!' : `${b.specs[0]}–${b.specs[b.specs.length - 1]}`}</div>`).join('');
  };
  let tickerCount = 0;
  const renderTicker = () => {
    const t = $('#ticker');
    for (; tickerCount < run.questions.length; tickerCount++) {
      const q = run.questions[tickerCount];
      const d = document.createElement('div');
      d.className = 'qcard-mini';
      d.innerHTML = `<div class="t"><span class="tag">Q${q.n ?? '?'}</span><span class="tag opus">${esc(typeLabel(q.qtype))}</span>${q.style && /mcq|multi/.test(q.qtype) ? `<span class="tag">${esc(styleLabel(q.style))}</span>` : ''}</div><div class="muted">${esc(q.stem)}${q.stem.length >= 220 ? '…' : ''}</div>`;
      t.prepend(d);
    }
  };
  let reviewCount = 0;
  const renderReviews = () => {
    if (!run.reviews.length) return;
    const box = $('#reviews');
    if (reviewCount === 0) box.innerHTML = '';
    for (; reviewCount < run.reviews.length; reviewCount++) {
      const r = run.reviews[reviewCount];
      if (r.verdict === 'pass' && run.reviews.length > 12) continue;
      box.insertAdjacentHTML('beforeend', `<div class="review-item"><span class="tag ${r.verdict === 'fixed' ? 'warn' : 'good'}">${esc(r.id)} ${r.verdict}</span><span>${esc(r.issue || 'Holds up.')}</span></div>`);
    }
    const fixed = run.reviews.filter((r) => r.verdict === 'fixed').length;
    $('#bpPanel').dataset.fixed = fixed;
  };
  const renderMeters = () => {
    const u = run.usage;
    $('#mQ').textContent = run.questions.length;
    if (u) {
      const tot = Object.values(u.byModel).reduce((s, m) => s + m.input + m.output + m.cacheRead + m.cacheWrite, 0);
      $('#mTok').textContent = tokens(tot);
      $('#mCost').textContent = costText(u);
    }
  };
  const renderFinale = () => {
    const el = $('#finale');
    if (run.status === 'done' && run.done) {
      el.innerHTML = `<div class="finale"><div class="eyebrow">Forged in ${fmtTime(run.done.durationMs)}</div><h2 class="grad-text">${esc(run.done.title)}</h2>
        <p class="muted">${run.done.count} questions · ${run.reviews.filter((r) => r.verdict === 'fixed').length} hardened by the red team · ${run.usage?.subscription ? 'included in your plan' : money(run.usage?.costUsd)}</p>
        <div class="row" style="justify-content:center;margin-top:16px"><a class="btn hot xl" href="#/take/${run.examId}">${I.play} Begin exam</a><a class="btn xl" href="#/take/${run.examId}?mode=tutor">Tutor mode</a><a class="btn xl ghost" href="#/print/${run.examId}">${I.print} Print</a></div></div>`;
      if (!run.celebrated) { run.celebrated = true; burst(); }
    } else if (run.status === 'error') {
      el.innerHTML = `<div class="finale" style="background:var(--panel)"><h2 style="color:var(--bad)">Workflow failed</h2><p class="muted">${esc(run.error)}</p><a class="btn" href="#/forge">Back to configuration</a></div>`;
    }
  };

  const renderTags = () => {
    if (!run.models.thinker) return;
    $('#tagThinker1').innerHTML = $('#tagThinker2').innerHTML = modelTag(run.models.thinker);
    $('#tagBuilder').innerHTML = modelTag(run.models.builder);
  };
  const renderAll = () => { renderTags(); renderPipe(); renderConsole(); renderBlueprint(); renderBatches(); renderTicker(); renderReviews(); renderMeters(); renderFinale(); };
  renderAll();
  const onEvent = (ev) => {
    if (ev.type === 'init') renderTags();
    if (ev.type === 'stage') { renderPipe(); }
    if (ev.type === 'blueprint') renderBlueprint();
    if (ev.type === 'batches' || ev.type === 'batch') renderBatches();
    if (ev.type === 'question') renderTicker();
    if (ev.type === 'review') renderReviews();
    if (ev.type === 'usage' || ev.type === 'question') renderMeters();
    if (ev.type === 'done' || ev.type === 'error') { renderPipe(); renderFinale(); }
    renderConsole();
  };
  run.listeners.add(onEvent);
  const tick = setInterval(() => { $('#mTime').textContent = fmtTime(run.status === 'running' ? Date.now() - run.startedAt : run.t); }, 500);
  window.addEventListener('resize', drawWires);
  cleanup = () => { run.listeners.delete(onEvent); clearInterval(tick); window.removeEventListener('resize', drawWires); };
}

// =====================================================================================
// EXAMS LIST
// =====================================================================================
async function viewExams() {
  const exams = await api('/api/exams');
  main.innerHTML = `<div class="view"><div class="page-head"><div><div class="eyebrow">Step 3 · Practice</div><h1>My <span class="grad-text">exams</span></h1><p class="lede">Take them again, in exam or tutor mode, or forge harder and remedial versions from your results.</p></div><a class="btn primary" href="#/forge">${I.bolt} New exam</a></div>
    <div class="exam-grid">${exams.map((e) => `<div class="panel exam-card" data-id="${e.id}">
      <div class="row"><span class="tag">${e.count} Q</span><span class="tag">${esc(e.config.difficulty)}</span><span class="tag">deception ${e.config.deception}/5</span><span class="spacer"></span>${e.best !== null ? `<span class="score-pill" style="color:${scoreColor(e.best)}">best ${e.best}%</span>` : ''}</div>
      <h3>${esc(e.title)}</h3>
      <div class="faint small">${fmtDate(e.createdAt)} · ${e.attempts} attempt${e.attempts === 1 ? '' : 's'} · ${e.subscription ? 'plan' : money(e.costUsd)}${e.config.timeLimit ? ` · ${e.config.timeLimit} min` : ''}</div>
      <div class="row" style="margin-top:auto">
        <a class="btn sm primary" href="#/take/${e.id}">${I.play} Take</a>
        <a class="btn sm" href="#/take/${e.id}?mode=tutor">Tutor</a>
        ${e.last ? `<a class="btn sm ghost" href="#/results/${e.last.id}">Last result</a>` : ''}
        <span class="spacer"></span>
        <button class="btn sm ghost" data-act="harder" title="Forge a harder version">⇪</button>
        <a class="btn sm ghost" href="#/print/${e.id}" title="Print">${I.print}</a>
        <button class="btn sm ghost danger" data-act="del" title="Delete">${I.trash}</button>
      </div></div>`).join('') || `<div class="panel empty">${I.doc}<div>No exams yet.</div><a class="btn primary" style="margin-top:12px" href="#/forge">Forge your first exam</a></div>`}</div></div>`;
  $('.view', main).addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.closest('[data-id]').dataset.id;
    if (b.dataset.act === 'del') {
      if (!confirm('Delete this exam? Attempts remain in your history.')) return;
      await api(`/api/exams/${id}`, { method: 'DELETE' }); route();
    } else if (b.dataset.act === 'harder') {
      const { jobId } = await api(`/api/exams/${id}/variant`, { method: 'POST', body: { harder: true } });
      trackRun(jobId); location.hash = `#/run/${jobId}`;
    }
  });
}
const scoreColor = (p) => (p >= 85 ? 'var(--good)' : p >= 65 ? 'var(--warn)' : 'var(--bad)');

// =====================================================================================
// TAKE EXAM
// =====================================================================================
function checkLocal(q, a) {
  // Mirrors the server's objective grading for instant tutor-mode feedback.
  if (a === undefined || a === null || a === '' || (Array.isArray(a) && !a.length)) return null;
  if (q.type === 'mcq' || q.type === 'true_false') return { score: q.options[a]?.correct ? 1 : 0 };
  if (q.type === 'multi_select') {
    const keys = q.options.map((o, i) => (o.correct ? i : -1)).filter((i) => i >= 0);
    const hits = a.filter((i) => keys.includes(i)).length, wrong = a.length - hits;
    return { score: hits === keys.length && !wrong ? 1 : Math.max(0, (hits - wrong) / keys.length) };
  }
  if (q.type === 'matching') return { score: (q.match_key || []).filter((k, i) => Number(a[i]) === k).length / Math.max(1, q.match_key.length) };
  if (q.type === 'numeric') {
    const t = parseFloat(String(q.answer).replace(/[^0-9eE.+-]/g, '')), g = parseFloat(String(a).replace(/,/g, ''));
    const tol = q.tolerance > 0 ? q.tolerance : Math.abs(t) * 0.01;
    return { score: Math.abs(g - t) <= tol + 1e-12 ? 1 : 0 };
  }
  return null; // free response -> server/AI
}

async function viewTake(id, params) {
  const exam = await api(`/api/exams/${id}`);
  const key = `ef-progress-${id}`;
  const mode = params.get('mode') || exam.config.mode || 'exam';
  let saved = store.get(key, null);
  if (saved && (saved.mode !== mode || params.has('fresh'))) saved = null;
  const st = saved || { answers: {}, flagged: [], idx: 0, startedAt: Date.now(), checked: {}, mode };
  const limitMs = mode === 'exam' && exam.config.timeLimit ? exam.config.timeLimit * 60000 : 0;
  const qs = exam.questions;
  const persist = () => store.set(key, st);

  main.innerHTML = `<div class="view" style="max-width:1180px">
    <div class="take-bar">
      <div style="min-width:0"><div class="eyebrow" style="margin:0">${mode === 'tutor' ? 'Tutor mode' : 'Exam mode'}</div><div style="font:700 15px var(--display);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:340px">${esc(exam.title)}</div></div>
      <div class="progress"><i id="prog"></i></div>
      <span class="mono small" id="progTxt"></span>
      <span class="timer" id="timer">${limitMs ? fmtTime(limitMs) : '∞'}</span>
      <button class="btn primary" id="submitBtn">Submit</button>
    </div>
    <div class="take">
      <div class="sticky" style="top:60px">
        <div class="panel" style="padding:16px"><div class="navgrid" id="navgrid"></div>
          <div class="legend"><span><span class="kbd">A–F</span> choose · <span class="kbd">←</span><span class="kbd">→</span> move · <span class="kbd">F</span> flag</span></div></div>
      </div>
      <div id="qwrap"></div>
    </div></div>`;

  const answered = (q) => { const a = st.answers[q.id]; return a !== undefined && a !== '' && !(Array.isArray(a) && !a.filter((x) => x !== null && x !== undefined && x !== '').length); };
  const renderNav = () => {
    $('#navgrid').innerHTML = qs.map((q, i) => {
      const c = st.checked[q.id];
      const cls = [i === st.idx && 'current', answered(q) && 'answered', st.flagged.includes(q.id) && 'flagged', c && (c.score >= 1 ? 'right' : 'wrong')].filter(Boolean).join(' ');
      return `<button class="${cls}" data-i="${i}">${i + 1}</button>`;
    }).join('');
    const n = qs.filter(answered).length;
    $('#prog').style.width = `${(100 * n) / qs.length}%`;
    $('#progTxt').textContent = `${n}/${qs.length}`;
  };

  const renderQ = () => {
    const q = qs[st.idx];
    const a = st.answers[q.id];
    const checked = st.checked[q.id];
    const reveal = mode === 'tutor' && checked;
    const optClass = (o, i) => {
      const sel = q.type === 'multi_select' ? (a || []).includes(i) : a === i;
      if (!reveal) return sel ? 'sel' : '';
      if (o.correct) return 'right';
      return sel ? 'wrong' : '';
    };
    let body = '';
    if (['mcq', 'true_false', 'multi_select'].includes(q.type)) {
      body = `<div class="options">${q.options.map((o, i) => `<button class="opt ${q.type === 'multi_select' ? 'multi' : ''} ${optClass(o, i)} ${reveal ? 'reveal' : ''}" data-i="${i}">
        <span class="letter">${LETTERS[i]}</span><span class="otext md">${md(o.text)}</span>${reveal ? `<span class="why md">${md(o.rationale)}</span>` : ''}</button>`).join('')}</div>`;
    } else if (q.type === 'matching') {
      const arr = a || [];
      body = `<div class="faint small" style="margin-bottom:10px">Match each item on the left with one on the right.</div>${q.match_left.map((l, i) => `<div class="match-row"><div class="match-left md">${md(l)}</div><span class="faint">→</span>
        <select data-m="${i}" ${reveal ? 'disabled' : ''}><option value="">Choose…</option>${q.match_right.map((r, j) => `<option value="${j}" ${String(arr[i]) === String(j) ? 'selected' : ''}>${LETTERS[j]}. ${esc(r)}</option>`).join('')}</select>
        ${reveal ? `<span></span><span></span><span class="small" style="color:${Number(arr[i]) === q.match_key[i] ? 'var(--good)' : 'var(--bad)'}">✓ ${esc(q.match_right[q.match_key[i]])}</span>` : ''}</div>`).join('')}`;
    } else if (q.type === 'numeric' || q.type === 'fill_blank') {
      body = `<input type="text" id="freeIn" value="${esc(a ?? '')}" placeholder="${q.type === 'numeric' ? 'Enter a number' : 'Your answer'}" style="max-width:420px;font-size:16px" ${reveal ? 'disabled' : ''}/>`;
    } else {
      body = `<textarea id="freeIn" rows="${q.type === 'essay' ? 16 : 6}" placeholder="${q.type === 'essay' ? 'Write your essay…' : 'Answer in a few sentences…'}" ${reveal ? 'disabled' : ''}>${esc(a ?? '')}</textarea><div class="faint small" id="wc"></div>`;
    }
    const exp = reveal ? `<div class="explain">
      ${checked.feedback ? `<h4>Grader</h4><div style="margin-bottom:12px">${esc(checked.feedback)}</div>` : ''}
      ${q.answer && !['mcq', 'true_false', 'multi_select'].includes(q.type) ? `<h4>Model answer</h4><div class="md" style="margin-bottom:12px">${md(q.answer)}</div>` : ''}
      <h4>Explanation</h4><div class="md">${md(q.explanation)}</div>
      ${q.trap ? `<div class="trap"><h4>The trap</h4><div class="md">${md(q.trap)}</div></div>` : ''}
      ${q.source ? `<div class="faint small" style="margin-top:10px">Source: ${esc(q.source)}</div>` : ''}</div>` : '';
    $('#qwrap').innerHTML = `<div class="panel qcard">
      <div class="qmeta"><span class="qnum">QUESTION ${st.idx + 1} / ${qs.length}</span><span class="tag">${esc(typeLabel(q.type))}</span>${q.points > 1 ? `<span class="tag">${q.points} pts</span>` : ''}
        ${mode === 'tutor' ? `<span class="tag">${esc(q.difficulty)}</span><span class="tag">${esc(q.concept)}</span>` : ''}<span class="spacer"></span>
        <button class="btn sm ghost" id="flagBtn" style="${st.flagged.includes(q.id) ? 'color:var(--warn);border-color:var(--warn)' : ''}">${I.flag} ${st.flagged.includes(q.id) ? 'Flagged' : 'Flag'}</button></div>
      ${q.context ? `<div class="qcontext md">${md(q.context)}</div>` : ''}
      <div class="qstem md">${md(q.stem)}</div>
      ${body}
      ${exp}
      <div class="qfoot">
        <button class="btn" id="prevBtn" ${st.idx === 0 ? 'disabled' : ''}>← Previous</button>
        ${mode === 'tutor' && !checked ? `<button class="btn hot" id="checkBtn">Check answer</button>` : ''}
        <span class="spacer"></span>
        ${st.idx < qs.length - 1 ? '<button class="btn primary" id="nextBtn">Next →</button>' : '<button class="btn hot" id="finishBtn">Finish & grade</button>'}
      </div></div>`;
    typeset($('#qwrap'));
    bindQ(q);
    renderNav();
  };

  const bindQ = (q) => {
    $$('.opt').forEach((b) => b.addEventListener('click', () => choose(q, +b.dataset.i)));
    $$('select[data-m]').forEach((s) => s.addEventListener('change', () => {
      const arr = [...(st.answers[q.id] || new Array(q.match_left.length).fill(null))];
      arr[+s.dataset.m] = s.value === '' ? null : +s.value;
      st.answers[q.id] = arr; persist(); renderNav();
    }));
    const free = $('#freeIn');
    if (free) {
      const wc = () => { const w = $('#wc'); if (w) w.textContent = `${(free.value.trim().match(/\S+/g) || []).length} words`; };
      free.addEventListener('input', () => { st.answers[q.id] = free.value; persist(); renderNav(); wc(); });
      wc();
    }
    $('#flagBtn').addEventListener('click', () => toggleFlag(q));
    $('#prevBtn').addEventListener('click', () => go(st.idx - 1));
    $('#nextBtn')?.addEventListener('click', () => go(st.idx + 1));
    $('#finishBtn')?.addEventListener('click', submit);
    $('#checkBtn')?.addEventListener('click', () => check(q));
  };

  const choose = (q, i) => {
    if (mode === 'tutor' && st.checked[q.id]) return;
    if (q.type === 'multi_select') {
      const arr = new Set(st.answers[q.id] || []);
      arr.has(i) ? arr.delete(i) : arr.add(i);
      st.answers[q.id] = [...arr].sort();
    } else st.answers[q.id] = i;
    persist(); renderQ();
  };
  const toggleFlag = (q) => {
    const i = st.flagged.indexOf(q.id);
    i >= 0 ? st.flagged.splice(i, 1) : st.flagged.push(q.id);
    persist(); renderQ();
  };
  const go = (i) => { if (i < 0 || i >= qs.length) return; st.idx = i; persist(); renderQ(); main.scrollTop = 0; };
  const check = async (q) => {
    const a = st.answers[q.id];
    let r = checkLocal(q, a);
    if (!r) {
      if (!answered(q)) { toast('Answer first, then check.'); return; }
      const btn = $('#checkBtn'); btn.disabled = true; btn.textContent = 'Grading…';
      try { r = await api(`/api/exams/${id}/check`, { method: 'POST', body: { qid: q.id, answer: a } }); } catch (err) { toast(err.message, 'err'); btn.disabled = false; btn.textContent = 'Check answer'; return; }
    }
    if (!r) { toast('Answer first, then check.'); return; }
    st.checked[q.id] = r; persist(); renderQ();
  };

  let submitting = false;
  const submit = async (auto) => {
    if (submitting) return;
    const left = qs.filter((q) => !answered(q)).length;
    if (auto !== true && !confirm(left ? `${left} question${left > 1 ? 's are' : ' is'} unanswered. Submit anyway?` : 'Submit your exam for grading?')) return;
    submitting = true;
    main.innerHTML = `<div class="loading"><div class="spinner"></div><div>Grading${qs.some((q) => ['short_answer', 'essay', 'fill_blank'].includes(q.type)) ? ` — ${esc(shortModel(S.settings.models.builder))} is reading your written answers` : ''}…</div></div>`;
    try {
      const attempt = await api(`/api/exams/${id}/attempts`, { method: 'POST', body: { answers: st.answers, flagged: st.flagged, startedAt: st.startedAt, timeUsedSec: Math.round((Date.now() - st.startedAt) / 1000) } });
      store.del(key);
      location.hash = `#/results/${attempt.id}`;
    } catch (err) { toast(err.message, 'err'); submitting = false; renderQ(); }
  };
  $('#submitBtn').addEventListener('click', submit);
  $('#navgrid').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) go(+b.dataset.i); });

  const onKey = (e) => {
    if (e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey) return;
    const q = qs[st.idx];
    const k = e.key.toLowerCase();
    if (k === 'arrowright' || k === 'enter') go(st.idx + 1);
    else if (k === 'arrowleft') go(st.idx - 1);
    else if (k === 'f') toggleFlag(q);
    else if (q.options?.length) {
      const i = /^[1-9]$/.test(k) ? +k - 1 : LETTERS.toLowerCase().indexOf(k);
      if (i >= 0 && i < q.options.length && k.length === 1) choose(q, i);
    }
  };
  document.addEventListener('keydown', onKey);
  const tick = setInterval(() => {
    const el = $('#timer'); if (!el) return;
    if (!limitMs) { el.textContent = fmtTime(Date.now() - st.startedAt); return; }
    const left = limitMs - (Date.now() - st.startedAt);
    el.textContent = fmtTime(left);
    el.classList.toggle('low', left < 60000 * 2);
    if (left <= 0) { clearInterval(tick); toast('Time is up — submitting.'); submit(true); }
  }, 500);
  cleanup = () => { document.removeEventListener('keydown', onKey); clearInterval(tick); };
  renderQ();
}

// =====================================================================================
// RESULTS
// =====================================================================================
async function viewResults(id) {
  const at = await api(`/api/attempts/${id}`);
  const exam = await api(`/api/exams/${at.examId}`).catch(() => null);
  if (!exam) throw new Error('The exam for this attempt was deleted.');
  const pct = at.pct;
  const C = 2 * Math.PI * 88;
  const missed = exam.questions.filter((q) => (at.results[q.id]?.score ?? 0) < 1).length;
  const bd = (obj, label) => {
    const rows = Object.entries(obj).map(([k, v]) => [k, v.points ? (100 * v.earned) / v.points : 0, v]).sort((a, b) => a[1] - b[1]);
    return `<div class="panel"><div class="panel-title"><h2>${label}</h2></div><div class="breakdown">${rows.map(([k, p, v]) => `<div class="bd-row"><span class="name" title="${esc(k)}">${esc(label === 'By type' ? typeLabel(k) : k)} <span class="faint small">(${v.n})</span></span><div class="bd-bar"><i data-w="${p}" style="width:0;background:${scoreColor(p)}"></i></div><span class="mono small" style="text-align:right">${Math.round(p)}%</span></div>`).join('')}</div></div>`;
  };
  main.innerHTML = `<div class="view">
    <div class="panel" style="padding:32px">
      <div class="result-hero">
        <div class="score-ring"><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="88" fill="none" stroke="var(--line)" stroke-width="14"/>
          <circle id="ring" cx="100" cy="100" r="88" fill="none" stroke="url(#rg)" stroke-width="14" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C}" style="transition:stroke-dashoffset 1.4s cubic-bezier(.2,.8,.2,1)"/>
          <defs><linearGradient id="rg"><stop offset="0" stop-color="#ffb547"/><stop offset=".5" stop-color="#ff6aa8"/><stop offset="1" stop-color="#8b7bff"/></linearGradient></defs></svg>
          <div class="val"><div><b id="pctNum">0%</b><span class="faint small mono">${at.earned} / ${at.total} pts</span></div></div></div>
        <div>
          <div class="eyebrow">Results · ${fmtDate(at.createdAt)}</div>
          <h1>${esc(exam.title)}</h1>
          <p class="lede">${pct >= 90 ? 'Outstanding. You saw through the traps.' : pct >= 75 ? 'Strong work — a few traps got you. Review them below.' : pct >= 55 ? 'Solid foundation, but the distractors found real gaps. Remediation will target them.' : 'This one bit hard. That\'s the point — remediation will rebuild the weak spots.'}
            ${at.timeUsedSec ? ` Time used: ${fmtTime(at.timeUsedSec * 1000)}.` : ''}</p>
          <div class="row" style="margin-top:18px">
            <button class="btn hot" id="remBtn" ${missed ? '' : 'disabled'}>${I.bolt} Adaptive remediation exam (${missed} missed)</button>
            <button class="btn" id="hardBtn">⇪ Forge a harder version</button>
            <a class="btn ghost" href="#/take/${exam.id}?fresh=1">Retake</a>
          </div>
        </div>
      </div>
    </div>
    <div class="grid-2" style="margin-top:18px">${bd(at.byConcept, 'By concept')}<div>${bd(at.byDifficulty, 'By difficulty')}${bd(at.byType, 'By type')}</div></div>
    <div class="panel" style="margin-top:18px"><div class="panel-title"><h2>Question review</h2>
      <div class="seg" id="revFilter"><button data-v="missed" class="on">Missed (${missed})</button><button data-v="flagged">Flagged (${(at.flagged || []).length})</button><button data-v="all">All</button></div></div>
      <div id="reviewList"></div></div></div>`;

  requestAnimationFrame(() => {
    $('#ring').style.strokeDashoffset = C * (1 - pct / 100);
    $$('.bd-bar i').forEach((i) => { i.style.width = `${i.dataset.w}%`; });
    const t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / 1400); $('#pctNum') && ($('#pctNum').textContent = `${Math.round(pct * (1 - Math.pow(1 - k, 3)))}%`); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
    if (pct >= 85) burst();
  });

  const renderReview = (filter) => {
    const list = exam.questions.map((q, i) => ({ q, i, r: at.results[q.id] || {} })).filter(({ q, r }) =>
      filter === 'all' || (filter === 'missed' && (r.score ?? 0) < 1) || (filter === 'flagged' && (at.flagged || []).includes(q.id)));
    $('#reviewList').innerHTML = list.map(({ q, i, r }) => {
      const a = at.answers[q.id];
      let body = '';
      if (['mcq', 'true_false', 'multi_select'].includes(q.type)) {
        const chosen = q.type === 'multi_select' ? (a || []) : [a];
        body = `<div class="options">${q.options.map((o, j) => `<div class="opt reveal ${o.correct ? 'right' : chosen.includes(j) ? 'wrong' : ''}"><span class="letter">${LETTERS[j]}</span><span class="otext md">${md(o.text)}${chosen.includes(j) ? ' <span class="tag">your pick</span>' : ''}</span><span class="why md">${md(o.rationale)}</span></div>`).join('')}</div>`;
      } else if (q.type === 'matching') {
        body = q.match_left.map((l, k) => `<div class="small" style="margin:4px 0">${esc(l)} → <b style="color:${Number(a?.[k]) === q.match_key[k] ? 'var(--good)' : 'var(--bad)'}">${esc(q.match_right[a?.[k]] ?? '—')}</b>${Number(a?.[k]) !== q.match_key[k] ? ` <span class="faint">(correct: ${esc(q.match_right[q.match_key[k]])})</span>` : ''}</div>`).join('');
      } else {
        body = `<div class="qcontext" style="border-left-color:${scoreColor((r.score || 0) * 100)}"><div class="faint small">YOUR ANSWER</div><div style="white-space:pre-wrap">${esc(a || '— blank —')}</div></div>
          ${r.feedback ? `<div class="small" style="margin-bottom:10px"><b>Grader:</b> ${esc(r.feedback)}</div>` : ''}
          <div class="faint small">MODEL ANSWER</div><div class="md">${md(q.answer)}</div>`;
      }
      return `<div class="panel review-q" style="background:var(--bg-2)"><div class="head"><span class="qnum">Q${i + 1}</span><span class="tag ${r.score >= 1 ? 'good' : r.score > 0 ? 'warn' : 'bad'}">${esc(r.verdict || '')} · ${r.earned ?? 0}/${r.points ?? q.points}</span><span class="tag">${esc(typeLabel(q.type))}</span>${q.style && /mcq|multi/.test(q.type) ? `<span class="tag">${esc(styleLabel(q.style))}</span>` : ''}<span class="tag">${esc(q.difficulty)}</span><span class="faint small">${esc(q.concept)}</span></div>
        ${q.context ? `<div class="qcontext md">${md(q.context)}</div>` : ''}<div class="qstem md" style="font-size:16px;margin-bottom:14px">${md(q.stem)}</div>${body}
        <div class="explain"><h4>Explanation</h4><div class="md">${md(q.explanation)}</div>${q.trap ? `<div class="trap"><h4>The trap</h4><div class="md">${md(q.trap)}</div></div>` : ''}${q.source ? `<div class="faint small" style="margin-top:10px">Source: ${esc(q.source)}</div>` : ''}</div></div>`;
    }).join('') || '<div class="empty">Nothing here.</div>';
    typeset($('#reviewList'));
  };
  renderReview(missed ? 'missed' : 'all');
  if (!missed) $$('#revFilter button').forEach((b) => b.classList.toggle('on', b.dataset.v === 'all'));
  $('#revFilter').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; $$('#revFilter button').forEach((x) => x.classList.toggle('on', x === b)); renderReview(b.dataset.v); });
  $('#remBtn').addEventListener('click', async () => {
    try { const { jobId } = await api(`/api/attempts/${id}/remediate`, { method: 'POST' }); trackRun(jobId); location.hash = `#/run/${jobId}`; } catch (err) { toast(err.message, 'err'); }
  });
  $('#hardBtn').addEventListener('click', async () => {
    try { const { jobId } = await api(`/api/exams/${exam.id}/variant`, { method: 'POST', body: { harder: true } }); trackRun(jobId); location.hash = `#/run/${jobId}`; } catch (err) { toast(err.message, 'err'); }
  });
}

// =====================================================================================
// PRINT
// =====================================================================================
async function viewPrint(id, params) {
  const exam = await api(`/api/exams/${id}`);
  const withKey = params.get('key') === '1';
  main.innerHTML = `<div class="view" style="max-width:860px">
    <div class="row no-print" style="margin-bottom:16px"><a class="btn ghost" href="#/exams">← Exams</a><span class="spacer"></span>
      <a class="btn" href="#/print/${id}${withKey ? '' : '?key=1'}">${withKey ? 'Hide' : 'Show'} answer key</a><button class="btn primary" onclick="window.print()">${I.print} Print / Save PDF</button></div>
    <div class="print-sheet"><h1>${esc(exam.title)}</h1><p style="color:#555">${exam.questions.length} questions${exam.config.timeLimit ? ` · ${exam.config.timeLimit} minutes` : ''} · Name: ____________________</p><hr/>
    ${exam.questions.map((q, i) => `<div class="print-q md" style="margin:18px 0"><b>${i + 1}.</b> ${q.context ? `<div style="margin:6px 0;padding:8px;border-left:3px solid #999">${md(q.context)}</div>` : ''}${md(q.stem)}
      ${q.options?.length ? `<ol type="A" style="margin-top:6px">${q.options.map((o) => `<li>${md(o.text)}</li>`).join('')}</ol>` : ''}
      ${q.type === 'matching' ? `<table><tr><th>Item</th><th>Options</th></tr>${q.match_left.map((l, k) => `<tr><td>${k + 1}. ${esc(l)}</td><td>${q.match_right[k] !== undefined ? `${LETTERS[k]}. ${esc(q.match_right[k])}` : ''}</td></tr>`).join('')}${q.match_right.slice(q.match_left.length).map((r, k) => `<tr><td></td><td>${LETTERS[k + q.match_left.length]}. ${esc(r)}</td></tr>`).join('')}</table>` : ''}
      ${['short_answer', 'essay'].includes(q.type) ? `<div style="height:${q.type === 'essay' ? 220 : 90}px;border-bottom:1px solid #ccc"></div>` : ''}
      ${['fill_blank', 'numeric'].includes(q.type) ? '<p>Answer: ______________</p>' : ''}</div>`).join('')}
    ${withKey ? `<hr/><h2 style="color:#111">Answer key</h2>${exam.questions.map((q, i) => `<div class="print-q md" style="margin:10px 0"><b>${i + 1}.</b> ${
      q.options?.length ? q.options.map((o, j) => (o.correct ? LETTERS[j] : null)).filter(Boolean).join(', ') : q.type === 'matching' ? q.match_key.map((k, j) => `${j + 1}→${LETTERS[k]}`).join(', ') : esc(q.answer)} — ${md(q.explanation)}</div>`).join('')}` : ''}
    </div></div>`;
  typeset(main);
}

// =====================================================================================
// SETTINGS
// =====================================================================================
async function viewSettings() {
  const s = await api('/api/settings');
  const sub = s.backend === 'subscription';
  main.innerHTML = `<div class="view" style="max-width:760px"><div class="page-head"><div><div class="eyebrow">Configuration</div><h1>Settings</h1></div></div>
    <div class="panel"><div class="panel-title"><h2>How ExamForge talks to Claude</h2></div>
      <div class="seg" id="backendSeg" style="margin-bottom:14px"><button data-v="subscription" class="${sub ? 'on' : ''}">My Claude subscription</button><button data-v="api" class="${sub ? '' : 'on'}">API key</button></div>
      ${sub ? `<p class="muted small">Exams are generated through Claude Code (the <span class="mono">claude</span> command) using the Claude plan you're signed in with. No API key and no extra charges; it counts toward your plan's usage limits.</p>
        <div class="row small" style="margin-bottom:12px">${s.cliVersion ? `<span class="tag good">found ${esc(s.cliVersion)}</span>` : '<span class="tag bad">claude command not found</span>'}<span class="mono faint">${esc(s.claudePath)}</span></div>
        <p class="faint small">Note: on a subscription, Fable 5.1 requires paid usage credits, so Opus 5.5 handles every stage by default. If you buy credits you can set the thinker to <span class="mono">claude-fable-5-1</span> below.</p>`
      : '<p class="muted small">Pay-as-you-go through the Anthropic API (console.anthropic.com). Required for Fable 5.1 without usage credits.</p>'}
      <div class="row"><button class="btn" id="testConn">Test connection</button><span class="small muted" id="testOut"></span></div></div>
    ${sub ? '' : `<div class="panel"><div class="panel-title"><h2>Anthropic API key</h2>${s.hasStoredKey ? `<span class="tag good">saved ${esc(s.storedKeyHint)}</span>` : s.hasEnvKey ? '<span class="tag good">using environment</span>' : '<span class="tag bad">not set</span>'}</div>
      <p class="muted small">Stored only on this Mac in <span class="mono">ExamForge/data/config.json</span>. If you leave it empty, ExamForge uses <span class="mono">ANTHROPIC_API_KEY</span> from your environment.</p>
      <label class="field"><span>API key</span><input type="password" id="sKey" placeholder="${s.hasStoredKey ? 'Saved — paste a new key to replace' : 'sk-ant-…'}" autocomplete="off" /></label>
      <div class="row"><button class="btn primary" id="saveKey">Save key</button>${s.hasStoredKey ? '<button class="btn ghost danger" id="clearKey">Remove saved key</button>' : ''}</div></div>`}
    <div class="panel"><div class="panel-title"><h2>Models</h2></div>
      <label class="field"><span>Thinker — architect & red team</span><input type="text" id="sThink" value="${esc(s.models.thinker)}" /></label>
      <label class="field"><span>Builder — question forge & grader</span><input type="text" id="sBuild" value="${esc(s.models.builder)}" /></label>
      <label class="field"><span>Parallel forge batches (1–8)</span><input type="number" id="sConc" min="1" max="8" value="${s.concurrency}" /></label>
      <div class="row"><button class="btn primary" id="saveModels">Save</button><button class="btn ghost" id="resetModels">Reset to ${esc(shortModel(s.defaults.thinker))} / ${esc(shortModel(s.defaults.builder))}</button></div></div></div>`;
  $('#backendSeg').addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b || b.classList.contains('on')) return;
    await api('/api/settings', { method: 'POST', body: { backend: b.dataset.v } });
    await boot(true); route();
  });
  $('#testConn').addEventListener('click', async () => {
    const out = $('#testOut'), btn = $('#testConn');
    btn.disabled = true; out.textContent = 'Asking Claude…';
    try { const r = await api('/api/test-connection', { method: 'POST' }); out.innerHTML = `<span style="color:var(--good)">✓ Connected</span> via ${r.backend === 'subscription' ? 'your Claude plan' : 'API key'} · ${esc(r.model)} · ${(r.ms / 1000).toFixed(1)}s`; }
    catch (err) { out.innerHTML = `<span style="color:var(--bad)">✗ ${esc(err.message)}</span>`; }
    btn.disabled = false;
  });
  $('#saveKey')?.addEventListener('click', async () => { await api('/api/settings', { method: 'POST', body: { apiKey: $('#sKey').value } }); toast('Key saved', 'ok'); route(); });
  $('#clearKey')?.addEventListener('click', async () => { await api('/api/settings', { method: 'POST', body: { apiKey: '' } }); toast('Key removed'); route(); });
  $('#saveModels').addEventListener('click', async () => { await api('/api/settings', { method: 'POST', body: { thinkerModel: $('#sThink').value, builderModel: $('#sBuild').value, concurrency: $('#sConc').value } }); toast('Saved', 'ok'); boot(true); });
  $('#resetModels').addEventListener('click', async () => { await api('/api/settings', { method: 'POST', body: { thinkerModel: '', builderModel: '' } }); toast('Reset', 'ok'); await boot(true); route(); });
}

// =====================================================================================
// ambience: particle field + celebration burst
// =====================================================================================
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
function cosmos() {
  const cv = $('#cosmos'); const ctx = cv.getContext('2d');
  let W, H, pts;
  const resize = () => {
    W = cv.width = innerWidth * devicePixelRatio; H = cv.height = innerHeight * devicePixelRatio;
    cv.style.width = `${innerWidth}px`; cv.style.height = `${innerHeight}px`;
    pts = Array.from({ length: Math.min(70, Math.round(innerWidth / 22)) }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15 }));
  };
  resize(); addEventListener('resize', resize);
  const light = () => document.documentElement.dataset.theme === 'light';
  const frame = () => {
    ctx.clearRect(0, 0, W, H);
    const c = light() ? '90,70,200' : '160,150,255';
    const D = 140 * devicePixelRatio;
    for (const p of pts) {
      p.x = (p.x + p.vx + W) % W; p.y = (p.y + p.vy + H) % H;
      ctx.fillStyle = `rgba(${c},.5)`; ctx.fillRect(p.x, p.y, 1.6 * devicePixelRatio, 1.6 * devicePixelRatio);
    }
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, d = Math.hypot(dx, dy);
      if (d < D) { ctx.strokeStyle = `rgba(${c},${0.12 * (1 - d / D)})`; ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke(); }
    }
    if (!reduceMotion) requestAnimationFrame(frame);
  };
  frame();
}
function burst() {
  if (reduceMotion) return;
  const cv = document.createElement('canvas');
  Object.assign(cv.style, { position: 'fixed', inset: 0, zIndex: 60, pointerEvents: 'none' });
  cv.width = innerWidth; cv.height = innerHeight; document.body.append(cv);
  const ctx = cv.getContext('2d');
  const colors = ['#ffb547', '#ff6aa8', '#8b7bff', '#2fd6f5', '#34d399'];
  const ps = Array.from({ length: 160 }, () => ({ x: innerWidth / 2, y: innerHeight / 3, vx: (Math.random() - 0.5) * 16, vy: Math.random() * -14 - 2, s: Math.random() * 6 + 3, c: colors[(Math.random() * colors.length) | 0], r: Math.random() * 6 }));
  let f = 0;
  const step = () => {
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (const p of ps) { p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.r += 0.1; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, 1 - f / 110); ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); }
    if (++f < 110) requestAnimationFrame(step); else cv.remove();
  };
  step();
}

// ---- boot --------------------------------------------------------------------------
function applyTheme(t) { document.documentElement.dataset.theme = t; }
async function boot(soft) {
  if (!soft) {
    let theme = store.get('ef-theme', null);
    if (!theme) theme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    applyTheme(theme);
    $('#themeBtn').addEventListener('click', () => { const t = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'; applyTheme(t); store.set('ef-theme', t); });
    cosmos();
    S.catalog = await api('/api/catalog');
  }
  S.settings = await api('/api/settings');
  $('#thinkerName').textContent = S.settings.models.thinker;
  $('#builderName').textContent = S.settings.models.builder;
  for (const [id, m] of [['#thinkerName', S.settings.models.thinker], ['#builderName', S.settings.models.builder]]) $(id).previousElementSibling.className = `dot ${/fable/.test(m) ? 'fable' : 'opus'}`;
  if (!soft) {
    for (const j of await api('/api/jobs')) if (j.status === 'running') trackRun(j.id);
    if (S.settings.backend === 'api' && !S.settings.hasStoredKey && !S.settings.hasEnvKey && !location.hash) location.hash = '#/settings';
    route();
  }
}
boot();
