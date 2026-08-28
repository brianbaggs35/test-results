import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { FLAKY_GUARD_MAX_RATIO, isFlakyCandidateTestcase } from './xmlParser';

// Matches src/utils/xmlParser.js's reader options exactly, so a testcase
// carried through unchanged parses back to the identical shape.
const PARSER_OPTIONS = { ignoreAttributes: false, attributeNamePrefix: '' };

type XmlNode = Record<string, unknown>;

function toArray(value: unknown): XmlNode[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? (value as XmlNode[]) : [value as XmlNode];
}

/** A testcase counts as a failure to split on if it has a <failure> or <error> child — the same rule the app's own parser uses to derive status: 'failed'. */
function isFailedTestcase(tc: XmlNode): boolean {
  return tc.failure !== undefined || tc.error !== undefined;
}

type Kind = 'failure' | 'error' | 'skipped' | 'passed';

function classify(tc: XmlNode): Kind {
  if (tc.failure !== undefined) return 'failure';
  if (tc.error !== undefined) return 'error';
  if (tc.skipped !== undefined) return 'skipped';
  return 'passed';
}

function timeOf(node: XmlNode): number {
  const n = parseFloat(String(node.time ?? '0'));
  return Number.isFinite(n) ? n : 0;
}

export interface SplitResult {
  fileAXml: string;
  fileBXml: string;
  // Failed/errored testcases, plus flaky ones the guard trusts (see isFlakyCandidateTestcase) —
  // everything that was actually split rather than duplicated in both halves.
  totalFailed: number;
  countA: number;
  countB: number;
}

/**
 * Deterministically divides a JUnit XML report's failed/errored/flaky testcases
 * across two new, independently-valid JUnit XML documents — every passed
 * and skipped testcase is kept in both. Splittable testcases are grouped by their
 * enclosing <testsuite> name — JUnit XML's closest equivalent to "source
 * file" (reporters like Playwright's put the full relative path there, e.g.
 * "policies/show/owner/comments.spec.ts", so two files that merely share a
 * basename in different directories are never confused for each other) —
 * and each group moves to a file as a whole, so two people acting on file A
 * and file B can never end up working on tests from the same suite. Suites
 * that share a name exactly (e.g. the same spec re-run under two
 * projects/browsers) are treated as one group for this purpose. Groups are
 * handed out largest-first to whichever file currently has fewer assigned
 * failures — a stable sort with no randomness or timestamps — so the two
 * files won't always come out equal in size, but running the split on the
 * same input always produces byte-identical output.
 */
export function splitJUnitXml(xmlContent: string): SplitResult {
  const parser = new XMLParser(PARSER_OPTIONS);
  const parsed = parser.parse(xmlContent) as { testsuites?: XmlNode; testsuite?: unknown };

  let rootAttrs: XmlNode = {};
  let suites: XmlNode[];
  if (parsed.testsuites) {
    const { testsuite, ...attrs } = parsed.testsuites;
    rootAttrs = attrs;
    suites = toArray(testsuite);
  } else if (parsed.testsuite) {
    suites = toArray(parsed.testsuite);
  } else {
    throw new Error('Invalid JUnit XML format');
  }

  // A flaky testcase (see xmlParser.ts's isFlakyCandidateTestcase) needs the exact
  // same plausibility guard xmlParser.ts applies before it's trusted — otherwise a
  // project whose Playwright config captures video/trace unconditionally would have
  // this file split nearly every "passed" testcase instead of duplicating it.
  // Computed once, globally, before deciding what counts as splittable.
  let flakyCandidateCount = 0;
  let nonFailedCount = 0;
  suites.forEach((suite) => {
    toArray(suite.testcase).forEach((tc) => {
      if (isFailedTestcase(tc)) return;
      if (tc.skipped !== undefined) return;
      nonFailedCount++;
      if (isFlakyCandidateTestcase(tc)) flakyCandidateCount++;
    });
  });
  const flakyGuardTripped = (nonFailedCount > 0 ? flakyCandidateCount / nonFailedCount : 1) > FLAKY_GUARD_MAX_RATIO;

  // A testcase must move to exactly one half — never duplicated in both, the way an
  // ordinary passed/skipped testcase is — when it's a real failure/error, or (guard
  // permitting) flaky: something a person needs to look into, not just informational
  // context. Two teammates must never end up independently investigating, or
  // resolving on the Progress tab, the very same flaky test.
  const needsSplitting = (tc: XmlNode): boolean =>
    isFailedTestcase(tc) || (!flakyGuardTripped && isFlakyCandidateTestcase(tc));

  // Group every splittable testcase by its enclosing suite's exact name — the unit
  // two people must never split between them. A suite with no name falls back to its
  // own index so nameless suites never collide with one another (never treated as
  // the same file just because both happen to be nameless).
  const groups = new Map<string, Array<{ suiteIndex: number; testcaseIndex: number }>>();
  let totalFailed = 0;
  suites.forEach((suite, suiteIndex) => {
    const rawName = suite.name;
    const groupKey = rawName !== undefined && String(rawName) !== '' ? `n:${String(rawName)}` : `i:${suiteIndex}`;
    toArray(suite.testcase).forEach((tc, testcaseIndex) => {
      if (!needsSplitting(tc)) return;
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey)!.push({ suiteIndex, testcaseIndex });
      totalFailed++;
    });
  });

  // Largest group first; ties broken lexicographically by key so ordering
  // never depends on Map iteration order.
  const sortedGroups = [...groups.entries()].sort(([keyA, refsA], [keyB, refsB]) => {
    if (refsB.length !== refsA.length) return refsB.length - refsA.length;
    return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
  });

  // Greedy longest-processing-time-first bin packing: each group goes whole
  // to whichever side currently has fewer failures, so one side can end up
  // larger when group sizes don't divide evenly — but never a partial
  // group.
  const assignedToA = new Set<string>();
  let totalA = 0;
  let totalB = 0;
  sortedGroups.forEach(([, refs]) => {
    if (totalA <= totalB) {
      refs.forEach((ref) => assignedToA.add(`${ref.suiteIndex}:${ref.testcaseIndex}`));
      totalA += refs.length;
    } else {
      totalB += refs.length;
    }
  });

  const buildVariant = (keepFailed: (suiteIndex: number, testcaseIndex: number) => boolean) => {
    let count = 0;
    const outSuites: XmlNode[] = [];

    suites.forEach((suite, suiteIndex) => {
      const kept = toArray(suite.testcase).filter((tc, testcaseIndex) => {
        if (!needsSplitting(tc)) return true;
        const keep = keepFailed(suiteIndex, testcaseIndex);
        if (keep) count++;
        return keep;
      });
      // Drop suites left with nothing in them for this half.
      if (kept.length === 0) return;

      let failures = 0;
      let errors = 0;
      let skipped = 0;
      let time = 0;
      kept.forEach((tc) => {
        const kind = classify(tc);
        if (kind === 'failure') failures++;
        else if (kind === 'error') errors++;
        else if (kind === 'skipped') skipped++;
        time += timeOf(tc);
      });

      const omit = new Set(['testcase', 'tests', 'failures', 'errors', 'skipped', 'time']);
      const restAttrs = Object.fromEntries(Object.entries(suite).filter(([k]) => !omit.has(k)));
      outSuites.push({
        ...restAttrs,
        tests: String(kept.length),
        failures: String(failures),
        errors: String(errors),
        skipped: String(skipped),
        time: time.toFixed(3),
        testcase: kept.length === 1 ? kept[0] : kept,
      });
    });

    const sum = (field: string) => outSuites.reduce((total, s) => total + Number(s[field]), 0);
    const builder = new XMLBuilder({ ignoreAttributes: false, attributeNamePrefix: '', format: true });
    const xml = builder.build({
      testsuites: {
        ...rootAttrs,
        tests: String(sum('tests')),
        failures: String(sum('failures')),
        errors: String(sum('errors')),
        skipped: String(sum('skipped')),
        time: sum('time').toFixed(3),
        ...(outSuites.length > 0 ? { testsuite: outSuites.length === 1 ? outSuites[0] : outSuites } : {}),
      },
    });
    return { xml, count };
  };

  const a = buildVariant((si, ti) => assignedToA.has(`${si}:${ti}`));
  const b = buildVariant((si, ti) => !assignedToA.has(`${si}:${ti}`));

  return {
    fileAXml: a.xml,
    fileBXml: b.xml,
    totalFailed,
    countA: a.count,
    countB: b.count,
  };
}
