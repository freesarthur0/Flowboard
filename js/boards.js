// ── COLUNAS POR QUADRO ──
async function loadBoardColumns(boardId) {
  try {
    const data = await sbFetch(`board_columns?board_id=eq.${boardId}&order=position`);
    boardColumns[boardId] = data || [];
    if (!boardColumns[boardId].length) await migrateDefaultColumns(boardId);
  } catch (e) {
    boardColumns[boardId] = [];
  }
}

async function migrateDefaultColumns(boardId) {
  const rows = COLS.map((col, i) => ({
    id: `${boardId}_${col.id}`,
    board_id: boardId,
    col_id: col.id,
    label: col.label,
    color: col.color,
    position: (i + 1) * 10,
    is_done: col.id === 'done',
  }));
  try { await sbFetch('board_columns', 'POST', rows); } catch (e) { /* ignora se já existem */ }
  boardColumns[boardId] = rows;
}

function getActiveCols() {
  const cols = boardColumns[activeBoardId];
  if (cols && cols.length) return [...cols].sort((a, b) => a.position - b.position);
  // Fallback enquanto carrega
  return COLS.map((col, i) => ({
    id: `${activeBoardId}_${col.id}`,
    board_id: activeBoardId,
    col_id: col.id,
    label: col.label,
    color: col.color,
    position: (i + 1) * 10,
    is_done: col.id === 'done',
  }));
}

function isDoneCol(colId) {
  const col = getActiveCols().find(c => c.col_id === colId);
  return col ? col.is_done : colId === 'done';
}

async function addColumn() {
  const label = (await showPrompt('Nova coluna', 'Nome da nova coluna:'))?.trim();
  if (!label) return;
  const cols = getActiveCols();
  const maxPos = cols.reduce((max, c) => Math.max(max, c.position), 0);
  const col_id = 'col_' + Date.now();
  const color = BOARD_COLORS[cols.length % BOARD_COLORS.length];
  const newCol = {
    id: `${activeBoardId}_${col_id}`,
    board_id: activeBoardId,
    col_id,
    label,
    color,
    position: maxPos + 10,
    is_done: false,
  };
  boardColumns[activeBoardId] = [...cols, newCol];
  render();
  await sbFetch('board_columns', 'POST', [newCol]);
  toast(`Coluna "${label}" criada!`);
}

async function renameColumn(colId) {
  const col = getActiveCols().find(c => c.col_id === colId); if (!col) return;
  const label = (await showPrompt('Renomear coluna', 'Novo nome da coluna:', col.label))?.trim();
  if (!label || label === col.label) return;
  col.label = label;
  render();
  sbFetch(`board_columns?id=eq.${col.id}`, 'PATCH', { label });
  toast('Coluna renomeada');
}

async function setColumnWip(colId) {
  const col = getActiveCols().find(c => c.col_id === colId); if (!col) return;
  const curr = col.wip_limit || '';
  const input = await showPrompt('Limite WIP', 'Limite de tarefas (WIP)?\nDeixe vazio para remover:', String(curr));
  if (input === null) return;
  const limit = parseInt(input) || null;
  col.wip_limit = limit;
  render();
  toast('Limite WIP atualizado');
  try {
    await sbFetch(`board_columns?id=eq.${col.id}`, 'PATCH', { wip_limit: limit });
  } catch (e) {
    if (e.message?.includes('wip_limit')) {
      toast('A coluna wip_limit não existe no banco! Veja as instruções no final.', '#f59e0b');
    }
  }
}

async function recolorColumn(colId, color) {
  const col = getActiveCols().find(c => c.col_id === colId); if (!col) return;
  col.color = color;
  render();
  await sbFetch(`board_columns?id=eq.${col.id}`, 'PATCH', { color });
  toast('Cor da coluna atualizada');
}

async function setColumnDone(colId) {
  const cols = getActiveCols();
  const patches = [];
  cols.forEach(col => {
    const newDone = col.col_id === colId;
    if (col.is_done !== newDone) {
      col.is_done = newDone;
      patches.push(sbFetch(`board_columns?id=eq.${col.id}`, 'PATCH', { is_done: newDone }));
    }
  });
  await Promise.all(patches);
  render();
  toast('Coluna de conclusão atualizada');
}

async function deleteColumn(colId) {
  const cols = getActiveCols();
  const col = cols.find(c => c.col_id === colId); if (!col) return;
  if (col.is_done) { toast('Não é possível excluir a coluna de conclusão', '#f59e0b'); return; }
  if (cols.length <= 1) { toast('Precisa ter pelo menos uma coluna', '#f59e0b'); return; }
  const colCards = cards.filter(c => c.board_id === activeBoardId && c.col === colId);
  if (colCards.length) {
    const otherCols = cols.filter(c => c.col_id !== colId);
    const opts = otherCols.map((c, i) => `${i + 1}: ${c.label}`).join('\n');
    const choice = await showPrompt('Mover tarefas', `A coluna "${col.label}" tem ${colCards.length} tarefa(s).\nEscolha para onde mover (número):\n${opts}`);
    if (!choice) return;
    const idx = parseInt(choice) - 1;
    if (isNaN(idx) || !otherCols[idx]) { toast('Opção inválida', '#ef4444'); return; }
    const targetCol = otherCols[idx];
    colCards.forEach(c => { c.col = targetCol.col_id; });
    await Promise.all(colCards.map(c => sbFetch(`cards?id=eq.${c.id}`, 'PATCH', { col: targetCol.col_id })));
  }
  boardColumns[activeBoardId] = cols.filter(c => c.col_id !== colId);
  await sbFetch(`board_columns?id=eq.${col.id}`, 'DELETE');
  render();
  toast(`Coluna "${col.label}" excluída`, '#ef4444');
}

function openColMenu(colId, btn) {
  closeColMenu();
  colMenuOpen = colId;
  const col = getActiveCols().find(c => c.col_id === colId); if (!col) return;
  const rect = btn.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.id = 'col-ctx-menu';
  menu.className = 'col-ctx-menu';
  menu.style.cssText = `top:${rect.bottom + 4}px;left:${rect.left}px`;
  menu.innerHTML = `
    <button class="col-ctx-item" onclick="closeColMenu();renameColumn('${colId}')">
      <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      Renomear
    </button>
    <button class="col-ctx-item" onclick="closeColMenu();setColumnWip('${colId}')">
      <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22v-5M12 7V2M4.93 4.93l3.54 3.54M15.54 15.54l3.53 3.53M22 12h-5M7 12H2M15.54 8.46l3.53-3.53M4.93 19.07l3.54-3.54"/></svg>
      Limite WIP ${col.wip_limit ? `(${col.wip_limit})` : ''}
    </button>
    ${!col.is_done
      ? `<button class="col-ctx-item" onclick="closeColMenu();setColumnDone('${colId}')">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          Marcar como Concluída
        </button>`
      : `<div class="col-ctx-done-badge"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Coluna de conclusão</div>
         <button class="col-ctx-item" onclick="closeColMenu();archiveAllDone('${colId}')" style="margin-top: 4px; color: var(--text);">
           <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
           Arquivar concluídas
         </button>`
    }
    <div class="col-ctx-divider"></div>
    <div class="col-ctx-label">Cor</div>
    <div class="col-ctx-colors">
      ${BOARD_COLORS.map(c => `<div class="swatch${col.color === c ? ' sel' : ''}" style="background:${c}" onclick="closeColMenu();recolorColumn('${colId}','${c}')"></div>`).join('')}
    </div>
    ${!col.is_done
      ? `<div class="col-ctx-divider"></div>
         <button class="col-ctx-item col-ctx-delete" onclick="closeColMenu();deleteColumn('${colId}')">
           <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
           Excluir coluna
         </button>`
      : ''
    }`;
  document.body.appendChild(menu);
  // Fecha ao clicar fora
  setTimeout(() => document.addEventListener('click', closeColMenu, { once: true }), 0);
}

function closeColMenu() {
  document.getElementById('col-ctx-menu')?.remove();
  colMenuOpen = null;
}

// ── ARCHIVE ALL ──
async function archiveAllDone(colId) {
  const colCards = activeCards().filter(c => c.col === colId);
  if (!colCards.length) {
    toast('Nenhuma tarefa para arquivar.', '#f59e0b');
    return;
  }
  if (!(await showConfirm('Arquivar concluídas', `Arquivar ${colCards.length} tarefa(s) concluída(s)?\nElas não aparecerão mais no Kanban, mas ficarão salvas na aba de Arquivados.`))) return;

  const ts = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  
  const patches = [];
  colCards.forEach(c => {
    c.done_at = ts;
    patches.push(sbFetch(`cards?id=eq.${c.id}`, 'PATCH', { done_at: c.done_at }, true));
  });

  render();
  const results = await Promise.allSettled(patches);
  if (results.some(r => r.status === 'rejected')) {
    toast('Erro ao arquivar algumas tarefas', '#ef4444');
  } else {
    toast(`${colCards.length} tarefa(s) arquivada(s) ✓`);
  }
}

// ── BOARDS ──
let _renderTimer = null;
function render() {
  if (_renderTimer) cancelAnimationFrame(_renderTimer);
  _renderTimer = requestAnimationFrame(() => {
    _renderTimer = null;
    if (isMobile) { renderM(); } else { renderD(); }
  });
}

async function switchBoard(id) {
  activeBoardId = id;
  if (!boardColumns[id]) await loadBoardColumns(id);
  render();
}
async function renameBoard(name) {
  if (!name.trim()) return;
  const b = boards.find(x => x.id === activeBoardId); if (!b) return;
  b.name = name.trim();
  await sbFetch(`boards?id=eq.${activeBoardId}`, 'PATCH', { name: name.trim() });
  renderDSidebar();
}

function openBoardModal() {
  newBoardColor = BOARD_COLORS[0];
  document.getElementById('bm-name').value = '';
  document.getElementById('color-swatches').innerHTML = BOARD_COLORS.map(c =>
    `<div class="swatch ${c === newBoardColor ? 'sel' : ''}" style="background:${c}" data-color="${c}" onclick="selectBoardColor('${c}')"></div>`).join('');
  document.getElementById('board-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('bm-name').focus(), 60);
}
function closeBoardModal() { document.getElementById('board-modal').style.display = 'none'; }
function selectBoardColor(c) {
  newBoardColor = c;
  document.querySelectorAll('.swatch').forEach(s => s.classList.toggle('sel', s.dataset.color === c));
}
async function saveBoardModal() {
  const name = document.getElementById('bm-name').value.trim();
  if (!name) { document.getElementById('bm-name').focus(); return; }
  const id = 'board_' + Date.now();
  const res = await sbFetch('boards', 'POST', { id, name, color: newBoardColor });
  boards.push((res && res[0]) || { id, name, color: newBoardColor });
  activeBoardId = id;
  await migrateDefaultColumns(id);
  closeBoardModal(); render(); toast('Quadro criado!');
}

async function deleteBoard(id) {
  if (boards.length <= 1) { toast('Precisa ter pelo menos um quadro', '#f59e0b'); return; }
  const b = boards.find(x => x.id === id);
  const cardCount = cards.filter(c => c.board_id === id).length;
  const msg = cardCount > 0
    ? `Excluir o quadro "${b?.name}"?\n\nIsso vai apagar ${cardCount} tarefa${cardCount > 1 ? 's' : ''} e todos os lembretes deste quadro. Essa ação não pode ser desfeita.`
    : `Excluir o quadro "${b?.name}"? Essa ação não pode ser desfeita.`;
  if (!(await showConfirm('Excluir quadro', msg))) return;
  const cardIds = cards.filter(c => c.board_id === id).map(c => c.id);
  cards = cards.filter(c => c.board_id !== id);
  reminders = reminders.filter(r => r.board_id !== id);
  saveRemindersLocal();
  boards = boards.filter(x => x.id !== id);
  if (activeBoardId === id) activeBoardId = boards[0]?.id || null;
  render();
  toast('Quadro excluído', '#ef4444');
  await sbFetch(`boards?id=eq.${id}`, 'DELETE');
  if (cardIds.length) await sbFetch(`cards?id=in.(${cardIds.join(',')})`, 'DELETE');
}

// ── COLUNAS DRAG & DROP ──
function onColDragStart(e, colId) {
  if (e.target.closest('.card') || e.target.closest('.cbtn') || e.target.closest('.col-plus') || e.target.closest('.col-menu-btn')) { e.preventDefault(); return; }
  dragColId = colId;
  setTimeout(() => { const el = document.getElementById('d-col-' + colId); if (el) el.classList.add('dragging-col'); }, 0);
  e.dataTransfer.effectAllowed = 'move';
}
function onColDragEnd() {
  dragColId = null;
  document.querySelectorAll('.col').forEach(c => c.classList.remove('dragging-col', 'drag-over-col-left', 'drag-over-col-right'));
}
function onColDragOver(e, colId) {
  if (!dragColId || dragColId === colId) return;
  e.preventDefault(); e.stopPropagation();
  const el = document.getElementById('d-col-' + colId); if (!el) return;
  const isLeft = e.clientX < el.getBoundingClientRect().left + el.offsetWidth / 2;
  document.querySelectorAll('.col').forEach(c => c.classList.remove('drag-over-col-left', 'drag-over-col-right'));
  el.classList.add(isLeft ? 'drag-over-col-left' : 'drag-over-col-right');
}
async function onColDrop(e, colId) {
  if (!dragColId || dragColId === colId) return;
  e.preventDefault(); e.stopPropagation();
  const el = document.getElementById('d-col-' + colId);
  const isLeft = el ? e.clientX < el.getBoundingClientRect().left + el.offsetWidth / 2 : true;
  document.querySelectorAll('.col').forEach(c => c.classList.remove('dragging-col', 'drag-over-col-left', 'drag-over-col-right'));
  
  const cols = getActiveCols();
  const draggingIdx = cols.findIndex(c => c.col_id === dragColId);
  const targetIdx = cols.findIndex(c => c.col_id === colId);
  if (draggingIdx === -1 || targetIdx === -1) return;
  
  const dragged = cols.splice(draggingIdx, 1)[0];
  let newIdx = cols.findIndex(c => c.col_id === colId);
  if (!isLeft) newIdx++;
  
  cols.splice(newIdx, 0, dragged);
  cols.forEach((c, i) => c.position = (i + 1) * 10);
  
  boardColumns[activeBoardId] = [...cols];
  render();
  
  const patches = cols.map(c => sbFetch(`board_columns?id=eq.${c.id}`, 'PATCH', { position: c.position }));
  const results = await Promise.allSettled(patches);
  if (results.some(r => r.status === 'rejected')) {
    toast('Erro ao reordenar colunas', '#ef4444');
  }
  dragColId = null;
}

// ── DRAG & DROP ──
let dragColId = null;

function onDragStart(e, id) {
  e.stopPropagation();
  dragCardId = id;
  dropBeforeCardId = null;
  setTimeout(() => { const el = document.getElementById('card-' + id); if (el) el.classList.add('dragging'); }, 0);
  e.dataTransfer.effectAllowed = 'move';
}
function onDragEnd() {
  dragCardId = null; dropBeforeCardId = null;
  document.querySelectorAll('.card').forEach(c => c.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom'));
  document.querySelectorAll('.cards-area').forEach(a => a.classList.remove('drag-over'));
}
function onDragOverCard(e, cardId) {
  if (cardId === dragCardId) return;
  e.preventDefault(); e.stopPropagation();
  const el = document.getElementById('card-' + cardId); if (!el) return;
  const rect = el.getBoundingClientRect();
  const isTop = e.clientY < rect.top + rect.height / 2;
  document.querySelectorAll('.card').forEach(c => c.classList.remove('drag-over-top', 'drag-over-bottom'));
  el.classList.add(isTop ? 'drag-over-top' : 'drag-over-bottom');
  dropBeforeCardId = isTop ? cardId : '__after__' + cardId;
}
function onDragLeaveCard(e, cardId) {
  const el = document.getElementById('card-' + cardId);
  if (el) el.classList.remove('drag-over-top', 'drag-over-bottom');
}
function onDragOver(e, colId) {
  if (dragColId) return;
  e.preventDefault();
  if (!e.target.closest('.card')) {
    document.querySelectorAll('.card').forEach(c => c.classList.remove('drag-over-top', 'drag-over-bottom'));
    dropBeforeCardId = null;
  }
}
async function onDrop(e, colId) {
  if (dragColId) return;
  e.preventDefault();
  document.querySelectorAll('.card').forEach(c => c.classList.remove('drag-over-top', 'drag-over-bottom'));
  document.querySelectorAll('.cards-area').forEach(a => a.classList.remove('drag-over'));
  if (!dragCardId) return;

  const dragged = cards.find(x => x.id === dragCardId);
  if (!dragged) { dragCardId = null; dropBeforeCardId = null; return; }

  const prevCol = dragged.col;
  const prevDragId = dragCardId;
  const changedCol = prevCol !== colId;

  // Coluna destino sem o card arrastado
  const destCards = getSortedColCards(colId, activeBoardId).filter(c => c.id !== prevDragId);

  // Determina índice de inserção
  let insertIdx = destCards.length;
  if (dropBeforeCardId) {
    if (dropBeforeCardId.startsWith('__after__')) {
      const afterId = dropBeforeCardId.replace('__after__', '');
      const idx = destCards.findIndex(c => c.id === afterId);
      insertIdx = idx === -1 ? destCards.length : idx + 1;
    } else {
      const idx = destCards.findIndex(c => c.id === dropBeforeCardId);
      if (idx !== -1) insertIdx = idx;
    }
  }
  destCards.splice(insertIdx, 0, dragged);
  destCards.forEach((c, i) => { c.position = (i + 1) * 100; });

  // Atualiza col/history se mudou de coluna
  if (changedCol) {
    const col = getActiveCols().find(cl => cl.col_id === colId);
    dragged.col = colId;
    dragged.history = [...(dragged.history || []), { msg: `Movido para ${col?.label}`, ts: new Date().toISOString() }];
    if (isDoneCol(colId)) { dragged.done_at = new Date().toISOString(); dragged.history.push({ msg: 'Concluído', ts: dragged.done_at }); }
    // Renumera coluna de origem
    const srcCards = getSortedColCards(prevCol, activeBoardId).filter(c => c.id !== prevDragId);
    srcCards.forEach((c, i) => { c.position = (i + 1) * 100; });
  }

  dragCardId = null; dropBeforeCardId = null;
  render();
  if (changedCol && isDoneCol(colId)) {
    setTimeout(() => celebrateComplete(document.getElementById('card-' + prevDragId)), 120);
  }

  // Persiste coluna destino
  const destPatches = destCards.map(c => {
    const patch = { position: c.position };
    if (c.id === prevDragId && changedCol) {
      patch.col = colId; patch.history = c.history;
      if (isDoneCol(colId)) patch.done_at = c.done_at;
    }
    return sbFetch(`cards?id=eq.${c.id}`, 'PATCH', patch, true);
  });

  // Persiste coluna origem se mudou
  const srcPatches = changedCol
    ? getSortedColCards(prevCol, activeBoardId).map(c =>
        sbFetch(`cards?id=eq.${c.id}`, 'PATCH', { position: c.position }, true))
    : [];

  const results = await Promise.allSettled([...destPatches, ...srcPatches]);
  const anyFailed = results.some(r => r.status === 'rejected');
  if (anyFailed) {
    setSyncing(false, true);
    toast('Erro de sincronização', '#ef4444');
  }
}

// ── MOVE CARD (mobile) ──
async function moveCardTo(cardId, colId) {
  const c = cards.find(x => x.id === cardId); if (!c) return;
  const col = getActiveCols().find(cl => cl.col_id === colId);
  const destCards = getSortedColCards(colId, activeBoardId).filter(x => x.id !== cardId);
  c.col = colId;
  c.position = (destCards.length + 1) * 100;
  c.history = [...(c.history || []), { msg: `Movido para ${col?.label}`, ts: new Date().toISOString() }];
  if (isDoneCol(colId)) { c.done_at = new Date().toISOString(); c.history.push({ msg: 'Concluído', ts: c.done_at }); }
  render();
  if (isDoneCol(colId)) {
    setTimeout(() => celebrateComplete(document.getElementById('card-' + cardId)), 120);
  }
  const patch = { col: colId, history: c.history, position: c.position };
  if (isDoneCol(colId)) patch.done_at = c.done_at;
  await sbFetch(`cards?id=eq.${cardId}`, 'PATCH', patch);
}

// ── CHECKLIST TOGGLE ──
async function toggleCheck(cardId, i) {
  const c = cards.find(x => x.id === cardId); if (!c) return;
  c.checklist[i].done = !c.checklist[i].done;
  render();
  await sbFetch(`cards?id=eq.${cardId}`, 'PATCH', { checklist: c.checklist });
}

// ── UNARCHIVE ──
async function unarchiveCard(id) {
  const c = cards.find(x => x.id === id); if (!c) return;
  // Restaura para a coluna "done" com done_at de 1 dia atrás (não arquiva imediatamente)
  const ts = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
  c.col = 'done';
  c.done_at = ts;
  c.history = [...(c.history || []).filter(h => h.msg !== 'Concluído'), { msg: 'Concluído', ts }];
  render();
  await sbFetch(`cards?id=eq.${id}`, 'PATCH', { col: c.col, history: c.history, done_at: c.done_at });
  toast('Tarefa restaurada ao Kanban ✓');
}

// ── EXPORT Excel ──
function exportXLSX() {
  // Constrói mapa de labels por board (cada board pode ter colunas diferentes)
  const colLabelFor = bid => Object.fromEntries((boardColumns[bid] || COLS.map(c => ({ col_id: c.id, label: c.label }))).map(c => [c.col_id, c.label]));
  const priLabel = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
  const colWidths = [{ wch: 36 }, { wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 10 }, { wch: 24 }, { wch: 40 }];
  const wb = XLSX.utils.book_new();

  boards.forEach(b => {
    const colLabel = colLabelFor(b.id);
    const boardCards = cards.filter(c => c.board_id === b.id && !isArchivedCard(c));
    const rows = boardCards.map(c => ({
      'Título': c.title,
      'Coluna': colLabel[c.col] || c.col,
      'Prioridade': priLabel[c.priority] || c.priority,
      'Responsáveis': (c.assignees || (c.assignee ? [c.assignee] : [])).join(', '),
      'Prazo': c.due || '',
      'Esforço': c.effort || '',
      'Criado em': getCreatedAt(c) || '',
      'Tags': (c.tags || []).join(', '),
      'Notas': c.notes || ''
    }));
    if (!rows.length) rows.push({ 'Título': '(sem tarefas)', 'Coluna': '', 'Prioridade': '', 'Criado em': '', 'Tags': '', 'Notas': '' });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = colWidths;
    const sheetName = b.name.replace(/[:\\/?*[\]]/g, '-').slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName || `Quadro`);
  });

  XLSX.writeFile(wb, 'flowboard_' + new Date().toISOString().slice(0, 10) + '.xlsx');
  toast(`Excel exportado! (${boards.length} ${boards.length === 1 ? 'quadro' : 'quadros'})`);
}

// ── ENTRADA RÁPIDA ──
async function openQuickAdd() {
  if (!activeBoardId) return;
  const title = await showPrompt('Entrada rápida', 'Digite o título da tarefa:');
  if (!title || !title.trim()) return;
  await quickAddCard(title.trim());
}

async function quickAddCard(title) {
  const destSorted = getSortedColCards('backlog', activeBoardId);
  const maxPos = destSorted.reduce((max, c) => Math.max(max, c.position || 0), 0);
  const now = new Date().toISOString();
  const payload = {
    board_id: activeBoardId,
    title,
    col: 'backlog',
    priority: 'media',
    assignees: [],
    due: null,
    effort: '',
    tags: [],
    checklist: [],
    notes: '',
    position: maxPos + 100,
    history: [{ msg: 'Criado', ts: now }],
  };
  const res = await sbFetch('cards', 'POST', payload);
  if (res && res[0]) cards.push(res[0]);
  else cards.push({ ...payload, id: 'card_' + Date.now(), created_at: now });
  render();
  toast('Tarefa criada via entrada rápida');
}

// ── BACKUP / RESTORE JSON ──
function exportBackupJSON() {
  const backup = {
    version: 1,
    exported_at: new Date().toISOString(),
    app: 'FlowBoard',
    data: {
      boards,
      cards,
      reminders,
      boardColumns,
      meta: {
        activeBoardId,
        dView,
        mView,
      }
    }
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'flowboard_backup_' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('Backup JSON exportado');
}

function triggerImportBackup() {
  const input = document.getElementById('backup-import-input');
  if (!input) return;
  input.value = '';
  input.click();
}

async function importBackupJSON(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const payload = parsed?.data || parsed;
    validateBackup(payload);
    const ok = await showConfirm('Restaurar backup', 'Restaurar backup agora?\nOs dados atuais de quadros e tarefas serão substituídos.');
    if (!ok) return;
    await restoreBackup(payload);
    toast('Backup restaurado com sucesso');
  } catch (e) {
    console.error(e);
    toast('Falha ao restaurar backup JSON', '#ef4444');
  } finally {
    if (event?.target) event.target.value = '';
  }
}

function validateBackup(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Backup inválido: objeto ausente');
  if (!Array.isArray(payload.boards)) throw new Error('Backup inválido: boards ausente');
  if (!Array.isArray(payload.cards)) throw new Error('Backup inválido: cards ausente');
  if (!Array.isArray(payload.reminders)) throw new Error('Backup inválido: reminders ausente');
  if (!payload.boards.length) throw new Error('Backup inválido: sem quadros');
}

async function restoreBackup(payload) {
  const safeBoards = payload.boards.map(b => ({
    id: String(b.id || ('board_' + Date.now())),
    name: String(b.name || 'Quadro'),
    color: b.color || BOARD_COLORS[0],
  }));
  const safeBoardIds = new Set(safeBoards.map(b => b.id));
  const safeCards = payload.cards
    .filter(c => safeBoardIds.has(c.board_id))
    .map(c => ({
      id: String(c.id || ('card_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6))),
      board_id: String(c.board_id),
      title: String(c.title || 'Sem título'),
      col: c.col || 'backlog',
      priority: PRI[c.priority] ? c.priority : 'media',
      assignees: (c.assignees || (c.assignee ? [c.assignee] : [])).filter(Boolean),
      due: c.due || null,
      effort: c.effort || '',
      tags: Array.isArray(c.tags) ? c.tags : [],
      checklist: Array.isArray(c.checklist) ? c.checklist : [],
      notes: c.notes || '',
      history: Array.isArray(c.history) ? c.history : [{ msg: 'Criado', ts: new Date().toISOString() }],
      done_at: c.done_at || null,
      position: Number.isFinite(c.position) ? c.position : null,
      created_at: c.created_at || new Date().toISOString(),
    }));
  const safeReminders = payload.reminders
    .filter(r => safeBoardIds.has(r.board_id))
    .map(r => ({
      id: String(r.id || ('rem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6))),
      board_id: String(r.board_id),
      text: String(r.text || ''),
      when: r.when || '',
      advanceMin: Number.isFinite(r.advanceMin) ? r.advanceMin : 60,
      recur: r.recur || '',
      done: !!r.done,
      created: r.created || new Date().toISOString(),
    }));

  // Substitui dados no backend para manter o restore idêntico ao backup.
  await sbFetch('cards?id=not.is.null', 'DELETE');
  await sbFetch('boards?id=not.is.null', 'DELETE');
  await sbFetch('boards', 'POST', safeBoards);
  if (safeCards.length) await sbFetch('cards', 'POST', safeCards);

  boards = safeBoards;
  cards = safeCards;
  reminders = safeReminders;
  saveRemindersLocal();
  firedSet = new Set();
  dueSoonFired = new Set();
  saveFired();
  saveDueSoonFired();

  const wantedActive = payload?.meta?.activeBoardId;
  activeBoardId = safeBoards.find(b => b.id === wantedActive)?.id || safeBoards[0].id;
  if (payload?.meta?.dView) dView = payload.meta.dView;
  if (payload?.meta?.mView) mView = payload.meta.mView;
  // Restaura boardColumns se presentes no backup
  if (payload.boardColumns && typeof payload.boardColumns === 'object') {
    // Limpa board_columns existentes e recria
    try { await sbFetch('board_columns?id=not.is.null', 'DELETE'); } catch(e) {}
    const allCols = [];
    Object.entries(payload.boardColumns).forEach(([bid, cols]) => {
      if (Array.isArray(cols) && safeBoardIds.has(bid)) {
        boardColumns[bid] = cols;
        allCols.push(...cols);
      }
    });
    if (allCols.length) {
      try { await sbFetch('board_columns', 'POST', allCols); } catch(e) {}
    }
  } else {
    // Sem boardColumns no backup — migrar padrões
    await Promise.all(safeBoards.map(b => migrateDefaultColumns(b.id)));
  }

  initPositions();
  render();
  scheduleReminderCheck();
}
