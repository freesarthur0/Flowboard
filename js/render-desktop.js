// ══════════════════════════
// RENDER — DESKTOP
// ══════════════════════════
function applyDFilters(list) {
  const q = document.getElementById('d-search')?.value.toLowerCase().trim() || '';
  return list.filter(c => {
    const assigs = c.assignees || (c.assignee ? [c.assignee] : []);
    if (q && !c.title.toLowerCase().includes(q) && !(c.notes || '').toLowerCase().includes(q) && !assigs.some(a => a.toLowerCase().includes(q)) && !(c.tags || []).some(t => t.toLowerCase().includes(q))) return false;
    if (dFilter.prioridades && dFilter.prioridades.length && !dFilter.prioridades.includes(c.priority)) return false;
    if (dFilter.efforts && dFilter.efforts.length && !dFilter.efforts.includes(c.effort || '')) return false;
    if (dFilter.assignees && dFilter.assignees.length && !dFilter.assignees.some(a => assigs.includes(a))) return false;
    if (dFilter.overdue && !isOverdue(c.due)) return false;
    if (dFilter.today && !isToday(c.due)) return false;
    if (dFilter.tags && dFilter.tags.length && !dFilter.tags.every(t => (c.tags || []).includes(t))) return false;
    return true;
  });
}

function renderD() {
  updateFilterUI();
  const ab = boards.find(b => b.id === activeBoardId);
  document.getElementById('d-board-title').value = ab?.name || '';
  renderDSidebar(); renderDStatsStrip(); renderReminders('d'); renderCal();
  if (dView === 'kanban') renderDKanban();
  else if (dView === 'list') renderArchive();
  else if (dView === 'stats') renderDStats();
  else if (dView === 'timeline') renderTimeline();
  else if (dView === 'today') renderDToday();
}

function renderDSidebar() {
  updateDOM('d-boards-list', boards.map(b => {
    const cnt = cards.filter(c => c.board_id === b.id).length;
    const canDel = boards.length > 1;
    return `<div class="board-item-d ${b.id === activeBoardId ? 'active' : ''}"
      onclick="switchBoard('${b.id}')"
      ondragover="event.preventDefault();this.classList.add('board-drag-over')"
      ondragleave="this.classList.remove('board-drag-over')"
      ondrop="event.preventDefault();this.classList.remove('board-drag-over');if(dragCardId)moveCardToBoard(dragCardId,'${b.id}')">
      <span class="board-icon-d" style="color:${b.color}"><svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg></span>
      <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(b.name)}</span>
      <span class="board-count">${cnt}</span>
      ${canDel ? `<button class="board-del" onclick="event.stopPropagation();deleteBoard('${b.id}')" title="Excluir quadro">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>` : ''}
    </div>`;
  }).join(''));
}

function renderDStatsStrip() {
  const ac = activeCards();
  document.getElementById('d-stats-strip').innerHTML = getActiveCols().map(col => {
    const cc = ac.filter(c => c.col === col.col_id);
    const ov = cc.filter(c => !col.is_done && isOverdue(c.due)).length;
    return `<div class="stat-item"><span class="stat-dot2" style="background:${col.color}"></span>
      <div class="stat-info"><div class="stat-col-name">${col.label}</div><div class="stat-col-count">${cc.length}</div></div>
      ${ov ? `<span class="stat-overdue">⚠ ${ov}</span>` : ''}</div>`;
  }).join('');
}

function setDView(v) {
  dView = v;
  const kanban = document.getElementById('d-kanban-view');
  if (kanban) kanban.style.display = v === 'kanban' ? 'block' : 'none';
  const listEl = document.getElementById('d-list-view');
  if (listEl) listEl.classList.toggle('active', v === 'list');
  const statsEl = document.getElementById('d-stats-view');
  if (statsEl) statsEl.classList.toggle('active', v === 'stats');
  const tlEl = document.getElementById('d-timeline-view');
  if (tlEl) tlEl.classList.toggle('active', v === 'timeline');
  const todayEl = document.getElementById('d-today-view');
  if (todayEl) todayEl.classList.toggle('active', v === 'today');
  ['kanban', 'list', 'stats', 'timeline', 'today'].forEach(vv => {
    const tab = document.getElementById(`d-tab-${vv}`);
    if (tab) tab.classList.toggle('active', vv === v);
  });
  // View entrance animation
  const enterEl = document.getElementById('d-' + v + '-view');
  if (enterEl) { enterEl.classList.remove('view-entering'); void enterEl.offsetWidth; enterEl.classList.add('view-entering'); }
  renderD();
}

let currentStatsTab = 'stats';
function setStatsTab(t) {
  currentStatsTab = t;
  ['stats', 'archive'].forEach(tt => {
    document.getElementById(`stab-${tt}`)?.classList.toggle('active', tt === t);
    document.getElementById(`spanel-${tt}`)?.classList.toggle('active', tt === t);
  });
  if (t === 'archive') renderArchive();
}

function renderDKanban() {
  const filtered = applyDFilters(activeCards());
  
  const colsHtml = getActiveCols().map(col => {
    const colCards = getSortedColCards(col.col_id, activeBoardId).filter(c => filtered.some(f => f.id === c.id));
    const total = getSortedColCards(col.col_id, activeBoardId).length;
    const overWip = col.wip_limit && total > col.wip_limit;
    const isCollapsed = collapsedCols[col.col_id];
    const sortMode = colSortMode[col.col_id] || 'manual';
    
    const sortDropdown = `<div class="col-sort-wrap">
      <button class="ch-btn col-sort-btn" onclick="event.stopPropagation();this.nextElementSibling.classList.toggle('open')" title="Ordenar">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="14" y2="12"/><line x1="4" y1="18" x2="8" y2="18"/></svg>
      </button>
      <div class="col-sort-menu">
        <button class="${sortMode==='manual'?'active':''}" onclick="setColSort('${col.col_id}','manual')">Manual</button>
        <button class="${sortMode==='priority'?'active':''}" onclick="setColSort('${col.col_id}','priority')">Prioridade</button>
        <button class="${sortMode==='date'?'active':''}" onclick="setColSort('${col.col_id}','date')">Data</button>
        <button class="${sortMode==='name'?'active':''}" onclick="setColSort('${col.col_id}','name')">Nome</button>
      </div>
    </div>`;

    return `<div class="col${overWip ? ' wip-exceeded' : ''}${isCollapsed ? ' col-collapsed' : ''}" 
      id="d-col-${col.col_id}" 
      ondragover="onColDragOver(event, '${col.col_id}')" 
      ondrop="onColDrop(event, '${col.col_id}')">
      <div class="col-head" draggable="true" ondragstart="onColDragStart(event, '${col.col_id}')" ondragend="onColDragEnd()" style="--col-color:${col.color}${overWip ? ';background:#ef444422;border:1px solid #ef4444' : ''}; cursor: grab;">
        <button class="ch-btn col-collapse-btn" onclick="event.stopPropagation();toggleColCollapse('${col.col_id}')" title="${isCollapsed ? 'Expandir' : 'Colapsar'}">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="${isCollapsed ? '9 6 15 12 9 18' : '6 9 12 15 18 9'}"/></svg>
        </button>
        <span class="col-name" style="color:${overWip ? '#ef4444' : col.color}">${col.label}</span>
        ${sortDropdown}
        ${col.is_done ? `<button class="ch-btn cbtn" onclick="archiveAllDone('${col.col_id}')" title="Arquivar tarefas concluídas"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg></button>` : ''}
        <button class="ch-btn col-plus" onclick="openModal('${col.col_id}')" title="Nova tarefa">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <button class="ch-btn col-menu-btn" onclick="event.stopPropagation();openColMenu('${col.col_id}',this)" title="Opções da coluna">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </button>
      </div>
      ${isCollapsed ? '' : `<div class="cards-area" id="col-${col.col_id}"
        ondragover="onDragOver(event,'${col.col_id}')"
        ondrop="onDrop(event,'${col.col_id}')"
        ondragenter="this.classList.add('drag-over')"
        ondragleave="this.classList.remove('drag-over')">
        ${colCards.length === 0 ? `<div class="empty-col-rich" onclick="openModal('${col.col_id}')">
          <svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="14" y2="11"/><line x1="9" y1="15" x2="12" y2="15"/></svg>
          <div class="empty-text">Nenhuma tarefa</div>
          <div class="empty-cta">+ Adicionar</div>
        </div>` : ''}
        ${colCards.map((c, i) => dCardHTML(c, i)).join('')}
      </div>`}
    </div>`;
  }).join('');

  const addWrapHtml = `<div class="col add-col-wrap">
    <button class="add-col-btn" onclick="addColumn()">
      <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Nova coluna
    </button>
  </div>`;

  updateDOM('d-board', colsHtml + addWrapHtml);
}

function dCardHTML(c, staggerIdx = 0) {
  const p = PRI[c.priority] || PRI.media;
  const checks = c.checklist || []; const done = checks.filter(x => x.done).length;
  const pct = checks.length ? Math.round(done / checks.length * 100) : 0;
  const over = !isDoneCol(c.col) && isOverdue(c.due);
  const depStatus = depStatusFor(c);
  const stagger = Math.min(staggerIdx * 30, 200);
  return `<div class="card${c.col === 'done' ? ' done-card' : ''}" id="card-${c.id}" draggable="true"
    style="--pri-color:${p.color};--stagger:${stagger}ms"
    ondragstart="onDragStart(event,'${c.id}')" ondragend="onDragEnd()"
    ondragover="onDragOverCard(event,'${c.id}')" ondragleave="onDragLeaveCard(event,'${c.id}')">
    <div class="card-top">
      <div class="card-title">${esc(c.title)}${depStatus ? `<span class="card-dep-badge ${depStatus}" style="margin-left:6px;font-size:10px">${depStatus === 'blocked' ? '🔒 Bloqueada' : '✓ Pronta'}</span>` : ''}</div>
      <div class="card-actions">
        <button class="cbtn" onclick="editCard('${c.id}')">✏</button>
        <button class="cbtn del" onclick="deleteCard('${c.id}')">✕</button>
      </div>
    </div>
    ${checks.length ? `<div class="checklist">
      <div class="checklist-bar-wrap"><div class="checklist-bar-bg"><div class="checklist-bar-fill" style="width:${pct}%"></div></div><span class="checklist-pct">${done}/${checks.length}</span></div>
      <div class="checklist-items">${checks.map((x, i) => `<div class="check-item${x.done ? ' done' : ''}" onclick="toggleCheck('${c.id}',${i})">
        <input type="checkbox" ${x.done ? 'checked' : ''} onclick="event.stopPropagation();toggleCheck('${c.id}',${i})"><label>${esc(x.text)}</label></div>`).join('')}</div></div>` : ''}
    ${c.notes ? `<div class="card-notes">${renderMarkdown(c.notes)}</div>` : ''}
    <div class="card-footer">
      <div class="card-footer-top">
        <span class="pri-tag ${p.cls}">${p.label}</span>
        ${(c.tags || []).slice(0, 3).map(t => {
          const ctg = getTagColor(t);
          return `<button class="tag-pill-sm" style="background:${ctg}26;color:${ctg};" onclick="toggleDFilterTag('${esc(t)}');event.stopPropagation()">${esc(t)}</button>`;
        }).join('')}
      </div>
      <div class="card-footer-bottom">
        <div class="card-dates">
          ${(() => { const ca = getCreatedAt(c); return ca ? `<span class="due" title="Criado em">${fmtDate(new Date(ca).toISOString().slice(0, 10))}</span>` : ''; })()}
          ${c.due ? `<span class="due${over ? ' over' : ''}" title="Prazo">→ ${fmtDate(c.due)}<span class="due-rel">${relDue(c.due)}</span></span>` : ''}
        </div>
        <div class="card-meta">
          ${c.effort ? `<span class="meta-tag effort" onclick="toggleDFilterEffort('${c.effort}');event.stopPropagation()">${c.effort}</span>` : ''}
          ${(c.assignees || (c.assignee ? [c.assignee] : [])).map(a => `<span class="meta-tag assignee" title="${esc(a)}" onclick="toggleDFilterAssignee('${esc(a)}');event.stopPropagation()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ${esc(a)}</span>`).join('')}
        </div>
      </div>
    </div>
  </div>`;
}

function renderArchive() {
  const targets = ['d-archive-content', 'd-archive-content2'].map(id => document.getElementById(id)).filter(Boolean);
  if (!targets.length) return;
  const archived = allBoardCards().filter(isArchivedCard);
  let html;
  if (archived.length === 0) {
    html = `<div class="archive-empty"><div class="archive-empty-icon">📦</div>Nenhuma tarefa arquivada ainda.<br><span style="font-size:11px;opacity:0.6">Tarefas concluídas há mais de 7 dias aparecem aqui.</span></div>`;
  } else {
    archived.sort((a, b) => new Date(getDoneAt(b) || 0) - new Date(getDoneAt(a) || 0));
    html = `<div class="archive-header">
      <span class="archive-title">Arquivados — ${archived.length} ${archived.length === 1 ? 'item' : 'itens'}</span>
      <span class="archive-count">${archived.length}</span>
    </div>
    <div class="archive-grid">${archived.map(c => archiveCardHTML(c)).join('')}</div>`;
  }
  targets.forEach(el => updateDOM(el.id, html));
}

function renderDToday() {
  const root = document.getElementById('d-today-view');
  if (!root) return;
  const { overdue, today, next48 } = getMyDayBuckets(activeCards());
  const total = overdue.length + today.length + next48.length;
  if (!total) {
    updateDOM('d-today-view', `<div class="today-empty">
      <div class="today-empty-icon">✅</div>
      <div>Nada urgente por agora.</div>
      <div class="today-empty-sub">Sem tarefas vencidas, de hoje ou das próximas 48h.</div>
    </div>`);
    return;
  }
  updateDOM('d-today-view', `<div class="today-head">
    <div class="today-title">Meu Dia</div>
    <div class="today-count">${total} prioridade${total > 1 ? 's' : ''}</div>
  </div>
  ${todaySectionHTML('Vencidas', overdue, 'overdue')}
  ${todaySectionHTML('Hoje', today, 'today')}
  ${todaySectionHTML('Próximas 48h', next48, 'next48')}`);
}

function todaySectionHTML(title, list, kind) {
  if (!list.length) return '';
  return `<div class="today-section">
    <div class="today-section-head">
      <span class="today-section-title">${title}</span>
      <span class="today-section-count">${list.length}</span>
    </div>
    <div class="today-list">
      ${list.map(c => dTodayItemHTML(c, kind)).join('')}
    </div>
  </div>`;
}

function dTodayItemHTML(c, kind) {
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
      ${(c.assignees || (c.assignee ? [c.assignee] : [])).map(a => `<span class="today-pill">${esc(a)}</span>`).join('')}
    </div>
  </div>`;
}


function archiveCardHTML(c) {
  const p = PRI[c.priority] || PRI.media;
  const createdAt = getCreatedAt(c);
  const doneAt = getDoneAt(c);
  const dueDate = c.due;
  let dueClass = '';
  if (doneAt && dueDate) {
    dueClass = doneAt.slice(0, 10) <= dueDate ? 'ontime' : 'overdue';
  }
  return `<div class="archive-card">
    <div class="archive-card-title">${esc(c.title)}</div>
    <div class="archive-dates">
      <div class="archive-date-row">
        <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span class="archive-date-label">Criado</span>
        <span class="archive-date-val">${createdAt ? fmtDateFull(createdAt) : '—'}</span>
      </div>
      <div class="archive-date-row">
        <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <span class="archive-date-label">Prazo</span>
        <span class="archive-date-val ${dueClass}">${dueDate ? fmtDateFull(dueDate) : 'Sem prazo'}</span>
      </div>
      <div class="archive-date-row">
        <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
        <span class="archive-date-label">Concluído</span>
        <span class="archive-date-val ${doneAt && dueDate ? (doneAt.slice(0, 10) <= dueDate ? 'ontime' : 'overdue') : ''}">${doneAt ? fmtDateFull(doneAt) : '—'}</span>
      </div>
    </div>
    <div class="archive-footer">
      <span class="pri-tag ${p.cls}">${p.label}</span>
      ${c.effort ? `<span class="meta-tag effort" onclick="toggleDFilterEffort('${c.effort}');event.stopPropagation()">${c.effort}</span>` : ''}
      ${(c.assignees || (c.assignee ? [c.assignee] : [])).map(a => `<span class="meta-tag assignee" onclick="toggleDFilterAssignee('${esc(a)}');event.stopPropagation()" style="cursor:pointer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ${esc(a)}</span>`).join('')}
      ${(c.tags || []).slice(0, 2).map(t => `<span class="tag-pill-sm">${esc(t)}</span>`).join('')}
    </div>
    <button class="archive-unarchive-btn" onclick="event.stopPropagation();unarchiveCard('${c.id}')">
      <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.45"/></svg>
      Restaurar ao Kanban
    </button>
  </div>`;
}

function renderDStats() {
  const ac = activeCards(); const allBc = allBoardCards(); const total = ac.length;
  const done = allBc.filter(c => isDoneCol(c.col)).length;
  const allTotal = allBc.length;
  const overdue = ac.filter(c => isOverdue(c.due) && !isDoneCol(c.col)).length;
  const firstCol = getActiveCols()[0]?.col_id;
  const inProg = ac.filter(c => c.col !== firstCol && !isDoneCol(c.col)).length;
  updateDOM('d-stats-cards', [
    { label: 'Total', value: total, sub: 'tarefas', color: '' },
    { label: 'Concluídas', value: done, sub: `${allTotal ? Math.round(done / allTotal * 100) : 0}%`, color: 'var(--accent)' },
    { label: 'Em progresso', value: inProg, sub: 'ativas', color: 'var(--blue)' },
    { label: 'Vencidas', value: overdue, sub: 'urgentes', color: overdue > 0 ? 'var(--red)' : '' },
  ].map(s => `<div class="stat-card"><div class="stat-card-label">${s.label}</div><div class="stat-card-value" style="${s.color ? `color:${s.color}` : ''}">${s.value}</div><div class="stat-card-sub">${s.sub}</div></div>`).join(''));
  renderWeeklyChart('d-weekly-bars', ac);
  renderPriDist('d-pri-dist', ac);
  if (currentStatsTab === 'archive') renderArchive();
}

function toggleDFilter() {
  dFilterOpen = !dFilterOpen;
  document.getElementById('d-filter-bar').classList.toggle('open', dFilterOpen);
  document.getElementById('d-filter-btn').classList.toggle('active', dFilterOpen);
}
function toggleDFilterPri(p) {
  const i = dFilter.prioridades.indexOf(p);
  if (i > -1) dFilter.prioridades.splice(i, 1); else dFilter.prioridades.push(p);
  document.querySelectorAll(`.fpill-${p}`).forEach(el => el.classList.toggle('on', dFilter.prioridades.includes(p)));
  renderD();
}
function toggleDFilterSpec(t) {
  dFilter[t] = !dFilter[t]; 
  document.getElementById(`d-fpill-${t}`)?.classList.toggle('on', dFilter[t]); 
  renderD();
}

function toggleDFilterTag(t) {
  dFilter.tags = dFilter.tags || [];
  if (dFilter.tags.includes(t)) dFilter.tags = dFilter.tags.filter(x => x !== t);
  else dFilter.tags.push(t);
  renderD();
}

function toggleDFilterEffort(e) {
  dFilter.efforts = dFilter.efforts || [];
  if (dFilter.efforts.includes(e)) dFilter.efforts = dFilter.efforts.filter(x => x !== e);
  else dFilter.efforts.push(e);
  renderD();
}

function toggleDFilterAssignee(a) {
  dFilter.assignees = dFilter.assignees || [];
  if (dFilter.assignees.includes(a)) dFilter.assignees = dFilter.assignees.filter(x => x !== a);
  else dFilter.assignees.push(a);
  renderD();
}

function updateFilterUI() {
  const tf = document.getElementById('d-filter-tags');
  if (tf) {
    tf.innerHTML = (dFilter.tags || []).map(t => `<button class="fpill on" style="border-color:${getTagColor(t)};color:${getTagColor(t)}" onclick="toggleDFilterTag('${esc(t)}')">${esc(t)} ✕</button>`).join('');
  }
  const te = document.getElementById('d-filter-efforts');
  if (te) {
    te.innerHTML = (dFilter.efforts || []).map(e => `<button class="fpill on" style="border-color:var(--text2);color:var(--text2)" onclick="toggleDFilterEffort('${esc(e)}')"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> ${esc(e)} ✕</button>`).join('');
  }
  const ta = document.getElementById('d-filter-assignees');
  if (ta) {
    ta.innerHTML = (dFilter.assignees || []).map(a => `<button class="fpill on" style="border-color:var(--text2);color:var(--text2)" onclick="toggleDFilterAssignee('${esc(a)}')">👤 ${esc(a)} ✕</button>`).join('');
  }
}

function clearDFilters() {
  dFilter = { prioridades: [], tags: [], efforts: [], assignees: [], overdue: false, today: false };
  const dsearch = document.getElementById('d-search');
  if(dsearch) dsearch.value = '';

  document.querySelectorAll('.fpill').forEach(p => p.classList.remove('on')); 
  renderD();
}

// ── SHARED CHARTS ──
function renderWeeklyChart(elId, ac) {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const counts = Array(7).fill(0);
  ac.filter(c => isDoneCol(c.col)).forEach(c => {
    const doneAt = getDoneAt(c);
    if (!doneAt) return;
    const d = Math.floor((Date.now() - new Date(doneAt).getTime()) / 86400000);
    if (d >= 0 && d < 7) counts[6 - d]++;
  });
  const max = Math.max(...counts, 1); const today = new Date().getDay();
  document.getElementById(elId).innerHTML = counts.map((cnt, i) => {
    const di = (today - 6 + i + 7) % 7;
    return `<div class="chart-bar-wrap"><span class="chart-bar-val">${cnt || ''}</span>
      <div class="chart-bar" style="height:${Math.max(4, Math.round(cnt / max * 70))}px"></div>
      <span class="chart-bar-label">${days[di]}</span></div>`;
  }).join('');
}
function renderPriDist(elId, ac) {
  const total = ac.length;
  document.getElementById(elId).innerHTML = [
    { label: 'Alta', count: ac.filter(c => c.priority === 'alta').length, color: '#ef4444' },
    { label: 'Média', count: ac.filter(c => c.priority === 'media').length, color: '#f59e0b' },
    { label: 'Baixa', count: ac.filter(c => c.priority === 'baixa').length, color: '#4ade80' },
  ].map(p => `<div class="pri-dist-row"><span class="pri-dist-label">${p.label}</span>
    <div class="pri-dist-bar-bg"><div class="pri-dist-bar" style="width:${total ? Math.round(p.count / total * 100) : 0}%;background:${p.color}"></div></div>
    <span class="pri-dist-count">${p.count}</span></div>`).join('');
}
