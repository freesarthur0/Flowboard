import { _daysFromToday, isOverdue, isToday, getMyDayBuckets, getSortedColCards } from '../src/utils';
import { Card } from '../src/types';

describe('Date Utilities', () => {
  it('_daysFromToday should calculate relative days correctly', () => {
    const nowMs = new Date('2023-10-15T12:00:00Z').getTime();
    expect(_daysFromToday('2023-10-15', nowMs)).toBe(0); // Today
    expect(_daysFromToday('2023-10-16', nowMs)).toBe(1); // Tomorrow
    expect(_daysFromToday('2023-10-14', nowMs)).toBe(-1); // Yesterday
  });

  it('isOverdue should return true if date is before today', () => {
    const nowMs = new Date('2023-10-15T12:00:00Z').getTime();
    expect(isOverdue('2023-10-14', nowMs)).toBe(true);
    expect(isOverdue('2023-10-15', nowMs)).toBe(false);
  });

  it('isToday should return true for current date', () => {
    expect(isToday('2023-10-15', '2023-10-15')).toBe(true);
    expect(isToday('2023-10-14', '2023-10-15')).toBe(false);
  });
});

describe('Card Filtering & Sorting', () => {
  const dummyCards: Card[] = [
    { id: '1', board_id: 'b1', col: 'todo', title: 'Task 1', priority: 'baixa', due: '2023-10-14', assignees: [], effort: '', tags: [], checklist: [], notes: '', position: 100, history: [] },
    { id: '2', board_id: 'b1', col: 'todo', title: 'Task 2', priority: 'alta', due: '2023-10-15', assignees: [], effort: '', tags: [], checklist: [], notes: '', position: 200, history: [] },
    { id: '3', board_id: 'b1', col: 'todo', title: 'Task 3', priority: 'media', due: '2023-10-16', assignees: [], effort: '', tags: [], checklist: [], notes: '', position: 300, history: [] },
  ];

  it('getMyDayBuckets should bucket correctly', () => {
    // Mock isDoneCol for tests
    (global as any).window = { isDoneCol: () => false };
    
    const nowDateStr = '2023-10-15';
    const nowMs = new Date('2023-10-15T12:00:00Z').getTime();
    
    const result = getMyDayBuckets(dummyCards, nowDateStr, nowMs);
    
    expect(result.overdue.length).toBe(1);
    expect(result.overdue[0].id).toBe('1');
    
    expect(result.today.length).toBe(1);
    expect(result.today[0].id).toBe('2');
    
    expect(result.next48.length).toBe(1);
    expect(result.next48[0].id).toBe('3');
  });

  it('getSortedColCards should apply priority sort', () => {
    // Mock isArchivedCard logic inside getSortedColCards relies on window.isDoneCol
    (global as any).window = { isDoneCol: () => false };

    const sortModeObj = { 'todo': 'priority' };
    
    const result = getSortedColCards('todo', 'b1', dummyCards, sortModeObj);
    
    // alta (id:2) -> media (id:3) -> baixa (id:1)
    expect(result[0].id).toBe('2');
    expect(result[1].id).toBe('3');
    expect(result[2].id).toBe('1');
  });
});
