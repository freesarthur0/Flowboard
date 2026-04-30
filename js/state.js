// ── ESTADO GLOBAL ──
let boards = [], cards = [], activeBoardId = null;
let boardColumns = {}; // { boardId: [ {id, board_id, col_id, label, color, position, is_done} ] }
let colMenuOpen = null;
let isMobile = window.innerWidth < 768;
let dView = 'kanban', mView = 'kanban', mActiveCol = 0;
let dFilter = { prioridades: [], efforts: [], assignees: [], tags: [], overdue: false, today: false }, dFilterOpen = false;
let editingCardId = null, currentTags = [], currentChecklist = [], currentDeps = [], dragCardId = null, dropBeforeCardId = null;
let newBoardColor = BOARD_COLORS[0];
// ── Sorting & Collapse ──
let colSortMode = {}; // { colId: 'manual'|'priority'|'date'|'name' }
let collapsedCols = JSON.parse(localStorage.getItem('fb_collapsed_cols') || '{}');

// ── LEMBRETES ──
let reminders = JSON.parse(localStorage.getItem('fb_reminders') || '[]');
const firedKey = 'fb_rem_fired';
let firedSet = new Set(JSON.parse(localStorage.getItem(firedKey) || '[]'));

// ── DUE-SOON ──
const dueSoonKey = 'fb_duesoon_fired';
let dueSoonFired = new Set(JSON.parse(localStorage.getItem(dueSoonKey) || '[]'));

// ── ANOTAÇÕES (Quadro de Post-its — global, sincronizado via Supabase) ──
let stickyNotes = [];               // [{id, x, y, w, h, color, content, z_index}]
let stickyCanvas = { panX: 0, panY: 0, zoom: 1 };
let draggingNoteId = null, resizingNoteId = null, panningCanvas = false;
let editingNoteId = null;
let selectedNoteId = null;
let maxNoteZ = 0;
const STICKY_COLORS = [
  { id: 'yellow', bg: '#fde68a', edge: '#facc15' },
  { id: 'pink',   bg: '#fbcfe8', edge: '#f472b6' },
  { id: 'blue',   bg: '#bfdbfe', edge: '#60a5fa' },
  { id: 'green',  bg: '#bbf7d0', edge: '#4ade80' },
  { id: 'orange', bg: '#fed7aa', edge: '#fb923c' },
  { id: 'purple', bg: '#ddd6fe', edge: '#a78bfa' }
];
