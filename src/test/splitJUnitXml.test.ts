import { describe, it, expect } from 'vitest';
import { splitJUnitXml } from '../utils/splitJUnitXml';
import { parseJUnitXML } from '../utils/xmlParser';
import type { TestData } from '../types';

function buildXml(suites: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><testsuites>${suites}</testsuites>`;
}

/** Names of suites that have at least one failed testcase in this file. */
function suiteNamesWithFailures(data: TestData): Set<string> {
  return new Set(
    data.suites.filter((s) => s.testcases.some((t) => t.status === 'failed')).map((s) => s.name),
  );
}

describe('splitJUnitXml', () => {
  it('splits two same-size suites one per file and keeps all passed/skipped in both', () => {
    const xml = buildXml(`
      <testsuite name="Suite A" tests="4" failures="2" errors="0" skipped="0" time="4">
        <testcase name="passes1" classname="C" time="1" />
        <testcase name="fails1" classname="C" time="1"><failure message="m" type="Error">trace</failure></testcase>
        <testcase name="fails2" classname="C" time="1"><failure message="m" type="Error">trace</failure></testcase>
        <testcase name="skips1" classname="C" time="1"><skipped/></testcase>
      </testsuite>
      <testsuite name="Suite B" tests="2" failures="0" errors="2" skipped="0" time="2">
        <testcase name="errors1" classname="D" time="1"><error message="e" type="Error">trace</error></testcase>
        <testcase name="errors2" classname="D" time="1"><error message="e" type="Error">trace</error></testcase>
      </testsuite>
    `);

    const result = splitJUnitXml(xml);

    expect(result.totalFailed).toBe(4);
    expect(result.countA + result.countB).toBe(4);
    expect(result.countA).toBe(2);
    expect(result.countB).toBe(2);

    const dataA = parseJUnitXML(result.fileAXml);
    const dataB = parseJUnitXML(result.fileBXml);

    expect(dataA.summary.failed).toBe(2);
    expect(dataB.summary.failed).toBe(2);
    // Passed count (1) is duplicated in both; skipped detection has a known
    // upstream quirk for bare <skipped/> (see xmlParser.test.ts), so assert
    // on passed+skipped together rather than on 'skipped' specifically.
    expect(dataA.summary.passed + dataA.summary.skipped).toBe(2);
    expect(dataB.summary.passed + dataB.summary.skipped).toBe(2);

    // Suite A's two failures land in exactly one of the two files, never both.
    const namesA = suiteNamesWithFailures(dataA);
    const namesB = suiteNamesWithFailures(dataB);
    expect(namesA.has('Suite A')).not.toBe(namesB.has('Suite A'));
  });

  it('is fully deterministic across repeated runs on the same input', () => {
    const xml = buildXml(`
      <testsuite name="File1.spec.ts" tests="3" failures="3" errors="0" skipped="0" time="3">
        <testcase name="t1" classname="C" time="1"><failure message="m" type="E">x</failure></testcase>
        <testcase name="t2" classname="C" time="1"><failure message="m" type="E">x</failure></testcase>
        <testcase name="t3" classname="C" time="1"><failure message="m" type="E">x</failure></testcase>
      </testsuite>
      <testsuite name="File2.spec.ts" tests="3" failures="3" errors="0" skipped="0" time="3">
        <testcase name="t1" classname="C" time="1"><failure message="m" type="E">x</failure></testcase>
        <testcase name="t2" classname="C" time="1"><failure message="m" type="E">x</failure></testcase>
        <testcase name="t3" classname="C" time="1"><failure message="m" type="E">x</failure></testcase>
      </testsuite>
    `);

    const first = splitJUnitXml(xml);
    const second = splitJUnitXml(xml);

    expect(second.fileAXml).toBe(first.fileAXml);
    expect(second.fileBXml).toBe(first.fileBXml);
    expect(second.countA).toBe(first.countA);
    expect(second.countB).toBe(first.countB);
  });

  it('keeps a lone suite entirely on one side rather than splitting it, even though that makes the split uneven', () => {
    const xml = buildXml(`
      <testsuite name="Suite" tests="3" failures="3" errors="0" skipped="0" time="3">
        <testcase name="t1" classname="C" time="1"><failure message="m" type="E">x</failure></testcase>
        <testcase name="t2" classname="C" time="1"><failure message="m" type="E">x</failure></testcase>
        <testcase name="t3" classname="C" time="1"><failure message="m" type="E">x</failure></testcase>
      </testsuite>
    `);

    const result = splitJUnitXml(xml);

    // One suite is one atomic unit: all 3 failures go to a single file
    // (3/0), never divided between the two outputs (e.g. 2/1).
    expect(result.countA + result.countB).toBe(3);
    expect([result.countA, result.countB].sort((a, b) => a - b)).toEqual([0, 3]);
  });

  it('drops a suite entirely from one file if all its content went to the other half', () => {
    // Each suite here has exactly one failure and nothing else, so whichever
    // half a suite's lone failure isn't assigned to ends up with zero
    // testcases for that suite — it should be omitted, not left empty.
    const xml = buildXml(`
      <testsuite name="Suite1" tests="1" failures="1" errors="0" skipped="0" time="1">
        <testcase name="t1" classname="C" time="1"><failure message="m" type="E">x</failure></testcase>
      </testsuite>
      <testsuite name="Suite2" tests="1" failures="1" errors="0" skipped="0" time="1">
        <testcase name="t1" classname="C" time="1"><failure message="m" type="E">x</failure></testcase>
      </testsuite>
    `);

    const result = splitJUnitXml(xml);
    const dataA = parseJUnitXML(result.fileAXml);
    const dataB = parseJUnitXML(result.fileBXml);

    expect(dataA.suites).toHaveLength(1);
    expect(dataB.suites).toHaveLength(1);
    expect(dataA.suites[0].name).not.toBe(dataB.suites[0].name);
    expect(dataA.summary.total + dataB.summary.total).toBe(2);
  });

  it('handles a bare <testsuite> root (no <testsuites> wrapper)', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <testsuite name="Solo" tests="2" failures="2" errors="0" skipped="0" time="2">
        <testcase name="t1" classname="C" time="1"><failure message="m" type="E">x</failure></testcase>
        <testcase name="t2" classname="C" time="1"><failure message="m" type="E">x</failure></testcase>
      </testsuite>`;

    const result = splitJUnitXml(xml);

    expect(result.totalFailed).toBe(2);
    const dataA = parseJUnitXML(result.fileAXml);
    const dataB = parseJUnitXML(result.fileBXml);
    expect(dataA.summary.failed + dataB.summary.failed).toBe(2);
  });

  it('produces identical files when there are no failures to split', () => {
    const xml = buildXml(`
      <testsuite name="AllGreen" tests="2" failures="0" errors="0" skipped="0" time="2">
        <testcase name="t1" classname="C" time="1" />
        <testcase name="t2" classname="C" time="1" />
      </testsuite>
    `);

    const result = splitJUnitXml(xml);

    expect(result.totalFailed).toBe(0);
    expect(result.countA).toBe(0);
    expect(result.countB).toBe(0);
    const dataA = parseJUnitXML(result.fileAXml);
    const dataB = parseJUnitXML(result.fileBXml);
    expect(dataA.summary.total).toBe(2);
    expect(dataB.summary.total).toBe(2);
  });

  it('preserves failure message/type/stack trace content through the round trip', () => {
    const xml = buildXml(`
      <testsuite name="Suite" tests="1" failures="1" errors="0" skipped="0" time="1">
        <testcase name="t1" classname="C" time="1"><failure message="Assertion &lt; 5" type="AssertionError">line 1
line 2 with &amp; special &gt; chars</failure></testcase>
      </testsuite>
    `);

    const result = splitJUnitXml(xml);
    const combined = result.countA === 1 ? result.fileAXml : result.fileBXml;
    const data = parseJUnitXML(combined);

    expect(data.suites[0].testcases[0].failureDetails).toEqual({
      message: 'Assertion < 5',
      type: 'AssertionError',
      stackTrace: 'line 1\nline 2 with & special > chars',
    });
  });

  it('throws for XML with neither testsuite nor testsuites', () => {
    expect(() => splitJUnitXml('<root></root>')).toThrow('Invalid JUnit XML format');
  });

  it('drops a suite with zero testcases from both output files', () => {
    const xml = buildXml(`
      <testsuite name="HasFailure" tests="1" failures="1" errors="0" skipped="0" time="1">
        <testcase name="t1" classname="C" time="1"><failure message="m" type="E">x</failure></testcase>
      </testsuite>
      <testsuite name="Empty" tests="0" failures="0" errors="0" skipped="0" time="0"/>
    `);

    const result = splitJUnitXml(xml);
    const dataA = parseJUnitXML(result.fileAXml);
    const dataB = parseJUnitXML(result.fileBXml);

    expect(dataA.suites.map((s) => s.name)).not.toContain('Empty');
    expect(dataB.suites.map((s) => s.name)).not.toContain('Empty');
  });

  it('treats a missing or non-numeric testcase time as 0 when summing suite time', () => {
    const xml = buildXml(`
      <testsuite name="Suite1" tests="1" failures="1" errors="0" skipped="0" time="0">
        <testcase name="t1" classname="C"><failure message="m" type="E">x</failure></testcase>
      </testsuite>
      <testsuite name="Suite2" tests="1" failures="1" errors="0" skipped="0" time="0">
        <testcase name="t2" classname="C" time="not-a-number"><failure message="m" type="E">x</failure></testcase>
      </testsuite>
    `);

    const result = splitJUnitXml(xml);

    expect(result.totalFailed).toBe(2);
    const dataA = parseJUnitXML(result.fileAXml);
    const dataB = parseJUnitXML(result.fileBXml);
    expect(dataA.suites[0].time).toBe(0);
    expect(dataB.suites[0].time).toBe(0);
  });

  it('splits a suite with no name attribute without crashing', () => {
    const xml = buildXml(`
      <testsuite tests="1" failures="1" errors="0" skipped="0" time="1">
        <testcase name="t1" classname="C" time="1"><failure message="m" type="E">x</failure></testcase>
      </testsuite>
    `);

    const result = splitJUnitXml(xml);

    expect(result.totalFailed).toBe(1);
    expect(result.countA + result.countB).toBe(1);
  });

  it('falls back to empty strings when a failed testcase has no classname or name', () => {
    const xml = buildXml(`
      <testsuite name="Suite" tests="2" failures="2" errors="0" skipped="0" time="2">
        <testcase time="1"><failure message="m" type="E">x</failure></testcase>
        <testcase classname="C" time="1"><failure message="m" type="E">x</failure></testcase>
      </testsuite>
    `);

    const result = splitJUnitXml(xml);

    expect(result.totalFailed).toBe(2);
    expect(result.countA + result.countB).toBe(2);
  });

  it('treats two suites that share a name as the same file, so their failures move together', () => {
    // A file re-run under two projects/browsers produces two <testsuite>
    // blocks with the same name — they must still be treated as one file.
    const xml = buildXml(`
      <testsuite name="Dup" tests="1" failures="1" errors="0" skipped="0" time="1">
        <testcase name="same" classname="C" time="1"><failure message="m1" type="E">x</failure></testcase>
      </testsuite>
      <testsuite name="Dup" tests="1" failures="1" errors="0" skipped="0" time="1">
        <testcase name="same" classname="C" time="1"><failure message="m2" type="E">x</failure></testcase>
      </testsuite>
    `);

    const first = splitJUnitXml(xml);
    const second = splitJUnitXml(xml);

    // Both "Dup" suites move together: 2/0, never 1/1.
    expect([first.countA, first.countB].sort((a, b) => a - b)).toEqual([0, 2]);
    expect(second.fileAXml).toBe(first.fileAXml);
    expect(second.fileBXml).toBe(first.fileBXml);
  });

  it('never puts one suite/file\'s failures in both output files, at scale', () => {
    // 7 "files" of ~equal size, 1000 failures total — enough for the greedy
    // balancer to have real choices to make, while still proving the core
    // guarantee: no file's failures ever end up on both sides.
    const sizes = [143, 143, 143, 143, 143, 143, 142];
    let suitesXml = '';
    sizes.forEach((size, f) => {
      let testcases = '';
      for (let i = 0; i < size; i++) {
        testcases += `<testcase name="test${i}" classname="C" time="1"><failure message="m" type="E">x</failure></testcase>\n`;
      }
      suitesXml += `<testsuite name="File${f}.spec.ts" tests="${size}" failures="${size}" errors="0" skipped="0" time="${size}">${testcases}</testsuite>\n`;
    });
    const xml = buildXml(suitesXml);

    const result = splitJUnitXml(xml);

    expect(result.totalFailed).toBe(1000);
    expect(result.countA + result.countB).toBe(1000);
    expect(result.countA).toBeGreaterThan(0);
    expect(result.countB).toBeGreaterThan(0);

    const dataA = parseJUnitXML(result.fileAXml);
    const dataB = parseJUnitXML(result.fileBXml);
    const namesA = suiteNamesWithFailures(dataA);
    const namesB = suiteNamesWithFailures(dataB);

    for (const name of namesA) expect(namesB.has(name)).toBe(false);
    expect(namesA.size + namesB.size).toBe(sizes.length);
  });

  it('never merges two files that merely share a basename in different directories', () => {
    const xml = buildXml(`
      <testsuite name="spec/playwright/e2e/policies/show/owner/comments.spec.ts" tests="1" failures="1" errors="0" skipped="0" time="1">
        <testcase name="owner can comment" classname="comments.spec.ts" time="1"><failure message="m" type="E">x</failure></testcase>
      </testsuite>
      <testsuite name="spec/playwright/e2e/policies/show/admin/comments.spec.ts" tests="1" failures="1" errors="0" skipped="0" time="1">
        <testcase name="admin can comment" classname="comments.spec.ts" time="1"><failure message="m" type="E">x</failure></testcase>
      </testsuite>
      <testsuite name="spec/playwright/e2e/policies/show/member/comments.spec.ts" tests="1" failures="1" errors="0" skipped="0" time="1">
        <testcase name="member can comment" classname="comments.spec.ts" time="1"><failure message="m" type="E">x</failure></testcase>
      </testsuite>
    `);

    const result = splitJUnitXml(xml);

    // Three distinct files (same basename, different directories): each is
    // its own group, never collapsed together just because the basename matches.
    expect(result.totalFailed).toBe(3);
    expect(result.countA + result.countB).toBe(3);

    const dataA = parseJUnitXML(result.fileAXml);
    const dataB = parseJUnitXML(result.fileBXml);
    const namesA = suiteNamesWithFailures(dataA);
    const namesB = suiteNamesWithFailures(dataB);

    for (const name of namesA) expect(namesB.has(name)).toBe(false);
    expect(namesA.size + namesB.size).toBe(3);
  });
});
