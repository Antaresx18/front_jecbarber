import { describe, it, expect } from 'vitest';
import { parsePrecio, parseComisionPercent, isValidEmail } from './validations';

describe('parsePrecio', () => {
  it('acepta decimales con coma', () => {
    expect(parsePrecio('12,5')).toEqual({ ok: true, value: 12.5 });
  });
  it('rechaza negativos', () => {
    expect(parsePrecio('-1').ok).toBe(false);
  });
});

describe('parseComisionPercent', () => {
  it('acepta 0 y 100', () => {
    expect(parseComisionPercent('0').ok).toBe(true);
    expect(parseComisionPercent('100').ok).toBe(true);
  });
  it('rechaza 101', () => {
    expect(parseComisionPercent('101').ok).toBe(false);
  });
});

describe('isValidEmail', () => {
  it('valida formato básico', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('no')).toBe(false);
  });
});
