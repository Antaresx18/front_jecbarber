import { describe, it, expect } from 'vitest';
import {
  addDaysIso,
  isFechaInRange,
  filterGastosByDateRange,
  parseHoraToMinutes,
} from './adminFilters';

describe('addDaysIso', () => {
  it('suma días en el mismo mes', () => {
    expect(addDaysIso('2026-03-19', 1)).toBe('2026-03-20');
    expect(addDaysIso('2026-03-19', 13)).toBe('2026-04-01');
  });
});

describe('isFechaInRange', () => {
  it('sin límites acepta todo', () => {
    expect(isFechaInRange('2026-03-15', '', '')).toBe(true);
  });
  it('respeta desde y hasta', () => {
    expect(isFechaInRange('2026-03-01', '2026-03-01', '2026-03-31')).toBe(true);
    expect(isFechaInRange('2026-02-28', '2026-03-01', '2026-03-31')).toBe(false);
  });
});

describe('filterGastosByDateRange', () => {
  it('filtra por fechas', () => {
    const g = [
      { id: 1, fecha: '2026-01-01', monto: 1 },
      { id: 2, fecha: '2026-03-05', monto: 2 },
    ];
    expect(filterGastosByDateRange(g, '2026-03-01', '2026-03-31')).toHaveLength(1);
  });
});

describe('parseHoraToMinutes', () => {
  it('parsea AM/PM', () => {
    expect(parseHoraToMinutes('10:30 AM')).toBe(10 * 60 + 30);
    expect(parseHoraToMinutes('1:00 PM')).toBe(13 * 60);
  });
});
