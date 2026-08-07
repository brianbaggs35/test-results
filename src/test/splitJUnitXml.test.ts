import { describe, it, expect } from 'vitest';
import { splitJUnitXml } from '../utils/splitJUnitXml';
import { parseJUnitXML } from '../utils/xmlParser';

function buildXml(suites: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><testsuites>${suites}</testsuites>`;
}

describe('splitJUnitXml', () => {
  it('splits failed tests roughly in half and keeps all passed/skipped in both files', () => {
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
  });

  it('is fully deterministic across repeated runs on the same input', () => {
    const xml = buildXml(`
      <testsuite name="Suite" tests="6" failures="6" errors="0" skipped="0" time="6">
        <testcase name="t1" classname="C" time="1"><failure message="m" type="E">x</failure></testcase>
        <testcase name="t2" classname="C" time="1"><failure message="m" type="E">x</failure></testcase>
        <testcase name="t3" classname="C" time="1"><failure message="m" type="E">x</failure></testcase>
        <testcase name="t4" classname="C" time="1"><failure message="m" type="E">x</failure></testcase>
        <testcase name="t5" classname="C" time="1"><failure message="m" type="E">x</failure></testcase>
        <testcase name="t6" classname="C" time="1"><failure message="m" type="E">x</failure></testcase>
      </testsuite>
    `);

    const first = splitJUnitXml(xml);
    const second = splitJUnitXml(xml);

    expect(second.fileAXml).toBe(first.fileAXml);
    expect(second.fileBXml).toBe(first.fileBXml);
    expect(second.countA).toBe(first.countA);
    expect(second.countB).toBe(first.countB);
  });

  it('handles an odd number of failures by splitting as evenly as possible', () => {
    const xml = buildXml(`
      <testsuite name="Suite" tests="3" failures="3" errors="0" skipped="0" time="3">
        <testcase name="t1" classname="C" time="1"><failure message="m" type="E">x</failure></testcase>
        <testcase name="t2" classname="C" time="1"><failure message="m" type="E">x</failure></testcase>
        <testcase name="t3" classname="C" time="1"><failure message="m" type="E">x</failure></testcase>
      </testsuite>
    `);

    const result = splitJUnitXml(xml);

    expect(result.countA + result.countB).toBe(3);
    expect(Math.abs(result.countA - result.countB)).toBe(1);
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
});
