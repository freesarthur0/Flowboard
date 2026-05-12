export interface Board {
  id: string;
  name: string;
  color: string;
}

export interface Column {
  id: string;
  board_id: string;
  col_id: string;
  label: string;
  color: string;
  position: number;
  is_done: boolean;
  wip_limit?: number | null;
}

export interface CardHistory {
  msg: string;
  ts: string;
}

export interface CardChecklist {
  text: string;
  done: boolean;
}

export interface Card {
  id: string;
  board_id: string;
  title: string;
  col: string;
  priority: 'alta' | 'media' | 'baixa' | string;
  assignees: string[];
  assignee?: string; // fallback
  due: string | null;
  effort: string;
  tags: string[];
  checklist: CardChecklist[];
  notes: string;
  position: number;
  history: CardHistory[];
  done_at?: string | null;
  created_at?: string;
}

export interface Reminder {
  id: string;
  board_id: string;
  text: string;
  when: string;
  advanceMin: number;
  recur: string;
  done: boolean;
  created: string;
}

export interface StickyNote {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  content: string;
  z_index: number;
}
