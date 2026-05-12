// @ts-nocheck
import { Card } from './types';
import * as state from './state';

// ── UTILITÁRIOS ──
export const esc = (s: string) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const initials = (n: string) => (n || '?').trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

// Diferença em DIAS DE CALENDÁRIO no fuso local (não por horas), para evitar
// off-by-one quando "hoje" e "ontem" estão a menos de 24h de diferença.
export function _localDayMs(v: any): number {
  if (v == null) return NaN;
  if (typeof v === 'string') {
    const [y, m, d] = v.slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return NaN;
    return new Date(y, m - 1, d).getTime();
  }
  const dt = (v instanceof Date) ? v : new Date(v);
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
}

export function _daysFromToday(v: any, nowMs = Date.now()): number {
  // > 0 = no futuro, < 0 = no passado, 0 = hoje
  return Math.round((_localDayMs(v) - _localDayMs(new Date(nowMs))) / 86400000);
}

export const isOverdue = (due: string | null, nowMs = Date.now()) => due && _daysFromToday(due, nowMs) < 0;
export const isToday = (due: string | null, nowDateStr = new Date().toISOString().slice(0, 10)) => due === nowDateStr;

export const relDue = (due: string | null) => {
  if (!due) return '';
  const days = _daysFromToday(due);
  if (days < -1) return `${Math.abs(days)}d atrás`;
  if (days === -1) return 'ontem';
  if (days === 0) return 'hoje';
  if (days === 1) return 'amanhã';
  return `em ${days}d`;
};

export const fmtDate = (due: string | null) => due ? new Date(due + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '';
export const relTime = (ts: string) => {
  const d = -_daysFromToday(ts);
  return d === 0 ? 'hoje' : d === 1 ? 'ontem' : `${d}d atrás`;
};

// ── HELPERS DE DATA ──
export function getCreatedAt(c: Card) {
  const h = (c.history || []).find(x => x.msg === 'Criado');
  return h ? h.ts : (c.created_at || null);
}

export function getDoneAt(c: Card) {
  if (c.done_at) return c.done_at;
  const h = [...(c.history || [])].reverse().find(x => x.msg === 'Concluído' || x.msg.includes('Concluído'));
  return h ? h.ts : null;
}

export function fmtDateFull(iso: string | null) {
  if (!iso) return '—';
  const datePart = iso.slice(0, 10);
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return '—';
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function isArchivedCard(c: Card) {
  if (typeof window.isDoneCol === 'function') {
    if (!window.isDoneCol(c.col)) return false;
  }
  const doneAt = getDoneAt(c);
  if (!doneAt) return false;
  return (Date.now() - new Date(doneAt).getTime()) > 7 * 24 * 60 * 60 * 1000;
}

// ── Helpers ──
export const TAG_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899'];
export function getTagColor(s: string) {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

export function renderMarkdown(text: string) {
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
export function activeCards() { return state.cards.filter(c => c.board_id === state.activeBoardId && !isArchivedCard(c)); }
export function allBoardCards() { return state.cards.filter(c => c.board_id === state.activeBoardId); }

// ── ORDENAÇÃO POR POSITION ──
export function getSortedColCards(colId: string, boardId: string, cardsList: Card[] = state.cards, sortModeObj: Record<string, string> = state.colSortMode) {
  let list = cardsList
    .filter(c => c.board_id === (boardId || state.activeBoardId) && c.col === colId && !isArchivedCard(c))
    .sort((a, b) => (a.position ?? 999999) - (b.position ?? 999999));
  
  const mode = sortModeObj[colId];
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

export function setColSort(colId: string, mode: string) {
  state.colSortMode[colId] = mode;
  if (typeof window.render === 'function') window.render();
}

export function toggleColCollapse(colId: string) {
  state.collapsedCols[colId] = !state.collapsedCols[colId];
  localStorage.setItem('fb_collapsed_cols', JSON.stringify(state.collapsedCols));
  if (typeof window.render === 'function') window.render();
}

export async function moveCardToBoard(cardId: string, targetBoardId: string) {
  const c = state.cards.find(x => x.id === cardId);
  if (!c || c.board_id === targetBoardId) return;
  const targetCols = state.boardColumns[targetBoardId] || window.COLS?.map(x => ({ col_id: x.id })) || [];
  const firstCol = targetCols[0]?.col_id || 'backlog';
  c.board_id = targetBoardId;
  c.col = firstCol;
  c.history = [...(c.history || []), { msg: `Movido para quadro ${state.boards.find(b => b.id === targetBoardId)?.name || targetBoardId}`, ts: new Date().toISOString() }];
  if (typeof window.render === 'function') window.render();
  if (typeof window.sbFetch === 'function') {
    await window.sbFetch(`cards?id=eq.${cardId}`, 'PATCH', { board_id: targetBoardId, col: firstCol, history: c.history });
  }
  toast('Tarefa movida para outro quadro!');
}

export function initPositions() {
  state.boards.forEach(b => {
    const cols = (state.boardColumns[b.id] && state.boardColumns[b.id].length)
      ? state.boardColumns[b.id]
      : (window.COLS || []).map(c => ({ col_id: c.id }));
    cols.forEach(col => {
      const colCards = state.cards
        .filter(c => c.board_id === b.id && c.col === col.col_id)
        .sort((a, b2) => (a.position ?? 999999) - (b2.position ?? 999999));
      colCards.forEach((c, i) => {
        if (c.position == null) c.position = (i + 1) * 100;
      });
    });
  });
}

export function getMyDayBuckets(list: Card[] = [], nowDateStr?: string, nowMs?: number) {
  if (!list.length && typeof window.activeCards === 'function') list = window.activeCards();
  const todayStr = nowDateStr || new Date().toISOString().slice(0, 10);
  const in48h = (nowMs || Date.now()) + 48 * 60 * 60 * 1000;
  const priorityWeight = { alta: 0, media: 1, baixa: 2 };
  const sortByUrgency = (a: Card, b: Card) => {
    if ((a.due || '') !== (b.due || '')) return (a.due || '').localeCompare(b.due || '');
    return (priorityWeight[a.priority] ?? 99) - (priorityWeight[b.priority] ?? 99);
  };

  const openCards = list.filter(c => {
    const isDone = typeof window.isDoneCol === 'function' ? window.isDoneCol(c.col) : false;
    return !isDone && c.due;
  });
  const overdue: Card[] = [];
  const today: Card[] = [];
  const next48: Card[] = [];

  openCards.forEach(c => {
    const dueDay = c.due;
    if (!dueDay) return;
    const dueEndMs = new Date(dueDay + 'T23:59:59').getTime();
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
let _toastUndoAction: any = null;
export function toast(msg: string, color = '#4ade80', opts: any = null) {
  if (typeof document === 'undefined') return;
  document.getElementById('toast-dot')!.style.background = color;
  document.getElementById('toast-msg')!.textContent = msg;
  const t = document.getElementById('toast') as any;
  const undoBtn = document.getElementById('toast-undo')!;
  const progress = document.getElementById('toast-progress')!;
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
export function executeUndo() {
  if (typeof document === 'undefined') return;
  if (_toastUndoAction) { _toastUndoAction(); _toastUndoAction = null; }
  const t = document.getElementById('toast') as any;
  clearTimeout(t._t);
  t.classList.remove('show');
  document.getElementById('toast-undo')!.style.display = 'none';
  document.getElementById('toast-progress')!.style.display = 'none';
}

// ── CONFETTI / CELEBRATION ──
export function celebrateComplete(el: HTMLElement) {
  if (typeof document === 'undefined') return;
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
export function updateDOM(containerId: string, html: string) {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(containerId);
  if (!el) return;
  if (typeof (window as any).morphdom !== 'undefined') {
    const temp = el.cloneNode(false) as HTMLElement;
    temp.innerHTML = html;
    (window as any).morphdom(el, temp);
  } else {
    el.innerHTML = html;
  }
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    esc, initials, _localDayMs, _daysFromToday, isOverdue, isToday, relDue,
    fmtDate, relTime, getCreatedAt, getDoneAt, fmtDateFull, isArchivedCard,
    getTagColor, renderMarkdown, activeCards, allBoardCards, getSortedColCards,
    setColSort, toggleColCollapse, moveCardToBoard, initPositions, getMyDayBuckets,
    toast, executeUndo, celebrateComplete, updateDOM
  });
}
