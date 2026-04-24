// ══════════════════════════
// ANOTAÇÕES — Obsidian-like
// ══════════════════════════

// State extra (em state.js definimos: notes, activeNoteId, noteFilter, noteEditorTab)
let notesOpenTabs = JSON.parse(localStorage.getItem('fb_notes_tabs') || '[]');
let notesExpandedFolders = new Set(JSON.parse(localStorage.getItem('fb_notes_expanded') || '[]'));
let notesViewMode = localStorage.getItem('fb_notes_view_mode') || 'split'; // 'source' | 'preview' | 'split'

function persistNotesUI() {
  localStorage.setItem('fb_notes_tabs', JSON.stringify(notesOpenTabs));
  localStorage.setItem('fb_notes_expanded', JSON.stringify([...notesExpandedFolders]));
  localStorage.setItem('fb_notes_view_mode', notesViewMode);
  if (activeNoteId) localStorage.setItem('fb_notes_active', activeNoteId);
}

function genNoteId() {
  return 'n_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function loadNotes() {
  try {
    const data = await sbFetch('notes?order=updated_at.desc');
    notes = data || [];
    // restaura tabs/active válidos
    notesOpenTabs = notesOpenTabs.filter(id => notes.some(n => n.id === id));
    const lastActive = localStorage.getItem('fb_notes_active');
    if (lastActive && notes.some(n => n.id === lastActive)) activeNoteId = lastActive;
  } catch (e) {
    console.warn('[Notes] Falha ao carregar (verifique se a tabela `notes` existe no Supabase):', e?.message || e);
    notes = [];
  }
}

// ── CRUD ──
async function createNote(folderPath = '') {
  const now = new Date().toISOString();
  const note = {
    id: genNoteId(),
    title: '',
    content: '',
    category: folderPath || '',
    tags: [],
    board_id: null,
    card_id: null,
    pinned: false,
    created_at: now,
    updated_at: now
  };
  notes.unshift(note);
  openTab(note.id);
  renderNotes();
  setTimeout(() => document.getElementById('obsd-title-input')?.focus(), 60);
  try {
    await sbFetch('notes', 'POST', note);
  } catch (e) {
    toast('Erro ao criar anotação', '#ef4444');
    notes = notes.filter(n => n.id !== note.id);
    closeTab(note.id);
    renderNotes();
  }
}

async function createFolderPrompt() {
  const name = await showPrompt('Nova pasta', 'Nome da pasta (use / para subpastas, ex: Trabalho/Reuniões)', '');
  if (!name) return;
  const clean = name.trim().replace(/^\/|\/$/g, '');
  if (!clean) return;
  notesExpandedFolders.add(clean);
  // Para a pasta "existir" precisa de pelo menos uma nota dentro — cria uma vazia
  await createNote(clean);
}

function _patchNoteLocal(id, patch) {
  const i = notes.findIndex(n => n.id === id);
  if (i === -1) return null;
  notes[i] = { ...notes[i], ...patch, updated_at: new Date().toISOString() };
  return notes[i];
}

async function updateNote(id, patch, opts = {}) {
  const updated = _patchNoteLocal(id, patch);
  if (!updated) return;
  if (!opts.skipRender) renderNotes();
  try {
    await sbFetch(`notes?id=eq.${id}`, 'PATCH', { ...patch, updated_at: updated.updated_at });
  } catch (e) {
    toast('Erro ao salvar anotação', '#ef4444');
  }
}

function debouncedSaveNote(id, patch) {
  _patchNoteLocal(id, patch);
  if (_noteSaveTimer) clearTimeout(_noteSaveTimer);
  _noteSaveTimer = setTimeout(async () => {
    try {
      const n = notes.find(nn => nn.id === id);
      if (!n) return;
      await sbFetch(`notes?id=eq.${id}`, 'PATCH', { ...patch, updated_at: n.updated_at });
    } catch (e) {
      toast('Erro ao salvar anotação', '#ef4444');
    }
  }, 600);
}

async function deleteNote(id) {
  const n = notes.find(nn => nn.id === id);
  if (!n) return;
  const ok = await showConfirm('Excluir anotação', `Tem certeza que deseja excluir "${n.title || 'sem título'}"?`);
  if (!ok) return;
  notes = notes.filter(nn => nn.id !== id);
  closeTab(id);
  renderNotes();
  try { await sbFetch(`notes?id=eq.${id}`, 'DELETE'); }
  catch (e) { toast('Erro ao excluir', '#ef4444'); }
}

// ── Tabs ──
function openTab(id) {
  if (!notesOpenTabs.includes(id)) notesOpenTabs.push(id);
  activeNoteId = id;
  persistNotesUI();
}

function closeTab(id) {
  const idx = notesOpenTabs.indexOf(id);
  if (idx === -1) return;
  notesOpenTabs.splice(idx, 1);
  if (activeNoteId === id) {
    activeNoteId = notesOpenTabs[idx] || notesOpenTabs[idx - 1] || null;
  }
  persistNotesUI();
  renderNotes();
}

function selectNote(id) {
  openTab(id);
  renderNotes();
}

function togglePinNote(id) {
  const n = notes.find(nn => nn.id === id);
  if (!n) return;
  updateNote(id, { pinned: !n.pinned });
}

// ── Filtros / busca ──
function setNoteScope(s) { noteFilter.scope = s; renderNotes(); }
function onNotesSearch(v) { noteFilter.q = (v || '').toLowerCase().trim(); renderTreeOnly(); }
function toggleNoteTagFilter(tag) {
  const i = noteFilter.tags.indexOf(tag);
  if (i === -1) noteFilter.tags.push(tag); else noteFilter.tags.splice(i, 1);
  renderNotes();
}

function getScopedNotes() {
  let list = notes.slice();
  if (noteFilter.scope === 'board') list = list.filter(n => n.board_id === activeBoardId);
  else if (noteFilter.scope === 'global') list = list.filter(n => !n.board_id);
  if (noteFilter.q) {
    const q = noteFilter.q;
    list = list.filter(n =>
      (n.title || '').toLowerCase().includes(q) ||
      (n.content || '').toLowerCase().includes(q) ||
      (n.tags || []).some(t => t.toLowerCase().includes(q)) ||
      (n.category || '').toLowerCase().includes(q)
    );
  }
  if (noteFilter.tags.length) list = list.filter(n => noteFilter.tags.every(t => (n.tags || []).includes(t)));
  return list;
}

// ── Árvore de pastas ──
function buildFolderTree(list) {
  const root = { folders: {}, notes: [] };
  list.forEach(n => {
    const path = (n.category || '').trim();
    if (!path) { root.notes.push(n); return; }
    const parts = path.split('/').map(p => p.trim()).filter(Boolean);
    let cur = root;
    parts.forEach(part => {
      cur.folders[part] = cur.folders[part] || { folders: {}, notes: [], path: '' };
      cur = cur.folders[part];
    });
    cur.notes.push(n);
  });
  // anota path completo nas pastas
  function annotate(node, prefix) {
    Object.entries(node.folders).forEach(([name, child]) => {
      child.path = prefix ? `${prefix}/${name}` : name;
      annotate(child, child.path);
    });
  }
  annotate(root, '');
  return root;
}

function toggleFolder(path) {
  if (notesExpandedFolders.has(path)) notesExpandedFolders.delete(path);
  else notesExpandedFolders.add(path);
  persistNotesUI();
  renderTreeOnly();
}

function collapseAllFolders() {
  notesExpandedFolders.clear();
  persistNotesUI();
  renderTreeOnly();
}

async function renameFolder(oldPath) {
  const newName = await showPrompt('Renomear pasta', `Renomear "${oldPath}"`, oldPath);
  if (!newName || newName === oldPath) return;
  const affected = notes.filter(n => n.category === oldPath || (n.category || '').startsWith(oldPath + '/'));
  for (const n of affected) {
    const newCat = (n.category || '').replace(oldPath, newName);
    await updateNote(n.id, { category: newCat }, { skipRender: true });
  }
  renderNotes();
}

async function deleteFolder(path) {
  const inFolder = notes.filter(n => n.category === path || (n.category || '').startsWith(path + '/'));
  const ok = await showConfirm('Excluir pasta', `Excluir "${path}" e todas as ${inFolder.length} anotações dentro?`);
  if (!ok) return;
  for (const n of inFolder) {
    notes = notes.filter(nn => nn.id !== n.id);
    closeTab(n.id);
    try { await sbFetch(`notes?id=eq.${n.id}`, 'DELETE'); } catch (e) {}
  }
  notesExpandedFolders.delete(path);
  renderNotes();
}

// ── Renderização ──
function renderNotes() {
  const dScope = document.getElementById('d-notes-scope');
  if (dScope && dScope.value !== noteFilter.scope) dScope.value = noteFilter.scope;
  const mScope = document.getElementById('m-notes-scope');
  if (mScope && mScope.value !== noteFilter.scope) mScope.value = noteFilter.scope;
  renderTreeOnly();
  renderTabs();
  renderEditor();
  renderOutline();
  renderTagCloud();
  renderStatusbar();
  persistNotesUI();
}

function renderTreeOnly() {
  const tree = buildFolderTree(getScopedNotes());
  const html = treeNodeHTML(tree, true);
  const dT = document.getElementById('d-notes-tree'); if (dT) dT.innerHTML = html || `<div class="obsd-tree-empty">Nenhuma anotação.<br>Clique no ícone <strong>+</strong> para criar.</div>`;
  const mT = document.getElementById('m-notes-tree'); if (mT) mT.innerHTML = html || `<div class="obsd-tree-empty">Nenhuma anotação.<br>Toque em <strong>+</strong> para criar.</div>`;
}

function treeNodeHTML(node, isRoot) {
  let html = '';
  // Pastas (ordem alfabética)
  Object.keys(node.folders).sort((a, b) => a.localeCompare(b)).forEach(name => {
    const child = node.folders[name];
    const path = child.path;
    const open = notesExpandedFolders.has(path);
    const count = countNotesInFolder(child);
    html += `<div class="obsd-tree-row folder" onclick="toggleFolder('${esc(path)}')" title="${esc(path)}">
      <span class="obsd-tree-caret ${open ? 'open' : ''}">▶</span>
      <span class="obsd-tree-icon">${open
        ? '<svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M19 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 3h8a2 2 0 0 1 2 2v9z"/></svg>'
        : '<svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>'}</span>
      <span class="obsd-tree-label">${esc(name)} <span style="color:var(--text3);font-size:10px">(${count})</span></span>
      <span class="obsd-folder-actions">
        <button onclick="event.stopPropagation();createNote('${esc(path)}')" title="Nova nota aqui">＋</button>
        <button onclick="event.stopPropagation();renameFolder('${esc(path)}')" title="Renomear">✎</button>
        <button onclick="event.stopPropagation();deleteFolder('${esc(path)}')" title="Excluir">×</button>
      </span>
    </div>`;
    html += `<div class="obsd-tree-children ${open ? 'open' : ''}" style="padding-left:14px">${treeNodeHTML(child, false)}</div>`;
  });
  // Notas dessa pasta
  const sortedNotes = node.notes.slice().sort((a, b) => {
    if (!!b.pinned - !!a.pinned !== 0) return !!b.pinned - !!a.pinned;
    return (b.updated_at || '').localeCompare(a.updated_at || '');
  });
  sortedNotes.forEach(n => {
    const isActive = n.id === activeNoteId;
    const isOpen = notesOpenTabs.includes(n.id);
    const title = n.title || '(sem título)';
    html += `<div class="obsd-tree-row note ${isActive ? 'active' : isOpen ? 'opened' : ''}" onclick="selectNote('${n.id}')" title="${esc(title)}">
      <span class="obsd-tree-caret"></span>
      <span class="obsd-tree-icon"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>
      <span class="obsd-tree-label">${esc(title)}</span>
      ${n.pinned ? '<span class="obsd-tree-pin" title="Fixada">📌</span>' : ''}
    </div>`;
  });
  return html;
}

function countNotesInFolder(node) {
  let c = node.notes.length;
  Object.values(node.folders).forEach(f => { c += countNotesInFolder(f); });
  return c;
}

// ── Tabs ──
function renderTabs() {
  const tabsEl = document.getElementById('d-notes-tabs');
  if (!tabsEl) return;
  if (!notesOpenTabs.length) {
    tabsEl.innerHTML = '<div class="obsd-tabs-empty">Nenhuma aba aberta. Clique em uma anotação na árvore.</div>';
    return;
  }
  tabsEl.innerHTML = notesOpenTabs.map(id => {
    const n = notes.find(nn => nn.id === id);
    if (!n) return '';
    const title = n.title || '(sem título)';
    const isActive = id === activeNoteId;
    return `<div class="obsd-tab ${isActive ? 'active' : ''}" onclick="selectNote('${id}')" title="${esc(n.category ? n.category + '/' : '')}${esc(title)}">
      <span class="obsd-tab-title">${esc(title)}</span>
      <span class="obsd-tab-close" onclick="event.stopPropagation();closeTab('${id}')" title="Fechar (Ctrl+W)">×</span>
    </div>`;
  }).join('');
}

// ── Editor ──
function setNotesViewMode(m) { notesViewMode = m; persistNotesUI(); renderEditor(); }

function renderEditor() {
  const wrap = document.getElementById('d-notes-editor');
  const wrapM = document.getElementById('m-notes-editor');
  const n = notes.find(nn => nn.id === activeNoteId);
  if (!n) {
    if (wrap) wrap.innerHTML = `<div class="obsd-editor-empty">
      <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <div>Nenhuma anotação aberta</div>
      <div style="font-size:12px">Pressione <kbd>Ctrl+N</kbd> para criar uma nova</div>
    </div>`;
    if (wrapM) { wrapM.style.display = 'none'; }
    const mTree = document.getElementById('m-notes-tree'); if (mTree) mTree.style.display = 'block';
    return;
  }
  const cats = [...new Set(notes.map(nn => nn.category).filter(Boolean))];
  const catsOpts = cats.map(c => `<option value="${esc(c)}">`).join('');
  const board = n.board_id ? boards.find(b => b.id === n.board_id) : null;
  const boardOpts = `<option value="">— sem vínculo —</option>` +
    boards.map(b => `<option value="${b.id}" ${b.id === n.board_id ? 'selected' : ''}>${esc(b.name)}</option>`).join('');
  const tagsHTML = (n.tags || []).map(t => `
    <span class="obsd-tag">#${esc(t)}<button onclick="removeNoteTag('${n.id}','${esc(t)}')" title="Remover">×</button></span>
  `).join('');

  const previewHTML = renderObsdMarkdown(n.content || '*Anotação vazia*');

  const html = `
    <div class="obsd-editor-head">
      <input id="obsd-title-input" class="obsd-title-input" placeholder="Sem título"
        value="${esc(n.title || '')}" oninput="onNoteTitleInput('${n.id}', this.value)">
      <div class="obsd-mode-toggle" title="Modo de visualização">
        <button class="obsd-mode-btn ${notesViewMode === 'source' ? 'active' : ''}" onclick="setNotesViewMode('source')" title="Só fonte">📝</button>
        <button class="obsd-mode-btn ${notesViewMode === 'split' ? 'active' : ''}" onclick="setNotesViewMode('split')" title="Lado a lado">⇆</button>
        <button class="obsd-mode-btn ${notesViewMode === 'preview' ? 'active' : ''}" onclick="setNotesViewMode('preview')" title="Só preview">👁</button>
      </div>
      <button class="obsd-head-btn ${n.pinned ? 'pinned' : ''}" onclick="togglePinNote('${n.id}')" title="Fixar">📌</button>
      <button class="obsd-head-btn" onclick="deleteNote('${n.id}')" title="Excluir">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
      </button>
    </div>
    <div class="obsd-meta-row">
      <input class="obsd-meta-input obsd-meta-folder" list="obsd-cats" value="${esc(n.category || '')}"
        placeholder="sem pasta" onchange="updateNote('${n.id}', { category: this.value.trim() })">
      <datalist id="obsd-cats">${catsOpts}</datalist>
      <select class="obsd-meta-input obsd-meta-board" onchange="updateNote('${n.id}', { board_id: this.value || null })">${boardOpts}</select>
      <div class="obsd-meta-tagbox">
        ${tagsHTML}
        <input class="obsd-tag-input" placeholder="+ tag" onkeydown="onNoteTagKey(event, '${n.id}')">
      </div>
    </div>
    <div class="obsd-editor-body mode-${notesViewMode}">
      <div class="obsd-source">
        <textarea id="obsd-content-area" class="obsd-textarea" placeholder="# Comece a escrever…&#10;&#10;**negrito**, *itálico*, \`código\`, [link](url)&#10;&#10;- Lista&#10;1. Numerada&#10;> Quote&#10;\`\`\`&#10;bloco de código&#10;\`\`\`"
          oninput="onNoteContentInput('${n.id}', this.value)" onscroll="syncPreviewScroll()">${esc(n.content || '')}</textarea>
      </div>
      <div class="obsd-divider"></div>
      <div class="obsd-preview" id="obsd-preview-pane">
        <div class="obsd-md">${previewHTML}</div>
      </div>
    </div>
  `;
  if (wrap) wrap.innerHTML = html;
  if (wrapM) {
    wrapM.innerHTML = `<button class="obsd-m-back" onclick="closeMNoteEditor()">‹ Voltar</button>` + html;
    wrapM.style.display = 'flex';
    const mTree = document.getElementById('m-notes-tree'); if (mTree) mTree.style.display = 'none';
  }
}

function syncPreviewScroll() {
  if (notesViewMode !== 'split') return;
  const ta = document.getElementById('obsd-content-area');
  const pv = document.getElementById('obsd-preview-pane');
  if (!ta || !pv) return;
  const ratio = ta.scrollTop / Math.max(1, ta.scrollHeight - ta.clientHeight);
  pv.scrollTop = ratio * Math.max(1, pv.scrollHeight - pv.clientHeight);
}

function closeMNoteEditor() {
  activeNoteId = null;
  const ed = document.getElementById('m-notes-editor'); if (ed) ed.style.display = 'none';
  const ml = document.getElementById('m-notes-tree'); if (ml) ml.style.display = 'block';
  renderNotes();
}

function onNoteTitleInput(id, v) {
  debouncedSaveNote(id, { title: v });
  // re-render tabs e tree pra mostrar título atualizado, mas não o editor (manteria foco)
  renderTabs();
  renderTreeOnly();
  renderStatusbar();
}

function onNoteContentInput(id, v) {
  debouncedSaveNote(id, { content: v });
  // atualiza preview e outline em tempo real
  const pv = document.getElementById('obsd-preview-pane');
  if (pv) pv.querySelector('.obsd-md').innerHTML = renderObsdMarkdown(v || '*Anotação vazia*');
  renderOutline();
  renderStatusbar();
}

function onNoteTagKey(e, id) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const v = e.target.value.trim().replace(/^#/, '');
    if (!v) return;
    const n = notes.find(nn => nn.id === id);
    if (!n) return;
    const tags = [...(n.tags || [])];
    if (!tags.includes(v)) tags.push(v);
    e.target.value = '';
    updateNote(id, { tags });
  }
}

function removeNoteTag(id, tag) {
  const n = notes.find(nn => nn.id === id);
  if (!n) return;
  updateNote(id, { tags: (n.tags || []).filter(t => t !== tag) });
}

// ── Outline (headings da nota ativa) ──
function renderOutline() {
  const el = document.getElementById('d-notes-outline');
  if (!el) return;
  const n = notes.find(nn => nn.id === activeNoteId);
  if (!n) { el.innerHTML = '<div class="obsd-outline-empty">Sem anotação aberta.</div>'; return; }
  const headings = [];
  (n.content || '').split('\n').forEach((line, i) => {
    const m = /^(#{1,4})\s+(.+)/.exec(line);
    if (m) headings.push({ level: m[1].length, text: m[2].trim(), line: i });
  });
  if (!headings.length) { el.innerHTML = '<div class="obsd-outline-empty">Nenhum título nesta nota.</div>'; return; }
  el.innerHTML = headings.map(h =>
    `<div class="obsd-outline-item obsd-outline-h${h.level}" onclick="scrollToHeading(${h.line})">${esc(h.text)}</div>`
  ).join('');
}

function scrollToHeading(line) {
  const ta = document.getElementById('obsd-content-area');
  if (!ta) return;
  const lines = ta.value.split('\n');
  let pos = 0;
  for (let i = 0; i < line && i < lines.length; i++) pos += lines[i].length + 1;
  ta.focus();
  ta.setSelectionRange(pos, pos);
  // move scroll
  const lh = parseFloat(getComputedStyle(ta).lineHeight) || 22;
  ta.scrollTop = Math.max(0, line * lh - 40);
}

function renderTagCloud() {
  const el = document.getElementById('d-notes-tagcloud');
  if (!el) return;
  const allTags = [...new Set(notes.flatMap(n => n.tags || []))].sort();
  if (!allTags.length) { el.innerHTML = '<div class="obsd-outline-empty">Sem tags.</div>'; return; }
  el.innerHTML = allTags.map(t => {
    const active = noteFilter.tags.includes(t);
    return `<span class="obsd-tag" style="${active ? 'background:var(--accent);color:#fff' : ''}" onclick="toggleNoteTagFilter('${esc(t)}')">#${esc(t)}</span>`;
  }).join('');
}

function renderStatusbar() {
  const el = document.getElementById('d-notes-statusbar');
  if (!el) return;
  const n = notes.find(nn => nn.id === activeNoteId);
  if (!n) { el.innerHTML = `<span>${notes.length} anotações no total</span>`; return; }
  const txt = n.content || '';
  const words = (txt.match(/\S+/g) || []).length;
  const chars = txt.length;
  const lines = txt.split('\n').length;
  const updated = new Date(n.updated_at || Date.now());
  el.innerHTML = `
    <span>${lines} linhas</span>
    <span>${words} palavras</span>
    <span>${chars} caracteres</span>
    <span>Salva ${updated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
  `;
}

// ── Markdown render Obsidian-like ──
function renderObsdMarkdown(text) {
  if (!text) return '';
  // Escape HTML primeiro
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Code blocks ```
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
    `<pre><code class="lang-${lang}">${code.replace(/\n$/, '')}</code></pre>`);
  // Headings
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>')
             .replace(/^### (.+)$/gm, '<h3>$1</h3>')
             .replace(/^## (.+)$/gm, '<h2>$1</h2>')
             .replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // Horizontal rule
  html = html.replace(/^---+$/gm, '<hr>');
  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  // Lists (linha por linha — simples)
  html = html.replace(/^(\s*)[-*] (.+)$/gm, '<li>$2</li>');
  html = html.replace(/^(\s*)\d+\. (.+)$/gm, '<li class="ol">$2</li>');
  html = html.replace(/(<li class="ol">.*?<\/li>(\n|$))+/gs, m => `<ol>${m.replace(/ class="ol"/g, '')}</ol>`);
  html = html.replace(/(<li>(?!<\/).*?<\/li>(\n|$))+/gs, m => `<ul>${m}</ul>`);
  // Inline: bold, italic, code, links
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  // Parágrafos: linhas simples viram <p>
  html = html.split(/\n{2,}/).map(block => {
    if (/^\s*<(h\d|pre|ul|ol|blockquote|hr)/.test(block)) return block;
    if (!block.trim()) return '';
    return '<p>' + block.replace(/\n/g, '<br>') + '</p>';
  }).join('\n');
  return html;
}

// ── Atalhos ──
document.addEventListener('keydown', e => {
  if (dView !== 'notes' && mView !== 'notes') return;
  const inEditable = e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
  // Ctrl+N: nova nota
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n' && !e.shiftKey) {
    e.preventDefault();
    createNote();
  }
  // Ctrl+W: fecha aba
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w' && activeNoteId) {
    e.preventDefault();
    closeTab(activeNoteId);
    renderNotes();
  }
  // Ctrl+E: alterna source/preview/split
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
    e.preventDefault();
    const seq = ['source', 'split', 'preview'];
    const i = seq.indexOf(notesViewMode);
    setNotesViewMode(seq[(i + 1) % seq.length]);
  }
  // Ctrl+Tab / Ctrl+Shift+Tab: navega tabs
  if ((e.ctrlKey || e.metaKey) && e.key === 'Tab' && notesOpenTabs.length > 1) {
    e.preventDefault();
    const i = notesOpenTabs.indexOf(activeNoteId);
    const next = e.shiftKey
      ? (i - 1 + notesOpenTabs.length) % notesOpenTabs.length
      : (i + 1) % notesOpenTabs.length;
    selectNote(notesOpenTabs[next]);
  }
});
