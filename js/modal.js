// ── MODAL — Tags ──
function renderTagPills() {
  const box = document.getElementById('tags-box');
  box.querySelectorAll('.ftag').forEach(p => p.remove());
  const input = document.getElementById('tag-input');
  currentTags.forEach((tag, i) => {
    const pill = document.createElement('div'); pill.className = 'ftag';
    pill.innerHTML = `${esc(tag)}<button type="button" onclick="removeTag(${i})">×</button>`;
    box.insertBefore(pill, input);
  });
  // Atualiza sugestões excluindo tags já adicionadas
  const dl = document.getElementById('tag-suggestions');
  if (dl) {
    const allBoardTags = [...new Set(cards.filter(c => c.board_id === activeBoardId).flatMap(c => c.tags || []))];
    dl.innerHTML = allBoardTags.filter(t => !currentTags.includes(t)).map(t => `<option value="${esc(t)}">`).join('');
  }
}
function removeTag(i) { currentTags.splice(i, 1); renderTagPills(); }
function handleTagKey(e) {
  if ((e.key === 'Enter' || e.key === ',') && e.target.value.trim()) {
    e.preventDefault(); const v = e.target.value.trim().replace(/,/g, '');
    if (v && !currentTags.includes(v)) { currentTags.push(v); renderTagPills(); }
    e.target.value = '';
  }
  if (e.key === 'Backspace' && !e.target.value && currentTags.length) { currentTags.pop(); renderTagPills(); }
}

// ── MODAL — Assignees ──
let currentAssignees = [];
function renderAssigneePills() {
  const box = document.getElementById('assignee-box');
  if (!box) return;
  box.querySelectorAll('.ftag').forEach(p => p.remove());
  const input = document.getElementById('assignee-input');
  currentAssignees.forEach((assignee, i) => {
    const pill = document.createElement('div'); pill.className = 'ftag';
    pill.innerHTML = `${esc(assignee)}<button type="button" onclick="removeAssignee(${i})">×</button>`;
    box.insertBefore(pill, input);
  });
  // Suggestions
  const dl = document.getElementById('assignee-suggestions');
  if (dl) {
    const allBoardAssignees = [...new Set(cards.filter(c => c.board_id === activeBoardId).flatMap(c => c.assignees || (c.assignee ? [c.assignee] : [])))];
    dl.innerHTML = allBoardAssignees.filter(a => !currentAssignees.includes(a)).map(a => `<option value="${esc(a)}">`).join('');
  }
}
function removeAssignee(i) { currentAssignees.splice(i, 1); renderAssigneePills(); }
function handleAssigneeKey(e) {
  if ((e.key === 'Enter' || e.key === ',') && e.target.value.trim()) {
    e.preventDefault(); const v = e.target.value.trim().replace(/,/g, '');
    if (v && !currentAssignees.includes(v)) { currentAssignees.push(v); renderAssigneePills(); }
    e.target.value = '';
  }
  if (e.key === 'Backspace' && !e.target.value && currentAssignees.length) { currentAssignees.pop(); renderAssigneePills(); }
}

// ── MODAL — Checklist editor ──
function renderChecklistEditor() {
  document.getElementById('checklist-editor').innerHTML = currentChecklist.map((item, i) => `
    <div class="ce-item">
      <input type="text" value="${esc(item.text)}" placeholder="Item…" oninput="currentChecklist[${i}].text=this.value" onkeydown="handleChecklistKey(event, ${i})" class="frow" style="margin:0">
      <button type="button" onclick="removeCheckItem(${i})">✕</button>
    </div>`).join('');
}
function handleChecklistKey(e, i) {
  if (e.key === 'Enter') {
    e.preventDefault();
    currentChecklist[i].text = e.target.value;
    currentChecklist.splice(i + 1, 0, { text: '', done: false });
    renderChecklistEditor();
    const inputs = document.querySelectorAll('.ce-item input[type=text]');
    if (inputs[i + 1]) inputs[i + 1].focus();
  } else if (e.key === 'Backspace' && e.target.value === '') {
    e.preventDefault();
    removeCheckItem(i);
    const inputs = document.querySelectorAll('.ce-item input[type=text]');
    if (inputs[i - 1]) {
      inputs[i - 1].focus();
      inputs[i - 1].selectionStart = inputs[i - 1].value.length;
    } else if (inputs[0]) {
      inputs[0].focus();
    }
  }
}
function addCheckItem() {
  currentChecklist.push({ text: '', done: false }); renderChecklistEditor();
  const inputs = document.querySelectorAll('.ce-item input[type=text]');
  inputs[inputs.length - 1]?.focus();
}
function removeCheckItem(i) { currentChecklist.splice(i, 1); renderChecklistEditor(); }

// ── MODAL — Abrir/Fechar ──
function openModal(colId, cardId) {
  editingCardId = cardId || null; currentTags = []; currentAssignees = []; currentChecklist = []; currentDeps = [];
  document.getElementById('modal-htitle-text').textContent = cardId ? 'Editar tarefa' : 'Nova tarefa';
  const defaultColId = getActiveCols()[0]?.col_id || 'backlog';
  document.getElementById('f-col').innerHTML = getActiveCols().map(c =>
    `<option value="${c.col_id}" ${c.col_id === (cardId ? cards.find(x => x.id === cardId)?.col : colId || defaultColId) ? 'selected' : ''}>${c.label}</option>`).join('');
  if (cardId) {
    const c = cards.find(x => x.id === cardId);
    document.getElementById('f-title').value = c.title;
    document.getElementById('f-priority').value = c.priority;
    document.getElementById('f-effort').value = c.effort || '';
    document.getElementById('f-due').value = c.due || '';
    document.getElementById('f-notes').value = c.notes || '';
    currentTags = [...(c.tags || [])];
    currentAssignees = [...(c.assignees || (c.assignee ? [c.assignee] : []))];
    currentDeps = [...(c.deps || [])];
    currentChecklist = (c.checklist || []).map(x => ({ ...x }));
  } else {
    ['f-title', 'f-due', 'f-notes'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('f-priority').value = 'media';
    document.getElementById('f-effort').value = '';
  }
  document.getElementById('tag-input').value = '';
  const allBoardTags = [...new Set(cards.filter(c => c.board_id === activeBoardId).flatMap(c => c.tags || []))];
  const dl = document.getElementById('tag-suggestions');
  if (dl) dl.innerHTML = allBoardTags.map(t => `<option value="${esc(t)}">`).join('');
  renderTagPills(); renderAssigneePills(); renderChecklistEditor();
  populateDepSelect(cardId || null); renderDepList();
  renderModalHistory(cardId);
  // Mostra botões só no modo edição
  const delBtn = document.getElementById('modal-delete-btn');
  if (delBtn) delBtn.style.display = cardId ? 'flex' : 'none';
  const dupBtn = document.getElementById('modal-dup-btn');
  if (dupBtn) dupBtn.style.display = cardId ? 'flex' : 'none';
  const remBtn = document.getElementById('modal-rem-btn');
  if (remBtn) remBtn.style.display = cardId ? 'flex' : 'none';
  document.getElementById('modal').style.display = 'flex';
  setTimeout(() => document.getElementById('f-title').focus(), 80);
}
function closeModal() { document.getElementById('modal').style.display = 'none'; editingCardId = null; }

function renderModalHistory(cardId) {
  const row = document.getElementById('history-row');
  const box = document.getElementById('modal-history');
  if (!row || !box) return;
  if (!cardId) { row.style.display = 'none'; return; }
  const c = cards.find(x => x.id === cardId);
  const moves = (c?.history || []).filter(h => /^Movido para /.test(h.msg || ''));
  row.style.display = 'flex';
  if (!moves.length) {
    box.innerHTML = `<div class="modal-history-empty">Sem movimentações de coluna ainda.</div>`;
    return;
  }
  box.innerHTML = moves.slice().reverse().map(h => `
    <div class="hist-item">
      <span class="hist-dot"></span>
      <span class="hist-item-label">${esc(h.msg)}</span>
      <span class="hist-item-time" title="${esc(fmtDateFull(h.ts))}">${esc(relTime(h.ts))}</span>
    </div>`).join('');
}

async function modalDeleteCard() {
  if (!editingCardId) return;
  closeModal();
  await deleteCard(editingCardId);
}

// ── MODAL — Duplicar tarefa ──
async function modalDuplicateCard() {
  if (!editingCardId) return;
  const src = cards.find(x => x.id === editingCardId);
  if (!src) return;
  const now = new Date().toISOString();
  const destSorted = getSortedColCards(src.col, activeBoardId);
  const maxPos = destSorted.reduce((max, c) => Math.max(max, c.position || 0), 0);
  const payload = {
    board_id: src.board_id,
    title: `Cópia de ${src.title}`,
    col: src.col,
    priority: src.priority,
    assignees: [...(src.assignees || (src.assignee ? [src.assignee] : []))],
    due: src.due || null,
    effort: src.effort || '',
    tags: [...(src.tags || [])],
    checklist: (src.checklist || []).map(x => ({ text: x.text, done: false })),
    notes: src.notes || '',
    deps: [],
    position: maxPos + 100,
    history: [{ msg: 'Criado (duplicado)', ts: now }],
  };
  closeModal();
  const res = await sbFetch('cards', 'POST', payload);
  if (res && res[0]) cards.push({ ...res[0], deps: payload.deps });
  else cards.push({ ...payload, id: 'card_' + Date.now(), created_at: now });
  render();
  toast('Tarefa duplicada!');
}



// ── MODAL — Salvar/Editar/Deletar ──
async function saveCard() {
  let celebrateId = null;
  const title = document.getElementById('f-title').value.trim();
  if (!title) { document.getElementById('f-title').focus(); return; }
  const tagVal = document.getElementById('tag-input').value.trim().replace(/,/g, '');
  if (tagVal && !currentTags.includes(tagVal)) currentTags.push(tagVal);
  const assignVal = document.getElementById('assignee-input').value.trim().replace(/,/g, '');
  if (assignVal && !currentAssignees.includes(assignVal)) currentAssignees.push(assignVal);
  document.querySelectorAll('.ce-item input[type=text]').forEach((inp, i) => { if (currentChecklist[i]) currentChecklist[i].text = inp.value; });
  const data = {
    title, col: document.getElementById('f-col').value,
    priority: document.getElementById('f-priority').value,
    assignees: [...currentAssignees],
    effort: document.getElementById('f-effort').value,
    due: document.getElementById('f-due').value || null,
    tags: [...currentTags],
    checklist: currentChecklist.filter(x => x.text.trim()),
    notes: document.getElementById('f-notes').value.trim(),
    deps: [...currentDeps],
  };
  if (editingCardId) {
    const c = cards.find(x => x.id === editingCardId);
    const hist = [...(c.history || [])];
    if (c.col !== data.col) {
      const col = getActiveCols().find(cl => cl.col_id === data.col);
      const nowTs = new Date().toISOString();
      hist.push({ msg: `Movido para ${col?.label}`, ts: nowTs });
      if (isDoneCol(data.col)) { data.done_at = nowTs; hist.push({ msg: 'Concluído', ts: nowTs }); celebrateId = editingCardId; }
    }
    data.history = hist; Object.assign(c, data);
    await sbFetch(`cards?id=eq.${editingCardId}`, 'PATCH', data);
    toast('Tarefa atualizada');
  } else {
    const destColId = data.col || (getActiveCols()[0]?.col_id || 'backlog');
    data.col = destColId;
    const destSorted = getSortedColCards(destColId, activeBoardId);
    const maxPos = destSorted.reduce((max, c) => Math.max(max, c.position || 0), 0);
    const payload = { ...data, board_id: activeBoardId, position: maxPos + 100, history: [{ msg: 'Criado', ts: new Date().toISOString() }] };
    const res = await sbFetch('cards', 'POST', payload);
    if (res && res[0]) cards.push({ ...res[0], deps: payload.deps });
    toast('Tarefa criada!');
  }
  closeModal(); render();
  if (celebrateId) setTimeout(() => celebrateComplete(document.getElementById('card-' + celebrateId)), 120);
}

function editCard(id) { openModal(null, id); }

// ── UNDO DELETE ──
let _undoCard = null;
let _undoTimer = null;

async function deleteCard(id) {
  const ok = await showConfirm('Excluir tarefa', 'Tem certeza que deseja excluir esta tarefa?');
  if (!ok) return;
  const card = cards.find(c => c.id === id);
  if (!card) return;
  // Remove da UI imediatamente
  _undoCard = { ...card };
  cards = cards.filter(c => c.id !== id);
  render();
  // Toast com undo
  clearTimeout(_undoTimer);
  toast('Tarefa excluída', '#ef4444', { label: 'Desfazer', action: () => {
    if (_undoCard) {
      cards.push(_undoCard);
      _undoCard = null;
      render();
      toast('Tarefa restaurada!');
    }
  }});
  // Timer de 6s para deletar de verdade
  _undoTimer = setTimeout(async () => {
    if (_undoCard && _undoCard.id === id) {
      _undoCard = null;
    }
    await sbFetch(`cards?id=eq.${id}`, 'DELETE');
  }, 6000);
}

function modalCreateReminder() {
  if (!editingCardId) return;
  const c = cards.find(x => x.id === editingCardId);
  if (!c) return;
  closeModal();
  document.getElementById('d-rem-text').value = c.title;
  if (c.due) document.getElementById('d-rem-when').value = c.due + 'T09:00';
  document.getElementById('d-rem-advance').value = '60';
  toggleSidebarRemForm(true);
}

// ── DEPENDÊNCIAS ──
function renderDepList() {
  const el = document.getElementById('dep-list'); if (!el) return;
  if (!currentDeps.length) { el.innerHTML = ''; return; }
  el.innerHTML = currentDeps.map((depId, i) => {
    const c = cards.find(x => x.id === depId); if (!c) return '';
    const p = PRI[c.priority] || PRI.media;
    return `<div class="dep-item"><span class="dep-dot" style="background:${p.color}"></span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.title)}</span><button class="dep-remove" onclick="removeDep(${i})">×</button></div>`;
  }).join('');
}
function populateDepSelect(excludeId) {
  const sel = document.getElementById('f-dep-select'); if (!sel) return;
  const opts = activeCards().filter(c => c.id !== excludeId).map(c => `<option value="${c.id}">${esc(c.title)}</option>`).join('');
  sel.innerHTML = `<option value="">— Selecionar tarefa —</option>${opts}`;
}
function addDep(id) {
  if (!id || currentDeps.includes(id)) return;
  currentDeps.push(id); renderDepList();
}
function removeDep(i) { currentDeps.splice(i, 1); renderDepList(); }
function depStatusFor(c) {
  if (!(c.deps || []).length) return null;
  const allDone = (c.deps || []).every(depId => { const dep = cards.find(x => x.id === depId); return dep && isDoneCol(dep.col); });
  return allDone ? 'ready' : 'blocked';
}

// ── KEYBOARD SHORTCUTS ──
document.addEventListener('keydown', e => {
  const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
  if (e.key === 'Escape') {
    // Fecha dialogs customizados primeiro
    if (_dialogResolve) { resolveDialog(null); return; }
    closeModal(); closeBoardModal(); closeGSearch();
  }
  if (e.key === 'Enter' && e.ctrlKey && document.getElementById('modal').style.display !== 'none') saveCard();
  if (!isMobile && e.key === '/' && !inInput) { e.preventDefault(); document.getElementById('d-search').focus(); }
  if (!isMobile && e.key === 'n' && !inInput) { e.preventDefault(); openModal(); }
  if (!inInput && e.key.toLowerCase() === 'q') { e.preventDefault(); openQuickAdd(); }
});
