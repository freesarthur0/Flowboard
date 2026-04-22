// ── UTILITÁRIOS ──
const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const initials = n => (n || '?').trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
const isOverdue = due => due && new Date(due) < new Date(new Date().toDateString());
const isToday = due => due === new Date().toISOString().slice(0, 10);
const relDue = due => {
  if (!due) return '';
  const diff = new Date(due + 'T23:59:59') - new Date();
  const days = Math.ceil(diff / 86400000);
  if (days < -1) return `${Math.abs(days)}d atrás`;
  if (days === -1) return 'ontem';
  if (days === 0) return 'hoje';
  if (days === 1) return 'amanhã';
  return `em ${days}d`;
};
const fmtDate = due => due ? new Date(due + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '';
const relTime = ts => {
  const d = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
  return d === 0 ? 'hoje' : d === 1 ? 'ontem' : `${d}d atrás`;
};

// ── HELPERS DE DATA ──
function getCreatedAt(c) {
  const h = (c.history || []).find(x => x.msg === 'Criado');
  return h ? h.ts : (c.created_at || null);
}
function getDoneAt(c) {
  if (c.done_at) return c.done_at;
  const h = [...(c.history || [])].reverse().find(x => x.msg === 'Concluído' || x.msg.includes('Concluído'));
  return h ? h.ts : null;
}
function fmtDateFull(iso) {
  if (!iso) return '—';
  const datePart = iso.slice(0, 10);
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return '—';
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function isArchivedCard(c) {
  if (!isDoneCol(c.col)) return false;
  const doneAt = getDoneAt(c);
  if (!doneAt) return false;
  return (Date.now() - new Date(doneAt).getTime()) > 7 * 24 * 60 * 60 * 1000;
}
// ── Helpers ──
const TAG_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899'];
function getTagColor(s) {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

function renderMarkdown(text) {
  if (!text) return '';
  let html = esc(text);
  html = html.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color:var(--accent);text-decoration:underline">$1</a>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/^- (.*)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>(?:\n<li>.*<\/li>)*)/g, '<ul style="margin:2px 0;padding-left:18px">$1</ul>');
  html = html.replace(/<\/li>\n<li>/g, '</li><li>');
  html = html.replace(/\n/g, '<br>');
  html = html.replace(/<\/ul><br>/g, '</ul>');
  html = html.replace(/<br><ul/g, '<ul');
  return html;
}

// ── SELETORES DE CARDS ──
function activeCards() { return cards.filter(c => c.board_id === activeBoardId && !isArchivedCard(c)); }
function allBoardCards() { return cards.filter(c => c.board_id === activeBoardId); }

// ── ORDENAÇÃO POR POSITION ──
function getSortedColCards(colId, boardId) {
  let list = cards
    .filter(c => c.board_id === (boardId || activeBoardId) && c.col === colId && !isArchivedCard(c))
    .sort((a, b) => (a.position ?? 999999) - (b.position ?? 999999));
  // Apply sort mode if set
  const mode = colSortMode[colId];
  if (mode === 'priority') {
    const pw = { alta: 0, media: 1, baixa: 2 };
    list.sort((a, b) => (pw[a.priority] ?? 99) - (pw[b.priority] ?? 99));
  } else if (mode === 'date') {
    list.sort((a, b) => (a.due || '9999') > (b.due || '9999') ? 1 : -1);
  } else if (mode === 'name') {
    list.sort((a, b) => a.title.localeCompare(b.title));
  }
  return list;
}

function setColSort(colId, mode) {
  colSortMode[colId] = mode;
  render();
}

function toggleColCollapse(colId) {
  collapsedCols[colId] = !collapsedCols[colId];
  localStorage.setItem('fb_collapsed_cols', JSON.stringify(collapsedCols));
  render();
}

async function moveCardToBoard(cardId, targetBoardId) {
  const c = cards.find(x => x.id === cardId);
  if (!c || c.board_id === targetBoardId) return;
  // Move to first column of target board
  const targetCols = boardColumns[targetBoardId] || COLS.map(x => ({ col_id: x.id }));
  const firstCol = targetCols[0]?.col_id || 'backlog';
  c.board_id = targetBoardId;
  c.col = firstCol;
  c.history = [...(c.history || []), { msg: `Movido para quadro ${boards.find(b => b.id === targetBoardId)?.name || targetBoardId}`, ts: new Date().toISOString() }];
  render();
  await sbFetch(`cards?id=eq.${cardId}`, 'PATCH', { board_id: targetBoardId, col: firstCol, history: c.history });
  toast('Tarefa movida para outro quadro!');
}

function initPositions() {
  // Para cada quadro × coluna, garante que todo card tenha position definida
  boards.forEach(b => {
    const cols = (boardColumns[b.id] && boardColumns[b.id].length)
      ? boardColumns[b.id]
      : COLS.map(c => ({ col_id: c.id }));
    cols.forEach(col => {
      const colCards = cards
        .filter(c => c.board_id === b.id && c.col === col.col_id)
        .sort((a, b2) => (a.position ?? 999999) - (b2.position ?? 999999));
      colCards.forEach((c, i) => {
        if (c.position == null) c.position = (i + 1) * 100;
      });
    });
  });
}

function getMyDayBuckets(list = activeCards()) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const in48h = Date.now() + 48 * 60 * 60 * 1000;
  const priorityWeight = { alta: 0, media: 1, baixa: 2 };
  const sortByUrgency = (a, b) => {
    if ((a.due || '') !== (b.due || '')) return (a.due || '').localeCompare(b.due || '');
    return (priorityWeight[a.priority] ?? 99) - (priorityWeight[b.priority] ?? 99);
  };

  const openCards = list.filter(c => !isDoneCol(c.col) && c.due);
  const overdue = [];
  const today = [];
  const next48 = [];

  openCards.forEach(c => {
    const dueDay = c.due;
    const dueEndMs = new Date(c.due + 'T23:59:59').getTime();
    if (dueDay < todayStr) overdue.push(c);
    else if (dueDay === todayStr) today.push(c);
    else if (dueEndMs <= in48h) next48.push(c);
  });

  overdue.sort(sortByUrgency);
  today.sort(sortByUrgency);
  next48.sort(sortByUrgency);
  return { overdue, today, next48 };
}

// ── TOAST (com suporte a Undo) ──
let _toastUndoAction = null;
function toast(msg, color = '#4ade80', opts = null) {
  document.getElementById('toast-dot').style.background = color;
  document.getElementById('toast-msg').textContent = msg;
  const t = document.getElementById('toast');
  const undoBtn = document.getElementById('toast-undo');
  const progress = document.getElementById('toast-progress');
  // Reset
  clearTimeout(t._t);
  _toastUndoAction = null;
  if (opts && opts.action) {
    _toastUndoAction = opts.action;
    undoBtn.textContent = opts.label || 'Desfazer';
    undoBtn.style.display = 'inline-block';
    progress.style.display = 'block';
    progress.style.animation = 'none';
    void progress.offsetWidth;
    progress.style.animation = 'toastCountdown 6s linear forwards';
    t.classList.add('show');
    t._t = setTimeout(() => { t.classList.remove('show'); _toastUndoAction = null; undoBtn.style.display = 'none'; progress.style.display = 'none'; }, 6200);
  } else {
    undoBtn.style.display = 'none';
    progress.style.display = 'none';
    t.classList.add('show');
    t._t = setTimeout(() => t.classList.remove('show'), 2400);
  }
}
function executeUndo() {
  if (_toastUndoAction) { _toastUndoAction(); _toastUndoAction = null; }
  const t = document.getElementById('toast');
  clearTimeout(t._t);
  t.classList.remove('show');
  document.getElementById('toast-undo').style.display = 'none';
  document.getElementById('toast-progress').style.display = 'none';
}

// ── CONFETTI / CELEBRATION ──
function celebrateComplete(el) {
  const rect = el ? el.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 3, width: 0, height: 0 };
  const cx = rect.left + (rect.width || 0) / 2;
  const cy = rect.top + (rect.height || 0) / 2;
  const burst = document.createElement('div');
  burst.className = 'confetti-burst';
  burst.style.left = cx + 'px';
  burst.style.top = cy + 'px';
  const colors = ['#4ade80','#60a5fa','#f59e0b','#ec4899','#a855f7','#06b6d4','#fbbf24'];
  for (let i = 0; i < 22; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-particle';
    const angle = (Math.PI * 2 * i) / 22 + (Math.random() - 0.5) * 0.4;
    const dist = 35 + Math.random() * 65;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = 3 + Math.random() * 5;
    const ratio = Math.random() > 0.5 ? 1 : 0.5;
    p.style.cssText = `--x:${Math.cos(angle)*dist}px;--y:${Math.sin(angle)*dist - 15}px;--r:${Math.random()*720-360}deg;background:${color};width:${size}px;height:${size*ratio}px;border-radius:${Math.random()>0.5?'50%':'1px'};animation-delay:${Math.random()*0.08}s;`;
    burst.appendChild(p);
  }
  document.body.appendChild(burst);
  setTimeout(() => burst.remove(), 900);
}

// ── DOM VIRTUAL (MORPHDOM) ──
function updateDOM(containerId, html) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (typeof morphdom !== 'undefined') {
    const temp = el.cloneNode(false);
    temp.innerHTML = html;
    morphdom(el, temp);
  } else {
    el.innerHTML = html;
  }
}
