import type { TestData } from '../types';
import { testIdentityKey } from './testIdentity';

function isSubtleCryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

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
 *
 * Because it ignores outcomes, this can't tell two runs of the same suite apart — that
 * is what makes it right for validating a progress import, and wrong for deciding
 * whether stored progress still belongs to the loaded file (see computeResultsHash).
 */
export async function computeStructureHash(data: TestData): Promise<string | undefined> {
  if (!isSubtleCryptoAvailable()) return undefined;
  const identities = data.suites
    .flatMap((suite) => suite.testcases.map((tc) => testIdentityKey(suite.name, tc.classname, tc.name)))
    .sort();
  return sha256Hex(identities.join('\n'));
}

/**
 * Fingerprints what a results file actually *reports*, so loading the same file again can be
 * told apart from loading a different one — including a fresh run of the very same suite,
 * which computeStructureHash deliberately can't do. Each test contributes its identity
 * (testIdentityKey) together with its outcome, duration and failure output; the list is
 * sorted so test order doesn't matter.
 *
 * Suite-level fields are left out on purpose: `tests`/`failures`/`time` are aggregates that
 * Split and Combine recompute without touching any test (so a combined result still
 * fingerprints the same as the XML it was split from), and `timestamp` is stamped with "now"
 * by the parser when the XML has none, which would make the very same file hash differently
 * on every load.
 *
 * Returns undefined if SubtleCrypto isn't available, like computeStructureHash.
 */
export async function computeResultsHash(data: TestData): Promise<string | undefined> {
  if (!isSubtleCryptoAvailable()) return undefined;
  const lines = data.suites
    .flatMap((suite) =>
      suite.testcases.map((tc) =>
        JSON.stringify([
          testIdentityKey(suite.name, tc.classname, tc.name),
          tc.status,
          tc.time,
          tc.errorMessage ?? null,
          tc.failureDetails ? [tc.failureDetails.message, tc.failureDetails.type, tc.failureDetails.stackTrace] : null,
        ]),
      ),
    )
    .sort();
  return sha256Hex(lines.join('\n'));
}
