import { describe, expect, it } from 'vitest';

import { additionner } from './demo.js';

describe('additionner', () => {
  it('additionne deux nombres positifs', () => {
    expect(additionner(2, 3)).toBe(5);
  });

  it('gere les nombres negatifs', () => {
    expect(additionner(-4, 1)).toBe(-3);
  });

  it('est neutre avec zero', () => {
    expect(additionner(7, 0)).toBe(7);
  });
});
