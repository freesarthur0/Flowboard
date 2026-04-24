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

// ── ANOTAÇÕES (Obsidian vault viewer — read-only) ──
let vaultName = '';                 // nome da pasta raiz do vault carregado
let vaultFiles = new Map();         // path relativo (ex: "Trabalho/Reunião.md") -> { file: File, content: string|null }
let vaultAttachments = new Map();   // path relativo -> { file: File, url: string|null }
let activeVaultPath = null;         // path atualmente aberto no preview
let vaultOpenTabs = [];             // array de paths abertos (read-only multi-tab)
let vaultExpandedFolders = new Set();
let vaultSearchQuery = '';
