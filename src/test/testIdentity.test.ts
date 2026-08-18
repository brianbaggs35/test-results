import { describe, it, expect } from 'vitest';
import { testIdentityKey } from '../utils/testIdentity';

describe('testIdentityKey', () => {
  it('produces different keys for the same test name under different classnames', () => {
    const a = testIdentityKey('Suite', 'ClassA', 'test1');
    const b = testIdentityKey('Suite', 'ClassB', 'test1');
    expect(a).not.toBe(b);
  });

  it('produces the same key for the same suite/classname/name every time', () => {
    const a = testIdentityKey('Suite', 'Class', 'test1');
    const b = testIdentityKey('Suite', 'Class', 'test1');
    expect(a).toBe(b);
  });

  it('treats an undefined classname consistently as empty string', () => {
    const a = testIdentityKey('Suite', undefined, 'test1');
    const b = testIdentityKey('Suite', '', 'test1');
    expect(a).toBe(b);
  });

  it('does not collide across field boundaries the way naive concatenation would', () => {
    // Under `${suite}-${classname}-${name}`, suite="A-B" classname="C" and
    // suite="A" classname="B-C" would both produce "A-B-C-<name>".
    const a = testIdentityKey('A-B', 'C', 'D');
    const b = testIdentityKey('A', 'B-C', 'D');
    expect(a).not.toBe(b);
  });

  it('does not collide when a name contains a space, unlike a space-joined scheme', () => {
    // Under `${suite} ${classname} ${name}`, suite="A B" classname="C" name="D"
    // and suite="A" classname="B C" name="D" would both produce "A B C D".
    const a = testIdentityKey('A B', 'C', 'D');
    const b = testIdentityKey('A', 'B C', 'D');
    expect(a).not.toBe(b);
  });
});
