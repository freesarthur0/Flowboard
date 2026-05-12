import { Board, Card, Column, Reminder, StickyNote } from './types';

// ── ESTADO GLOBAL ──
export let boards: Board[] = [];
export let cards: Card[] = [];
export let activeBoardId: string | null = null;
export let boardColumns: Record<string, Column[]> = {};
export let colMenuOpen: string | null = null;
export let isMobile: boolean = window.innerWidth < 768;
export let dView: string = 'kanban';
export let mView: string = 'kanban';
export let mActiveCol: number = 0;

export interface FilterState {
  prioridades: string[];
  efforts: string[];
  assignees: string[];
  tags: string[];
  overdue: boolean;
  today: boolean;
}

export let dFilter: FilterState = { prioridades: [], efforts: [], assignees: [], tags: [], overdue: false, today: false };
export let dFilterOpen: boolean = false;

export let editingCardId: string | null = null;
export let currentTags: string[] = [];
export let currentChecklist: any[] = [];
export let currentDeps: any[] = [];
export let dragCardId: string | null = null;
export let dropBeforeCardId: string | null = null;
export let newBoardColor: string = '#3b82f6'; // default fallback

// ── Sorting & Collapse ──
export let colSortMode: Record<string, string> = {}; 
export let collapsedCols: Record<string, boolean> = JSON.parse(localStorage.getItem('fb_collapsed_cols') || '{}');

// ── LEMBRETES ──
export let reminders: Reminder[] = JSON.parse(localStorage.getItem('fb_reminders') || '[]');
export const firedKey = 'fb_rem_fired';
export let firedSet: Set<string> = new Set(JSON.parse(localStorage.getItem(firedKey) || '[]'));

// ── DUE-SOON ──
export const dueSoonKey = 'fb_duesoon_fired';
export let dueSoonFired: Set<string> = new Set(JSON.parse(localStorage.getItem(dueSoonKey) || '[]'));

// ── ANOTAÇÕES (Quadro de Post-its — global, sincronizado via Supabase) ──
export let stickyNotes: StickyNote[] = [];
export let stickyCanvas = { panX: 0, panY: 0, zoom: 1 };
export let draggingNoteId: string | null = null;
export let resizingNoteId: string | null = null;
export let panningCanvas: boolean = false;
export let editingNoteId: string | null = null;
export let selectedNoteId: string | null = null;
export let maxNoteZ: number = 0;

export const STICKY_COLORS = [
  { id: 'yellow', bg: '#fde68a', edge: '#facc15' },
  { id: 'pink',   bg: '#fbcfe8', edge: '#f472b6' },
  { id: 'blue',   bg: '#bfdbfe', edge: '#60a5fa' },
  { id: 'green',  bg: '#bbf7d0', edge: '#4ade80' },
  { id: 'orange', bg: '#fed7aa', edge: '#fb923c' },
  { id: 'purple', bg: '#ddd6fe', edge: '#a78bfa' }
];

// Re-export state setter functions to allow modifying exported let variables
export function setBoards(v: Board[]) { boards = v; }
export function setCards(v: Card[]) { cards = v; }
export function setActiveBoardId(v: string | null) { activeBoardId = v; }
export function setBoardColumns(v: Record<string, Column[]>) { boardColumns = v; }
export function setColMenuOpen(v: string | null) { colMenuOpen = v; }
export function setIsMobile(v: boolean) { isMobile = v; }
export function setDView(v: string) { dView = v; }
export function setMView(v: string) { mView = v; }
export function setMActiveCol(v: number) { mActiveCol = v; }
export function setDFilter(v: FilterState) { dFilter = v; }
export function setDFilterOpen(v: boolean) { dFilterOpen = v; }
export function setEditingCardId(v: string | null) { editingCardId = v; }
export function setCurrentTags(v: string[]) { currentTags = v; }
export function setCurrentChecklist(v: any[]) { currentChecklist = v; }
export function setCurrentDeps(v: any[]) { currentDeps = v; }
export function setDragCardId(v: string | null) { dragCardId = v; }
export function setDropBeforeCardId(v: string | null) { dropBeforeCardId = v; }
export function setNewBoardColor(v: string) { newBoardColor = v; }
export function setColSortMode(v: Record<string, string>) { colSortMode = v; }
export function setCollapsedCols(v: Record<string, boolean>) { collapsedCols = v; }
export function setReminders(v: Reminder[]) { reminders = v; }
export function setFiredSet(v: Set<string>) { firedSet = v; }
export function setDueSoonFired(v: Set<string>) { dueSoonFired = v; }
export function setStickyNotes(v: StickyNote[]) { stickyNotes = v; }
export function setStickyCanvas(v: { panX: number, panY: number, zoom: number }) { stickyCanvas = v; }
export function setDraggingNoteId(v: string | null) { draggingNoteId = v; }
export function setResizingNoteId(v: string | null) { resizingNoteId = v; }
export function setPanningCanvas(v: boolean) { panningCanvas = v; }
export function setEditingNoteId(v: string | null) { editingNoteId = v; }
export function setSelectedNoteId(v: string | null) { selectedNoteId = v; }
export function setMaxNoteZ(v: number) { maxNoteZ = v; }

// Assigning everything to window for legacy scripts
if (typeof window !== 'undefined') {
  Object.assign(window, {
    boards, cards, activeBoardId, boardColumns, colMenuOpen, isMobile,
    dView, mView, mActiveCol, dFilter, dFilterOpen, editingCardId,
    currentTags, currentChecklist, currentDeps, dragCardId, dropBeforeCardId,
    newBoardColor, colSortMode, collapsedCols, reminders, firedKey, firedSet,
    dueSoonKey, dueSoonFired, stickyNotes, stickyCanvas, draggingNoteId,
    resizingNoteId, panningCanvas, editingNoteId, selectedNoteId, maxNoteZ,
    STICKY_COLORS,
    setBoards, setCards, setActiveBoardId, setBoardColumns, setColMenuOpen,
    setIsMobile, setDView, setMView, setMActiveCol, setDFilter, setDFilterOpen,
    setEditingCardId, setCurrentTags, setCurrentChecklist, setCurrentDeps,
    setDragCardId, setDropBeforeCardId, setNewBoardColor, setColSortMode,
    setCollapsedCols, setReminders, setFiredSet, setDueSoonFired, setStickyNotes,
    setStickyCanvas, setDraggingNoteId, setResizingNoteId, setPanningCanvas,
    setEditingNoteId, setSelectedNoteId, setMaxNoteZ
  });
}
