// ══════════════════════════
// ANOTAÇÕES
// ══════════════════════════

function genNoteId() {
  return 'n_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function loadNotes() {
  try {
    const data = await sbFetch('notes?order=updated_at.desc');
    notes = data || [];
  } catch (e) {
    console.warn('[Notes] Falha ao carregar (verifique se a tabela `notes` existe no Supabase):', e?.message || e);
    notes = [];
  }
}

async function createNote() {
  const now = new Date().toISOString();
  const note = {
    id: genNoteId(),
    title: '',
    content: '',
    category: '',
    tags: [],
    board_id: null,
    card_id: null,
    pinned: false,
    created_at: now,
    updated_at: now
  };
  notes.unshift(note);
  activeNoteId = note.id;
  noteEditorTab = 'edit';
  renderNotes();
  setTimeout(() => document.getElementById('note-title-input')?.focus(), 80);
  try {
    await sbFetch('notes', 'POST', note);
  } catch (e) {
    toast('Erro ao criar anotação', '#ef4444');
    notes = notes.filter(n => n.id !== note.id);
    if (activeNoteId === note.id) activeNoteId = null;
    renderNotes();
  }
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
      // re-renderiza só a lista (mantém foco do textarea)
      renderNotesListOnly();
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
  if (activeNoteId === id) activeNoteId = null;
  renderNotes();
  try {
    await sbFetch(`notes?id=eq.${id}`, 'DELETE');
  } catch (e) {
    toast('Erro ao excluir', '#ef4444');
  }
}

function selectNote(id) {
  activeNoteId = id;
  noteEditorTab = 'edit';
  renderNotes();
}

function togglePinNote(id) {
  const n = notes.find(nn => nn.id === id);
  if (!n) return;
  updateNote(id, { pinned: !n.pinned });
}

function setNoteScope(s) {
  noteFilter.scope = s;
  renderNotes();
}

function onNotesSearch(v) {
  noteFilter.q = (v || '').toLowerCase().trim();
  renderNotesListOnly();
}

function toggleNoteCatFilter(cat) {
  noteFilter.category = noteFilter.category === cat ? '' : cat;
  renderNotes();
}

function toggleNoteTagFilter(tag) {
  const i = noteFilter.tags.indexOf(tag);
  if (i === -1) noteFilter.tags.push(tag);
  else noteFilter.tags.splice(i, 1);
  renderNotes();
}

function setNoteEditorTab(t) {
  noteEditorTab = t;
  renderNoteEditor();
}

function getFilteredNotes() {
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
  if (noteFilter.category) list = list.filter(n => n.category === noteFilter.category);
  if (noteFilter.tags.length) list = list.filter(n => noteFilter.tags.every(t => (n.tags || []).includes(t)));
  list.sort((a, b) => {
    if (!!b.pinned - !!a.pinned !== 0) return !!b.pinned - !!a.pinned;
    return (b.updated_at || '').localeCompare(a.updated_at || '');
  });
  return list;
}

function renderNotes() {
  // sincroniza scope select
  const dScope = document.getElementById('d-notes-scope');
  if (dScope && dScope.value !== noteFilter.scope) dScope.value = noteFilter.scope;
  const mScope = document.getElementById('m-notes-scope');
  if (mScope && mScope.value !== noteFilter.scope) mScope.value = noteFilter.scope;
  renderNotesFilters();
  renderNotesListOnly();
  renderNoteEditor();
}

function renderNotesFilters() {
  const allCats = [...new Set(notes.map(n => n.category).filter(Boolean))].sort();
  const allTags = [...new Set(notes.flatMap(n => n.tags || []))].sort();
  const catsHTML = allCats.length
    ? allCats.map(c => `<button class="notes-chip ${noteFilter.category === c ? 'active' : ''}" onclick="toggleNoteCatFilter('${esc(c)}')">📁 ${esc(c)}</button>`).join('')
    : '';
  const tagsHTML = allTags.length
    ? allTags.map(t => `<button class="notes-chip ${noteFilter.tags.includes(t) ? 'active' : ''}" onclick="toggleNoteTagFilter('${esc(t)}')">#${esc(t)}</button>`).join('')
    : '';
  const dCats = document.getElementById('d-notes-cats'); if (dCats) dCats.innerHTML = catsHTML;
  const dTags = document.getElementById('d-notes-tags'); if (dTags) dTags.innerHTML = tagsHTML;
}

function renderNotesListOnly() {
  const list = getFilteredNotes();
  const html = list.length
    ? list.map(noteItemHTML).join('')
    : `<div class="notes-empty-list">Nenhuma anotação. Clique em + Nova para começar.</div>`;
  const dList = document.getElementById('d-notes-list'); if (dList) dList.innerHTML = html;
  const mList = document.getElementById('m-notes-list'); if (mList) mList.innerHTML = html;
}

function noteItemHTML(n) {
  const isActive = n.id === activeNoteId;
  const title = n.title || '(sem título)';
  const preview = (n.content || '').replace(/[#*`>\-_\[\]]/g, '').slice(0, 120) || 'Vazia';
  const board = n.board_id ? boards.find(b => b.id === n.board_id) : null;
  const meta = [
    n.category ? `<span class="note-meta-cat">📁 ${esc(n.category)}</span>` : '',
    board ? `<span class="note-meta-board" style="color:${board.color}">📋 ${esc(board.name)}</span>` : '',
    `<span class="note-meta-date">${fmtNoteDate(n.updated_at)}</span>`
  ].filter(Boolean).join(' · ');
  return `<div class="note-item ${isActive ? 'active' : ''}" onclick="selectNote('${n.id}')">
    <div class="note-item-row">
      ${n.pinned ? '<span class="note-pinned-icon" title="Fixada">📌</span>' : ''}
      <div class="note-item-title">${esc(title)}</div>
    </div>
    <div class="note-item-preview">${esc(preview)}</div>
    <div class="note-item-meta">${meta}</div>
  </div>`;
}

function fmtNoteDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toTimeString().slice(0, 5);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function renderNoteEditor() {
  const editorD = document.getElementById('d-notes-editor');
  const editorM = document.getElementById('m-notes-editor');
  const n = notes.find(nn => nn.id === activeNoteId);
  if (!n) {
    if (editorD) editorD.innerHTML = `<div class="notes-empty">Selecione ou crie uma anotação</div>`;
    if (editorM) { editorM.style.display = 'none'; }
    const mList = document.getElementById('m-notes-list'); if (mList) mList.style.display = 'block';
    return;
  }
  // Sugestões de categoria
  const cats = [...new Set(notes.map(nn => nn.category).filter(Boolean))];
  const catsOpts = cats.map(c => `<option value="${esc(c)}">`).join('');
  const board = n.board_id ? boards.find(b => b.id === n.board_id) : null;
  const boardOpts = `<option value="">— Sem vínculo —</option>` +
    boards.map(b => `<option value="${b.id}" ${b.id === n.board_id ? 'selected' : ''}>${esc(b.name)}</option>`).join('');

  const tagsHTML = (n.tags || []).map(t => `
    <span class="note-tag-chip">#${esc(t)}<button onclick="removeNoteTag('${n.id}','${esc(t)}')" title="Remover">×</button></span>
  `).join('');

  const previewHTML = renderMarkdown(n.content || '*Vazia*');

  const html = `
    <div class="notes-editor-head">
      <div class="notes-editor-toprow">
        <input id="note-title-input" class="note-title-input" placeholder="Título da anotação"
          value="${esc(n.title || '')}" oninput="onNoteTitleInput('${n.id}', this.value)">
        <button class="note-pin-btn ${n.pinned ? 'pinned' : ''}" onclick="togglePinNote('${n.id}')" title="Fixar no topo">📌</button>
        <button class="note-del-btn" onclick="deleteNote('${n.id}')" title="Excluir anotação">
          <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
      <div class="notes-editor-meta">
        <label>Categoria
          <input class="note-meta-input" list="note-cat-suggestions" value="${esc(n.category || '')}"
            placeholder="ex: Pessoal" onchange="updateNote('${n.id}', { category: this.value.trim() })">
          <datalist id="note-cat-suggestions">${catsOpts}</datalist>
        </label>
        <label>Vincular a quadro
          <select class="note-meta-input" onchange="updateNote('${n.id}', { board_id: this.value || null })">${boardOpts}</select>
        </label>
      </div>
      <div class="notes-editor-tags-row">
        <div class="note-tags-box">
          ${tagsHTML}
          <input class="note-tag-input" placeholder="Enter para add tag…"
            onkeydown="onNoteTagKey(event, '${n.id}')">
        </div>
      </div>
    </div>
    <div class="notes-editor-tabs">
      <button class="notes-editor-tab ${noteEditorTab === 'edit' ? 'active' : ''}" onclick="setNoteEditorTab('edit')">✏ Editar</button>
      <button class="notes-editor-tab ${noteEditorTab === 'preview' ? 'active' : ''}" onclick="setNoteEditorTab('preview')">👁 Preview</button>
      <span class="notes-editor-saved">${board ? `📋 ${esc(board.name)} · ` : ''}Atualizada ${fmtNoteDate(n.updated_at)}</span>
    </div>
    <div class="notes-editor-body">
      ${noteEditorTab === 'edit'
        ? `<textarea class="note-content-area" placeholder="Escreva em Markdown…\n\n# Título\n- item\n**negrito** *itálico* \`código\`"
            oninput="onNoteContentInput('${n.id}', this.value)">${esc(n.content || '')}</textarea>`
        : `<div class="note-preview markdown-body">${previewHTML}</div>`}
    </div>
  `;
  if (editorD) editorD.innerHTML = html;
  if (editorM) {
    editorM.innerHTML = `<button class="m-notes-back" onclick="closeMNoteEditor()">‹ Voltar</button>` + html;
    editorM.style.display = 'flex';
    const mList = document.getElementById('m-notes-list'); if (mList) mList.style.display = 'none';
  }
}

function closeMNoteEditor() {
  activeNoteId = null;
  const ed = document.getElementById('m-notes-editor'); if (ed) ed.style.display = 'none';
  const ml = document.getElementById('m-notes-list'); if (ml) ml.style.display = 'block';
  renderNotes();
}

function onNoteTitleInput(id, v) {
  debouncedSaveNote(id, { title: v });
}

function onNoteContentInput(id, v) {
  debouncedSaveNote(id, { content: v });
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
