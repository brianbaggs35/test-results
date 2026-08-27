import type { TestData } from '../types';
import { testIdentityKey } from './testIdentity';

/**
 * Fingerprints the *shape* of a test run — which suites and tests exist — while
 * ignoring outcome data (status, time, timestamps, pass/fail counts) that legitimately
 * differs between two runs of the exact same suite, and that many test runs otherwise
 * share (e.g. always "12 passed, 2 failed"). Each (suite, class, test) triple uses the
 * shared testIdentityKey so two different tests that happen to share a name across
 * classes are never fingerprinted as the same identity, and so names containing
 * punctuation can't be confused with a different triple under naive string
 * concatenation (e.g. suite "A-B" + test "C" vs suite "A" + test "B-C"). The list is
 * sorted so test order doesn't matter, and real SHA-256 (Web Crypto) is used so two
 * genuinely different suites — even same-sized ones — have a negligible chance of
 * ever fingerprinting the same. Returns undefined if SubtleCrypto isn't available
 * (e.g. a non-HTTPS, non-localhost deployment); callers fall back to the looser
 * overlap check in that case.
 */
export async function computeStructureHash(data: TestData): Promise<string | undefined> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return undefined;
  const identities = data.suites
    .flatMap((suite) => suite.testcases.map((tc) => testIdentityKey(suite.name, tc.classname, tc.name)))
    .sort();
  const bytes = new TextEncoder().encode(identities.join('\n'));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
