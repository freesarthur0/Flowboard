// ════════════════════════
// MINI CALENDÁRIO
// ════════════════════════
let calYear = new Date().getFullYear(), calMonth = new Date().getMonth();
const CAL_DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const CAL_MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function renderCal() {
  const grid = document.getElementById('cal-grid');
  const label = document.getElementById('cal-month-label');
  if (!grid || !label) return;
  label.textContent = `${CAL_MONTHS[calMonth]} ${calYear}`;
  const today = new Date();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const daysInPrev = new Date(calYear, calMonth, 0).getDate();
  const dueDates = new Set();
  const remDates = new Set();
  cards.filter(c => c.board_id === activeBoardId).forEach(c => {
    if (c.due) { const d = new Date(c.due + 'T00:00:00'); if (d.getFullYear() === calYear && d.getMonth() === calMonth) dueDates.add(d.getDate()); }
  });
  reminders.filter(r => r.board_id === activeBoardId && !r.done && r.when).forEach(r => {
    const d = new Date(r.when); if (d.getFullYear() === calYear && d.getMonth() === calMonth) remDates.add(d.getDate());
  });
  let html = CAL_DAYS.map(d => `<div class="cal-day-label">${d}</div>`).join('');
  for (let i = 0; i < firstDay; i++) {
    html += `<div class="cal-day other-month">${daysInPrev - firstDay + i + 1}</div>`;
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === d;
    const hasDue = dueDates.has(d); const hasRem = remDates.has(d);
    const cls = ['cal-day', isToday ? 'today' : '', hasDue || hasRem ? 'has-event' : '', hasDue ? 'has-due' : ''].filter(Boolean).join(' ');
    const hasEvents = hasDue || hasRem;
    html += `<div class="${cls}" onclick="calDayClick(${d})"${hasEvents ? ` onmouseenter="showCalTooltip(event,${d})" onmouseleave="hideCalTooltip()"` : ''}>${d}</div>`;
  }
  const total = firstDay + daysInMonth; const remaining = (7 - total % 7) % 7;
  for (let d = 1; d <= remaining; d++) html += `<div class="cal-day other-month">${d}</div>`;
  grid.innerHTML = html;
}

function calNav(dir) {
  calMonth += dir;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCal();
}

function calDayClick(day) {
  const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const matching = cards.filter(c => c.board_id === activeBoardId && c.due === dateStr);
  if (matching.length === 1) { editCard(matching[0].id); }
  else if (matching.length > 1) {
    document.getElementById('d-search').value = dateStr;
    onGSearch(dateStr);
  }
}

function showCalTooltip(e, day) {
  let tip = document.getElementById('cal-tooltip');
  if (!tip) { tip = document.createElement('div'); tip.id = 'cal-tooltip'; tip.className = 'cal-day-tooltip'; document.body.appendChild(tip); }
  const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  const dayTasks = cards.filter(c => c.board_id === activeBoardId && c.due === dateStr);
  const dayRems = reminders.filter(r => r.board_id === activeBoardId && !r.done && r.when && r.when.startsWith(dateStr));
  if (!dayTasks.length && !dayRems.length) { tip.style.display = 'none'; return; }
  let html = '';
  if (dayTasks.length) {
    html += `<div class="cal-tooltip-title">Tarefas</div>`;
    html += dayTasks.slice(0,4).map(c => {
      const p = PRI[c.priority] || PRI.media;
      return `<div class="cal-tooltip-task"><span class="cal-tooltip-dot" style="background:${p.color}"></span>${esc(c.title)}</div>`;
    }).join('');
    if (dayTasks.length > 4) html += `<div style="font-size:10px;color:var(--text3);padding:2px 0 0 11px">+${dayTasks.length-4} mais</div>`;
  }
  if (dayRems.length) {
    if (dayTasks.length) html += `<div style="height:1px;background:var(--border);margin:5px 0"></div>`;
    html += `<div class="cal-tooltip-title">Lembretes</div>`;
    html += dayRems.slice(0,3).map(r => `<div class="cal-tooltip-task"><span class="cal-tooltip-dot" style="background:var(--amber)"></span>${esc(r.text)}</div>`).join('');
  }
  tip.innerHTML = html;
  tip.style.display = 'block';
  const rect = e.currentTarget.getBoundingClientRect();
  let left = rect.left + rect.width/2 - 80;
  let top = rect.top - tip.offsetHeight - 8;
  if (left < 8) left = 8;
  if (left + 160 > window.innerWidth) left = window.innerWidth - 168;
  if (top < 8) top = rect.bottom + 8;
  tip.style.left = left + 'px';
  tip.style.top = top + 'px';
}

function hideCalTooltip() {
  const tip = document.getElementById('cal-tooltip');
  if (tip) tip.style.display = 'none';
}

// ════════════════════════
// INIT
// ════════════════════════
async function init() {
  isMobile = window.innerWidth < 768;
  document.getElementById(isMobile ? 'mobile-layout' : 'desktop-layout').style.display = 'flex';
  try {
    const [bData, cData] = await Promise.all([sbFetch('boards?order=created_at'), sbFetch('cards?order=created_at')]);
    boards = bData || []; cards = cData || [];
    if (!boards.length) {
      const nb = await sbFetch('boards', 'POST', { id: 'pessoal', name: 'Pessoal', color: '#7c6fff' });
      boards = nb || [{ id: 'pessoal', name: 'Pessoal', color: '#7c6fff' }];
    }
    activeBoardId = boards[0]?.id;
    // Carrega colunas de todos os boards (migração automática inclusa)
    await Promise.all(boards.map(b => loadBoardColumns(b.id)));
    initPositions();
    const ls = document.getElementById('loading-screen');
    ls.classList.add('loading-done');
    setTimeout(() => ls.style.display = 'none', 500);
    injectDemoArchive();
    render();
  } catch (e) {
    document.getElementById('loading-sub').textContent = 'Erro ao conectar. Verifique o Supabase.';
    console.error(e);
  }
}

function injectDemoArchive() {
  const demoKey = 'fb_demo_injected_v1';
  if (localStorage.getItem(demoKey)) return;
  const boardId = activeBoardId;
  const alreadyHas = cards.some(c => c.board_id === boardId && isArchivedCard(c));
  if (alreadyHas) { localStorage.setItem(demoKey, '1'); return; }
  const doneDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  const createdDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
  const dueDate = new Date(Date.now() - 12 * 24 * 60 * 60 * 1000);
  const demo = {
    id: 'demo_archive_1', board_id: boardId,
    title: 'Exemplo: Relatório mensal de performance',
    col: 'done', priority: 'alta', assignees: ['Ana', 'Pedro'],
    due: dueDate.toISOString().slice(0, 10),
    effort: 'G', tags: ['relatório', 'mensal'],
    notes: 'Este é um exemplo de tarefa arquivada.',
    checklist: [{ text: 'Coletar dados', done: true }, { text: 'Revisar com gestor', done: true }, { text: 'Publicar', done: true }],
    history: [
      { msg: 'Criado', ts: createdDate.toISOString() },
      { msg: 'Movido para Em progresso', ts: new Date(createdDate.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString() },
      { msg: 'Movido para Revisão', ts: new Date(createdDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() },
      { msg: 'Movido para Concluído', ts: doneDate.toISOString() },
      { msg: 'Concluído', ts: doneDate.toISOString() },
    ],
    done_at: doneDate.toISOString(),
    created_at: createdDate.toISOString(),
  };
  cards.push(demo);
  localStorage.setItem(demoKey, '1');
}

window.addEventListener('resize', () => {
  const nowMobile = window.innerWidth < 768;
  if (nowMobile !== isMobile) {
    isMobile = nowMobile;
    document.getElementById('desktop-layout').style.display = isMobile ? 'none' : 'flex';
    document.getElementById('mobile-layout').style.display = isMobile ? 'flex' : 'none';
    render();
  }
});

// ── BOOTSTRAP ──
init();
setTimeout(requestNotifPermission, 2000);
setTimeout(initRealtime, 1500); // aguarda init() terminar
scheduleReminderCheck();
