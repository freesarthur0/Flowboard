// ── CONFIG ──
export const SUPA_URL = 'https://ouxuzlyghfiisxzbjvyv.supabase.co';
export const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91eHV6bHlnaGZpaXN4emJqdnl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTIwOTYsImV4cCI6MjA5NDA4ODA5Nn0.rX2jTA3DqqNw_Xlr-lhSqXI7P7c_J9KUuXXS9RsEqy8';
export const H = {
  'Content-Type': 'application/json',
  'apikey': SUPA_KEY,
  'Authorization': `Bearer ${SUPA_KEY}`,
  'Prefer': 'return=representation'
};

// ── COLUNAS KANBAN ──
export const COLS = [
  { id: 'backlog',  label: 'Backlog',      color: '#6366f1' },
  { id: 'todo',     label: 'A fazer',      color: '#f59e0b' },
  { id: 'progress', label: 'Em progresso', color: '#3b82f6' },
  { id: 'review',   label: 'Revisão',      color: '#ec4899' },
  { id: 'done',     label: 'Concluído',    color: '#10b981' },
];

// ── PRIORIDADES ──
export const PRI = {
  alta:  { label: 'Alta',  cls: 'pri-alta',  color: '#ef4444' },
  media: { label: 'Média', cls: 'pri-media', color: '#f59e0b' },
  baixa: { label: 'Baixa', cls: 'pri-baixa', color: '#4ade80' },
};

// ── CORES DOS QUADROS ──
export const BOARD_COLORS = [
  '#7c6fff', '#3b82f6', '#10b981', '#f59e0b',
  '#ec4899', '#ef4444', '#8b5cf6', '#06b6d4'
];

if (typeof window !== 'undefined') {
  Object.assign(window, { SUPA_URL, SUPA_KEY, H, COLS, PRI, BOARD_COLORS });
}
