// ══════════════════════════
// TIMELINE / GANTT VIEW
// ══════════════════════════
let tlWindowStart = null;
let tlDays = 70; // janela padrão: 10 semanas

function tlAddDays(date, n) {
  const d = new Date(date); d.setDate(d.getDate() + n); return d;
}

function tlInitWindow() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  tlWindowStart = tlAddDays(today, -14); // 2 semanas antes do hoje
}

function tlToPercent(date) {
  const end = tlAddDays(tlWindowStart, tlDays);
  return (date - tlWindowStart) / (end - tlWindowStart) * 100;
}

function tlNav(days) {
  tlWindowStart = tlAddDays(tlWindowStart, days);
  renderTimeline();
}

function tlGoToday() {
  tlInitWindow();
  renderTimeline();
}

function tlSetZoom(days) {
  const mid = tlAddDays(tlWindowStart, Math.floor(tlDays / 2));
  tlDays = days;
  tlWindowStart = tlAddDays(mid, -Math.floor(tlDays / 2));
  renderTimeline();
}

function renderTimeline() {
  if (!tlWindowStart) tlInitWindow();
  const el = document.getElementById('d-timeline-view');
  if (!el || !el.classList.contains('active')) return;

  const tlEnd = tlAddDays(tlWindowStart, tlDays);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayPct = tlToPercent(today);

  const timedCards = activeCards().filter(c => c.due);

  // ── Controles ──
  const periodLabel = `${tlWindowStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} — ${tlEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  const controls = `
    <div class="tl-controls">
      <button class="tl-nav-btn" onclick="tlNav(-tlDays)">‹‹</button>
      <button class="tl-nav-btn" onclick="tlNav(-Math.floor(tlDays/2))">‹</button>
      <span class="tl-period">${periodLabel}</span>
      <button class="tl-nav-btn" onclick="tlNav(Math.floor(tlDays/2))">›</button>
      <button class="tl-nav-btn" onclick="tlNav(tlDays)">››</button>
      <button class="tl-nav-btn tl-today-btn" onclick="tlGoToday()">Hoje</button>
      <div class="tl-zoom-group">
        <button class="tl-zoom-btn${tlDays===35?' active':''}" onclick="tlSetZoom(35)">5s</button>
        <button class="tl-zoom-btn${tlDays===70?' active':''}" onclick="tlSetZoom(70)">10s</button>
        <button class="tl-zoom-btn${tlDays===140?' active':''}" onclick="tlSetZoom(140)">20s</button>
      </div>
    </div>`;

  if (!timedCards.length) {
    el.innerHTML = controls + `<div class="tl-empty"><div class="tl-empty-icon">📅</div>Nenhuma tarefa com prazo definido.<br>Adicione um prazo em qualquer tarefa para vê-la aqui.</div>`;
    return;
  }

  // ── Cabeçalho de datas ──
  let ticksHTML = '';
  const tickInterval = tlDays <= 35 ? 7 : tlDays <= 70 ? 7 : 14;
  let d = new Date(tlWindowStart);
  while (d <= tlEnd) {
    const pct = tlToPercent(d);
    if (pct >= -1 && pct <= 101) {
      const isMonthStart = d.getDate() <= tickInterval;
      const label = isMonthStart
        ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
        : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      ticksHTML += `<div class="tl-tick${isMonthStart ? ' tl-tick-month' : ''}" style="left:${pct}%"><span>${label}</span></div>`;
    }
    d = tlAddDays(d, tickInterval);
  }
  const todayLineHeader = todayPct >= 0 && todayPct <= 100
    ? `<div class="tl-today-line" style="left:${todayPct}%"><span class="tl-today-label">Hoje</span></div>` : '';

  // ── Linhas agrupadas por coluna ──
  let bodyHTML = '';
  getActiveCols().forEach(col => {
    const colCards = getSortedColCards(col.col_id, activeBoardId).filter(c => c.due);
    if (!colCards.length) return;

    bodyHTML += `<div class="tl-group-header">
      <div class="tl-group-dot" style="background:${col.color}"></div>${col.label}
      <span style="margin-left:auto;font-family:'Space Mono',monospace;font-size:10px;opacity:0.5">${colCards.length}</span>
    </div>`;

    colCards.forEach(c => {
      const due = new Date(c.due + 'T23:59:59');
      let start = c.created_at ? new Date(c.created_at) : null;
      if (!start || start >= due) start = tlAddDays(due, -Math.max(3, Math.floor(tlDays / 14)));
      start.setHours(0, 0, 0, 0);

      const leftPct = tlToPercent(start);
      const rightPct = tlToPercent(due);
      const widthPct = Math.max(0.8, rightPct - leftPct);
      const clampedLeft = Math.max(-2, leftPct);
      const clampedWidth = Math.min(widthPct, 102 - clampedLeft);

      // Visível na janela?
      const isOver = today > due && c.col !== 'done';
      const isDone = isDoneCol(c.col);
      const extraClass = isOver ? ' tl-bar-over' : isDone ? ' tl-bar-done' : '';

      const todayRowLine = todayPct >= 0 && todayPct <= 100
        ? `<div class="tl-row-today" style="left:${todayPct}%"></div>` : '';

      bodyHTML += `
        <div class="tl-row">
          <div class="tl-row-label" onclick="editCard('${c.id}')" title="${esc(c.title)}">${esc(c.title)}</div>
          <div class="tl-row-chart">
            ${todayRowLine}
            <div class="tl-bar${extraClass}"
                 style="left:${clampedLeft}%;width:${clampedWidth}%;background:${col.color}22;border-color:${col.color};"
                 onclick="editCard('${c.id}')" title="${esc(c.title)} · Prazo: ${fmtDate(c.due)}">
              <span class="tl-bar-inner" style="color:${col.color}">${esc(c.title)}</span>
              <span class="tl-bar-due" style="color:${col.color}">${fmtDate(c.due)}</span>
            </div>
          </div>
        </div>`;
    });
  });

  el.innerHTML = controls + `
    <div class="tl-grid-wrap">
      <div class="tl-header-row">
        <div class="tl-header-label">Tarefa</div>
        <div class="tl-header-chart">${ticksHTML}${todayLineHeader}</div>
      </div>
      <div class="tl-body">${bodyHTML}</div>
    </div>`;
}
