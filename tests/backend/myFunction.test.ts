import { describe, it, expect } from 'vitest';
import { myFunction } from '../src/myFunction';

describe('myFunction', () => {
  it('should return true for even numbers', () => {
    expect(myFunction(2)).toBe(true);
  });

  it('should return false for odd numbers', () => {
    expect(myFunction(3)).toBe(false);
  });
});