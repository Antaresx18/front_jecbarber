import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadGastosCsv } from './exportCsv';

describe('downloadGastosCsv', () => {
  beforeEach(() => {
    vi.spyOn(document.body, 'appendChild').mockImplementation((el) => el);
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('genera blob y dispara descarga sin lanzar', () => {
    const orig = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = orig(tag);
      if (tag === 'a') {
        el.click = vi.fn();
      }
      return el;
    });
    expect(() =>
      downloadGastosCsv([
        { id: 1, concepto: 'X', monto: 1, categoria: 'Fijo', fecha: '2026-01-01' },
      ])
    ).not.toThrow();
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
});
