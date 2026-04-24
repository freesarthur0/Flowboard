// ══════════════════════════
// RENDER — MOBILE
// ══════════════════════════
function renderM() {
  const ab = boards.find(b => b.id === activeBoardId);
  document.getElementById('m-board-title').textContent = ab?.name || 'FlowBoard';
  renderMDrawer();
  if (mView === 'kanban') renderMKanban();
  else if (mView === 'notes') renderNotes();
  else if (mView === 'stats') renderMStats();
  else if (mView === 'today') renderMToday();
}

function renderMDrawer() {
  document.getElementById('m-boards-list').innerHTML = boards.map(b => {
    const cnt = cards.filter(c => c.board_id === b.id).length;
    const canDel = boards.length > 1;
    return `<div class="m-board-item ${b.id === activeBoardId ? 'active' : ''}" onclick="switchBoard('${b.id}');closeDrawer()">
      <span class="board-dot" style="background:${b.color}"></span>
      <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(b.name)}</span>
      <span class="board-count">${cnt}</span>
      ${canDel ? `<button class="board-del" onclick="event.stopPropagation();deleteBoard('${b.id}')" title="Excluir quadro">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>` : ''}
    </div>`;
  }).join('');
}

function setMView(v) {
  mView = v;
  ['kanban', 'notes', 'stats', 'reminders', 'today'].forEach(vv => {
    const btn = document.getElementById(`m-btn-${vv}`);
    if (btn) btn.classList.toggle('active', vv === v);
  });
  document.getElementById('m-col-tabs-wrap').style.display = v === 'kanban' ? 'block' : 'none';
  const sb = document.getElementById('m-search-bar'); if (sb) sb.style.display = 'none';
  ['m-kanban-view', 'm-notes-view', 'm-stats-view', 'm-reminders-view', 'm-today-view'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  if (v === 'kanban') { document.getElementById('m-kanban-view').style.display = 'flex'; renderM(); }
  else if (v === 'notes') { document.getElementById('m-notes-view').style.display = 'flex'; renderM(); }
  else if (v === 'stats') { document.getElementById('m-stats-view').style.display = 'block'; renderM(); }
  else if (v === 'reminders') { document.getElementById('m-reminders-view').style.display = 'flex'; renderReminders('m'); }
  else if (v === 'today') { document.getElementById('m-today-view').style.display = 'block'; renderM(); }
  // View entrance animation
  const viewMap = { kanban:'m-kanban-view', notes:'m-notes-view', stats:'m-stats-view', reminders:'m-reminders-view', today:'m-today-view' };
  const enterEl = document.getElementById(viewMap[v]);
  if (enterEl) { enterEl.classList.remove('view-entering'); void enterEl.offsetWidth; enterEl.classList.add('view-entering'); }
}

function renderMKanban() {
  const ac = activeCards();
  const activeCols = getActiveCols();
  updateDOM('m-col-tabs', activeCols.map((col, i) => {
    const cnt = ac.filter(c => c.col === col.col_id).length;
    const overWip = col.wip_limit && cnt > col.wip_limit;
    return `<div class="m-col-tab ${i === mActiveCol ? 'active' : ''}" style="--col-color:${overWip ? '#ef4444' : col.color}" onclick="goToMCol(${i})">
      ${col.label}<span class="m-col-tab-count" ${overWip?`style="color:#ef4444;background:#ef444422"`:``}>${cnt}${col.wip_limit ? `/${col.wip_limit}` : ''}</span></div>`;
  }).join(''));
  const board = document.getElementById('m-board');
  updateDOM('m-board', activeCols.map((col) => {
    const colCards = ac.filter(c => c.col === col.col_id);
    return `<div class="m-col" id="m-col-${col.col_id}">
      <div class="m-cards">
        ${colCards.length === 0 ? `<div class="m-empty">
          <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.3" viewBox="0 0 24 24" style="opacity:0.25"><rect x="5" y="3" width="14" height="18" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="14" y2="11"/><line x1="9" y1="15" x2="12" y2="15"/></svg>
          <div class="m-empty-text">Coluna vazia</div>
          <button onclick="openModal('${col.col_id}')" style="font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;font-weight:700;padding:10px 20px;border-radius:10px;background:var(--bg3);border:1px solid var(--border2);color:var(--text2);cursor:pointer;">+ Adicionar</button>
        </div>` : ''}
        ${colCards.map((c, i) => mCardHTML(c, i)).join('')}
      </div>
    </div>`;
  }).join(''));
  setTimeout(() => {
    const bw = board.offsetWidth;
    board.scrollLeft = mActiveCol * bw;
  }, 30);
}

function mCardHTML(c, staggerIdx = 0) {
  const p = PRI[c.priority] || PRI.media;
  const checks = c.checklist || []; const done = checks.filter(x => x.done).length;
  const pct = checks.length ? Math.round(done / checks.length * 100) : 0;
  const over = !isDoneCol(c.col) && isOverdue(c.due);
  const stagger = Math.min(staggerIdx * 30, 200);
  return `<div class="m-card" style="--pri-color:${p.color};--stagger:${stagger}ms">
    <div class="m-card-actions">
      <button class="m-cbtn" onclick="editCard('${c.id}')">✏</button>
      <button class="m-cbtn del" onclick="deleteCard('${c.id}')">✕</button>
    </div>
    <div class="m-card-title">${esc(c.title)}</div>
    ${checks.length ? `<div class="m-checklist">
      <div class="m-cl-bar-wrap"><div class="m-cl-bar-bg"><div class="m-cl-bar-fill" style="width:${pct}%"></div></div><span class="m-cl-pct">${done}/${checks.length}</span></div>
      <div class="m-cl-items">${checks.map((x, i) => `<div class="m-cl-item${x.done ? ' done' : ''}" onclick="toggleCheck('${c.id}',${i})">
        <input type="checkbox" ${x.done ? 'checked' : ''} onclick="event.stopPropagation();toggleCheck('${c.id}',${i})"><label>${esc(x.text)}</label></div>`).join('')}</div>
    </div>` : ''}
    ${c.notes ? `<div class="m-card-notes">${renderMarkdown(c.notes)}</div>` : ''}
    <div class="m-card-footer">
      <span class="pri-tag ${p.cls}">${p.label}</span>
      ${(c.tags || []).slice(0, 3).map(t => {
        const ctg = getTagColor(t);
        return `<span class="m-tag" style="background:${ctg}26;color:${ctg};">${esc(t)}</span>`;
      }).join('')}
      <div class="m-card-right">
        ${c.due ? `<span class="m-due${over ? ' over' : ''}">${fmtDate(c.due)}<span class="due-rel">${relDue(c.due)}</span></span>` : ''}
      </div>
    </div>
  </div>`;
}

function goToMCol(i) {
  mActiveCol = i;
  const board = document.getElementById('m-board');
  board.scrollTo({ left: i * board.offsetWidth, behavior: 'smooth' });
  renderMKanban();
}

function onMBoardScroll() {
  const board = document.getElementById('m-board');
  const i = Math.round(board.scrollLeft / board.offsetWidth);
  if (i !== mActiveCol) { mActiveCol = i; renderMColTabs(); }
}

function renderMColTabs() {
  const ac = activeCards();
  updateDOM('m-col-tabs', getActiveCols().map((col, i) => {
    const cnt = ac.filter(c => c.col === col.col_id).length;
    const overWip = col.wip_limit && cnt > col.wip_limit;
    return `<div class="m-col-tab ${i === mActiveCol ? 'active' : ''}" style="--col-color:${overWip ? '#ef4444' : col.color}" onclick="goToMCol(${i})">
      ${col.label}<span class="m-col-tab-count" ${overWip?`style="color:#ef4444;background:#ef444422"`:``}>${cnt}${col.wip_limit ? `/${col.wip_limit}` : ''}</span></div>`;
  }).join(''));
}

function renderMList() {
  const q = document.getElementById('m-search')?.value.toLowerCase().trim() || '';
  let list = activeCards();
  if (q) list = list.filter(c => c.title.toLowerCase().includes(q) || (c.notes || '').toLowerCase().includes(q) || (c.tags || []).some(t => t.toLowerCase().includes(q)));
  updateDOM('m-list-cards', list.map(c => {
    const p = PRI[c.priority] || PRI.media;
    const activeCols = getActiveCols();
    const col = activeCols.find(cl => cl.col_id === c.col) || activeCols[0];
    return `<div class="m-card" style="--pri-color:${p.color}">
      <div class="m-card-actions">
        <button class="m-cbtn" onclick="editCard('${c.id}')">✏</button>
        <button class="m-cbtn del" onclick="deleteCard('${c.id}')">✕</button>
      </div>
      <div class="m-card-title" style="padding-right:60px">${esc(c.title)}</div>
      <div class="m-card-footer">
        <span class="pri-tag ${p.cls}">${p.label}</span>
        <span class="m-tag" style="border-color:${col?.color || 'var(--border2)'}33;color:${col?.color || 'var(--text2)'}">${col?.label || c.col}</span>
        <div class="m-card-right">
          ${c.due ? `<span class="m-due${(!isDoneCol(c.col) && isOverdue(c.due)) ? ' over' : ''}">${fmtDate(c.due)}</span>` : ''}
          ${(c.assignees || (c.assignee ? [c.assignee] : [])).map(a => `<span class="meta-tag assignee"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ${esc(a)}</span>`).join('')}
        </div>
      </div>
      <div style="margin-top:10px">
        <select style="width:100%;background:var(--bg3);border:1px solid var(--border2);border-radius:10px;color:var(--text);font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;padding:12px 14px;outline:none;" onchange="moveCardTo('${c.id}',this.value)">
          ${activeCols.map(cl => `<option value="${cl.col_id}"${cl.col_id === c.col ? ' selected' : ''}>${cl.label}</option>`).join('')}
        </select>
      </div>
    </div>`;
  }).join(''));
}

function renderMStats() {
  const ac = activeCards(); const allBc = allBoardCards(); const total = ac.length;
  const done = allBc.filter(c => isDoneCol(c.col)).length;
  const allTotal = allBc.length;
  const overdue = ac.filter(c => isOverdue(c.due) && !isDoneCol(c.col)).length;
  const firstCol = getActiveCols()[0]?.col_id;
  const inProg = ac.filter(c => c.col !== firstCol && !isDoneCol(c.col)).length;
  updateDOM('m-stats-grid', [
    { label: 'Total', value: total, sub: 'tarefas' },
    { label: 'Concluídas', value: done, sub: `${allTotal ? Math.round(done / allTotal * 100) : 0}%` },
    { label: 'Em progresso', value: inProg, sub: 'ativas' },
    { label: 'Vencidas', value: overdue, sub: 'urgentes' },
  ].map(s => `<div class="m-stat-card"><div class="m-stat-label">${s.label}</div><div class="m-stat-value">${s.value}</div><div class="m-stat-sub">${s.sub}</div></div>`).join(''));
  renderWeeklyChart('m-weekly-bars', ac); renderPriDist('m-pri-dist', ac);
}

function renderMToday() {
  const root = document.getElementById('m-today-content');
  if (!root) return;
  const { overdue, today, next48 } = getMyDayBuckets(activeCards());
  const total = overdue.length + today.length + next48.length;
  if (!total) {
    updateDOM('m-today-content', `<div class="today-empty">
      <div class="today-empty-icon">✅</div>
      <div>Nada urgente por agora.</div>
      <div class="today-empty-sub">Sem tarefas vencidas, de hoje ou próximas 48h.</div>
    </div>`);
    return;
  }
  updateDOM('m-today-content', `${mTodaySectionHTML('Vencidas', overdue, 'overdue')}
  ${mTodaySectionHTML('Hoje', today, 'today')}
  ${mTodaySectionHTML('Próximas 48h', next48, 'next48')}`);
}

function mTodaySectionHTML(title, list, kind) {
  if (!list.length) return '';
  return `<div class="today-section">
    <div class="today-section-head">
      <span class="today-section-title">${title}</span>
      <span class="today-section-count">${list.length}</span>
    </div>
    <div class="today-list">
      ${list.map(c => mTodayItemHTML(c, kind)).join('')}
    </div>
  </div>`;
}

function mTodayItemHTML(c, kind) {
  const p = PRI[c.priority] || PRI.media;
  const col = getActiveCols().find(cl => cl.col_id === c.col);
  const dueClass = kind === 'overdue' ? 'over' : '';
  return `<div class="today-item" onclick="editCard('${c.id}')">
    <div class="today-item-top">
      <div class="today-item-title">${esc(c.title)}</div>
      <span class="pri-tag ${p.cls}">${p.label}</span>
    </div>
    <div class="today-item-meta">
      <span class="today-pill">${col?.label || c.col}</span>
      <span class="today-pill due ${dueClass}">${fmtDate(c.due)} · ${relDue(c.due)}</span>
    </div>
  </div>`;
}

// ── DRAWER ──
function openDrawer() {
  document.getElementById('m-drawer').classList.add('open');
  document.getElementById('m-drawer-bg').classList.add('open');
  document.getElementById('m-menu-btn')?.setAttribute('aria-expanded', 'true');
}
function closeDrawer() {
  document.getElementById('m-drawer').classList.remove('open');
  document.getElementById('m-drawer-bg').classList.remove('open');
  document.getElementById('m-menu-btn')?.setAttribute('aria-expanded', 'false');
}
