// ── CONFIG ──
const SUPA_URL = 'https://porlmltbobcbzowfwlwc.supabase.co';
const SUPA_KEY = 'sb_publishable_zhMX_ryicFHw7bkr7nVUOQ_JYuwxJat';
const H = {
  'Content-Type': 'application/json',
  'apikey': SUPA_KEY,
  'Authorization': `Bearer ${SUPA_KEY}`,
  'Prefer': 'return=representation'
};

// ── COLUNAS KANBAN ──
const COLS = [
  { id: 'backlog',  label: 'Backlog',      color: '#6366f1' },
  { id: 'todo',     label: 'A fazer',      color: '#f59e0b' },
  { id: 'progress', label: 'Em progresso', color: '#3b82f6' },
  { id: 'review',   label: 'Revisão',      color: '#ec4899' },
  { id: 'done',     label: 'Concluído',    color: '#10b981' },
];

// ── PRIORIDADES ──
const PRI = {
  alta:  { label: 'Alta',  cls: 'pri-alta',  color: '#ef4444' },
  media: { label: 'Média', cls: 'pri-media', color: '#f59e0b' },
  baixa: { label: 'Baixa', cls: 'pri-baixa', color: '#4ade80' },
};

// ── CORES DOS QUADROS ──
const BOARD_COLORS = [
  '#7c6fff', '#3b82f6', '#10b981', '#f59e0b',
  '#ec4899', '#ef4444', '#8b5cf6', '#06b6d4'
];
