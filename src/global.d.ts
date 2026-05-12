export {};

declare global {
  interface Window {
    // Globals set by state.ts and utils.ts
    boards: any[];
    cards: any[];
    activeBoardId: string | null;
    boardColumns: Record<string, any[]>;
    colMenuOpen: string | null;
    isMobile: boolean;
    dView: string;
    mView: string;
    mActiveCol: number;
    dFilter: any;
    dFilterOpen: boolean;
    editingCardId: string | null;
    currentTags: string[];
    currentChecklist: any[];
    currentDeps: any[];
    dragCardId: string | null;
    dropBeforeCardId: string | null;
    newBoardColor: string;
    colSortMode: Record<string, string>;
    collapsedCols: Record<string, boolean>;
    reminders: any[];
    firedKey: string;
    firedSet: Set<string>;
    dueSoonKey: string;
    dueSoonFired: Set<string>;
    stickyNotes: any[];
    stickyCanvas: any;
    draggingNoteId: string | null;
    resizingNoteId: string | null;
    panningCanvas: boolean;
    editingNoteId: string | null;
    selectedNoteId: string | null;
    maxNoteZ: number;
    STICKY_COLORS: any[];

    // Libraries
    supabase: any;
    morphdom: any;
    XLSX: any;

    // Functions
    setBoards: (v: any) => void;
    setCards: (v: any) => void;
    setActiveBoardId: (v: any) => void;
    setBoardColumns: (v: any) => void;
    setColMenuOpen: (v: any) => void;
    setIsMobile: (v: any) => void;
    setDView: (v: any) => void;
    setMView: (v: any) => void;
    setMActiveCol: (v: any) => void;
    setDFilter: (v: any) => void;
    setDFilterOpen: (v: any) => void;
    setEditingCardId: (v: any) => void;
    setCurrentTags: (v: any) => void;
    setCurrentChecklist: (v: any) => void;
    setCurrentDeps: (v: any) => void;
    setDragCardId: (v: any) => void;
    setDropBeforeCardId: (v: any) => void;
    setNewBoardColor: (v: any) => void;
    setColSortMode: (v: any) => void;
    setCollapsedCols: (v: any) => void;
    setReminders: (v: any) => void;
    setFiredSet: (v: any) => void;
    setDueSoonFired: (v: any) => void;
    setStickyNotes: (v: any) => void;
    setStickyCanvas: (v: any) => void;
    setDraggingNoteId: (v: any) => void;
    setResizingNoteId: (v: any) => void;
    setPanningCanvas: (v: any) => void;
    setEditingNoteId: (v: any) => void;
    setSelectedNoteId: (v: any) => void;
    setMaxNoteZ: (v: any) => void;

    esc: (s: string) => string;
    initials: (n: string) => string;
    _localDayMs: (v: any) => number;
    _daysFromToday: (v: any, nowMs?: number) => number;
    isOverdue: (due: string | null, nowMs?: number) => boolean;
    isToday: (due: string | null, nowDateStr?: string) => boolean;
    relDue: (due: string | null) => string;
    fmtDate: (due: string | null) => string;
    relTime: (ts: string) => string;
    getCreatedAt: (c: any) => string | null;
    getDoneAt: (c: any) => string | null;
    fmtDateFull: (iso: string | null) => string;
    isArchivedCard: (c: any) => boolean;
    getTagColor: (s: string) => string;
    renderMarkdown: (text: string) => string;
    activeCards: () => any[];
    allBoardCards: () => any[];
    getSortedColCards: (colId: string, boardId: string, cardsList?: any[], sortModeObj?: any) => any[];
    setColSort: (colId: string, mode: string) => void;
    toggleColCollapse: (colId: string) => void;
    moveCardToBoard: (cardId: string, targetBoardId: string) => void;
    initPositions: () => void;
    getMyDayBuckets: (list?: any[], nowDateStr?: string, nowMs?: number) => any;
    toast: (msg: string, color?: string, opts?: any) => void;
    executeUndo: () => void;
    celebrateComplete: (el: HTMLElement) => void;
    updateDOM: (containerId: string, html: string) => void;

    // From other modules
    render: () => void;
    renderD: () => void;
    renderM: () => void;
    sbFetch: (path: string, method?: string, body?: any, silent?: boolean, _retries?: number) => Promise<any>;
    COLS: any[];
    isDoneCol: (colId: string) => boolean;
    PRI: any;
    BOARD_COLORS: string[];
    [key: string]: any; // fallback for anything else
  }
}
