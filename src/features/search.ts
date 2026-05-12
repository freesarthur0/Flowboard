// ════════════════════════
// BUSCA GLOBAL
// ════════════════════════
function onGSearch(q) {
  const dd = document.getElementById('gsearch-dropdown');
  q = q.trim();
  if (!q) { dd.classList.remove('open'); if (dView === 'kanban') renderDKanban(); return; }
  dd.classList.add('open');
  const results = cards.filter(c => {
    const s = q.toLowerCase();
    const assigs = (c.assignees || (c.assignee ? [c.assignee] : []));
    return c.title.toLowerCase().includes(s) || (c.notes || '').toLowerCase().includes(s) || assigs.some(a => a.toLowerCase().includes(s)) || (c.tags || []).some(t => t.toLowerCase().includes(s));
  }).slice(0, 20);
  if (!results.length) { dd.innerHTML = `<div class="gsearch-empty">Nenhum resultado para "${esc(q)}"</div>`; return; }
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const highlight = t => esc(t).replace(new RegExp(`(${escRe(esc(q))})`, 'gi'), '<mark>$1</mark>');
  const grouped = {};
  results.forEach(c => { if (!grouped[c.board_id]) grouped[c.board_id] = []; grouped[c.board_id].push(c); });
  dd.innerHTML = Object.entries(grouped).map(([bid, bCards]) => {
    const board = boards.find(b => b.id === bid);
    const colLabel = Object.fromEntries((boardColumns[bid] || COLS.map(c => ({ col_id: c.id, label: c.label }))).map(c => [c.col_id, c.label]));
    const items = bCards.map(c => {
      const p = PRI[c.priority] || PRI.media;
      return `<div class="gsearch-item" onclick="gSearchGo('${c.id}','${bid}')">
        <span class="gsearch-item-dot" style="background:${p.color}"></span>
        <div class="gsearch-item-body">
          <div class="gsearch-item-title">${highlight(c.title)}</div>
          <div class="gsearch-item-meta">${colLabel[c.col] || c.col}${c.due ? ' · ' + fmtDate(c.due) : ''}${(() => {
            const assigs = (c.assignees || (c.assignee ? [c.assignee] : []));
            return assigs.length ? ' · ' + esc(assigs.join(', ')) : '';
          })()}</div>
        </div>
        <span class="gsearch-item-board" style="background:${board?.color || 'var(--bg4)'}22;color:${board?.color || 'var(--text3)'}">${esc(board?.name || bid)}</span>
      </div>`;
    }).join('');
    return `<div class="gsearch-section">${esc(board?.name || bid)}</div>${items}`;
  }).join('');
}

function gSearchGo(cardId, boardId) {
  closeGSearch();
  if (boardId !== activeBoardId) { activeBoardId = boardId; render(); }
  setTimeout(() => {
    const el = document.getElementById('card-' + cardId);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.style.outline = '2px solid var(--accent)'; setTimeout(() => el.style.outline = '', 1200); }
    else { editCard(cardId); }
  }, 120);
}

function closeGSearch() {
  document.getElementById('gsearch-dropdown')?.classList.remove('open');
  document.getElementById('d-search').value = '';
}
