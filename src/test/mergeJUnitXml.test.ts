import { describe, it, expect } from 'vitest';
import { mergeJUnitXml } from '../utils/mergeJUnitXml';
import { parseJUnitXML } from '../utils/xmlParser';
import type { JUnitXmlFile } from '../utils/mergeJUnitXml';

function file(name: string, suites: string, rootAttrs = 'id="" name=""'): JUnitXmlFile {
  return {
    name,
    xml: `<?xml version="1.0" encoding="UTF-8"?><testsuites ${rootAttrs}>${suites}</testsuites>`,
  };
}

describe('mergeJUnitXml', () => {
  it('concatenates every suite from every file under one <testsuites> root', () => {
    const shard1 = file(
      'shard-1.xml',
      `<testsuite name="login.spec.ts" tests="2" failures="1" errors="0" skipped="0" time="1.5">
        <testcase name="logs in" classname="login.spec.ts" time="0.8" />
        <testcase name="rejects bad password" classname="login.spec.ts" time="0.7"><failure message="m" type="E">x</failure></testcase>
      </testsuite>`
    );
    const shard2 = file(
      'shard-2.xml',
      `<testsuite name="theme.spec.ts" tests="1" failures="0" errors="0" skipped="0" time="0.6">
        <testcase name="switches theme" classname="theme.spec.ts" time="0.6" />
      </testsuite>`
    );

    const result = mergeJUnitXml([shard1, shard2]);

    expect(result.fileCount).toBe(2);
    expect(result.suiteCount).toBe(2);
    expect(result.warnings).toEqual([]);

    const data = parseJUnitXML(result.xml);
    expect(data.suites.map((s) => s.name).sort()).toEqual(['login.spec.ts', 'theme.spec.ts']);
    expect(data.summary.total).toBe(3);
    expect(data.summary.failed).toBe(1);
  });

  it('recomputes root-level totals as a sum rather than trusting any one file', () => {
    const shard1 = file('a.xml', `<testsuite name="A" tests="2" failures="1" errors="0" skipped="0" time="1.0" />`);
    const shard2 = file('b.xml', `<testsuite name="B" tests="3" failures="0" errors="1" skipped="1" time="2.5" />`);

    const result = mergeJUnitXml([shard1, shard2]);

    expect(result.xml).toContain('tests="5"');
    expect(result.xml).toContain('failures="1"');
    expect(result.xml).toContain('errors="1"');
    expect(result.xml).toContain('skipped="1"');
    expect(result.xml).toContain('time="3.500"');
  });

  it('preserves non-recomputed root attributes (e.g. id/name) from the first file that has a <testsuites> wrapper', () => {
    const shard1 = file('a.xml', `<testsuite name="A" tests="1" failures="0" errors="0" skipped="0" time="1" />`, 'id="" name=""');
    const shard2 = file('b.xml', `<testsuite name="B" tests="1" failures="0" errors="0" skipped="0" time="1" />`, 'id="other" name="other"');

    const result = mergeJUnitXml([shard1, shard2]);

    expect(result.xml).toContain('name=""');
  });

  it('handles a bare <testsuite> root (no <testsuites> wrapper) mixed with a wrapped file', () => {
    const bare: JUnitXmlFile = {
      name: 'solo.xml',
      xml: `<?xml version="1.0" encoding="UTF-8"?><testsuite name="Solo" tests="1" failures="0" errors="0" skipped="0" time="1"><testcase name="t1" classname="C" time="1" /></testsuite>`,
    };
    const wrapped = file('wrapped.xml', `<testsuite name="Wrapped" tests="1" failures="1" errors="0" skipped="0" time="1"><testcase name="t1" classname="C" time="1"><failure message="m" type="E">x</failure></testcase></testsuite>`);

    const result = mergeJUnitXml([bare, wrapped]);

    expect(result.suiteCount).toBe(2);
    const data = parseJUnitXML(result.xml);
    expect(data.suites.map((s) => s.name).sort()).toEqual(['Solo', 'Wrapped']);
    expect(data.summary.total).toBe(2);
    expect(data.summary.failed).toBe(1);
  });

  it('supports combining more than two shards at once', () => {
    const shards = [1, 2, 3, 4].map((n) =>
      file(`shard-${n}.xml`, `<testsuite name="Suite${n}" tests="1" failures="0" errors="0" skipped="0" time="1" />`)
    );

    const result = mergeJUnitXml(shards);

    expect(result.fileCount).toBe(4);
    expect(result.suiteCount).toBe(4);
    expect(result.xml).toContain('tests="4"');
  });

  it('preserves failure message/type/stack trace content through the round trip', () => {
    const shard = file(
      'a.xml',
      `<testsuite name="Suite" tests="1" failures="1" errors="0" skipped="0" time="1">
        <testcase name="t1" classname="C" time="1"><failure message="Assertion &lt; 5" type="AssertionError">line 1
line 2 with &amp; special &gt; chars</failure></testcase>
      </testsuite>`
    );
    const other = file('b.xml', `<testsuite name="Other" tests="1" failures="0" errors="0" skipped="0" time="1" />`);

    const result = mergeJUnitXml([shard, other]);
    const data = parseJUnitXML(result.xml);
    const suite = data.suites.find((s) => s.name === 'Suite')!;

    expect(suite.testcases[0].failureDetails).toEqual({
      message: 'Assertion < 5',
      type: 'AssertionError',
      stackTrace: 'line 1\nline 2 with & special > chars',
    });
  });

  it('is fully deterministic across repeated runs on the same input', () => {
    const shards = [
      file('a.xml', `<testsuite name="A" tests="1" failures="0" errors="0" skipped="0" time="1" />`),
      file('b.xml', `<testsuite name="B" tests="1" failures="0" errors="0" skipped="0" time="1" />`),
    ];

    const first = mergeJUnitXml(shards);
    const second = mergeJUnitXml(shards);

    expect(second.xml).toBe(first.xml);
  });

  it('throws, naming the offending file, for XML with neither testsuite nor testsuites', () => {
    const bad: JUnitXmlFile = { name: 'bogus.xml', xml: '<root></root>' };
    const good = file('a.xml', `<testsuite name="A" tests="1" failures="0" errors="0" skipped="0" time="1" />`);

    expect(() => mergeJUnitXml([good, bad])).toThrow('"bogus.xml": Invalid JUnit XML format');
  });

  it('throws when given no files', () => {
    expect(() => mergeJUnitXml([])).toThrow('No files to combine.');
  });

  it('warns when two files are byte-for-byte identical', () => {
    const shard = file('a.xml', `<testsuite name="A" tests="1" failures="0" errors="0" skipped="0" time="1" />`);
    const duplicate: JUnitXmlFile = { name: 'a-copy.xml', xml: shard.xml };

    const result = mergeJUnitXml([shard, duplicate]);

    expect(result.warnings).toContainEqual(expect.stringMatching(/byte-for-byte identical/));
    expect(result.warnings.some((w) => w.includes('a.xml') && w.includes('a-copy.xml'))).toBe(true);
  });

  it('warns when the same suite name appears in more than one file, naming every file it came from', () => {
    const shard1 = file('shard-1.xml', `<testsuite name="flaky.spec.ts" tests="1" failures="0" errors="0" skipped="0" time="1" />`);
    const shard2 = file('shard-2.xml', `<testsuite name="flaky.spec.ts" tests="1" failures="1" errors="0" skipped="0" time="1" />`);

    const result = mergeJUnitXml([shard1, shard2]);

    expect(result.warnings).toContainEqual(
      expect.stringMatching(/Suite "flaky\.spec\.ts" appears in more than one file \(shard-1\.xml, shard-2\.xml\)/)
    );
    // Still keeps both — a warning, not a drop.
    expect(result.suiteCount).toBe(2);
  });

  it('does not warn when the same suite name appears twice within a single file (e.g. multi-project runs)', () => {
    const shard1 = file(
      'shard-1.xml',
      `<testsuite name="Dup" tests="1" failures="0" errors="0" skipped="0" time="1" /><testsuite name="Dup" tests="1" failures="0" errors="0" skipped="0" time="1" />`
    );
    const shard2 = file('shard-2.xml', `<testsuite name="Other" tests="1" failures="0" errors="0" skipped="0" time="1" />`);

    const result = mergeJUnitXml([shard1, shard2]);

    expect(result.warnings).toEqual([]);
    expect(result.suiteCount).toBe(3);
  });

  it('does not track an unnamed suite for overlap warnings', () => {
    const shard1 = file('a.xml', `<testsuite tests="1" failures="0" errors="0" skipped="0" time="1" />`);
    const shard2 = file('b.xml', `<testsuite tests="2" failures="0" errors="0" skipped="0" time="2" />`);

    const result = mergeJUnitXml([shard1, shard2]);

    expect(result.warnings).toEqual([]);
  });

  it('deduplicates an exact-duplicate suite across files, keeping only one copy', () => {
    // Regression test: a suite that's byte-for-byte identical in two files used to be
    // kept twice, inflating summary.total/failed above what the Progress tab (which
    // dedupes failing tests by identity) would show for the very same merged result.
    const shared = `<testsuite name="Shared" tests="2" failures="1" errors="0" skipped="0" time="1.5">
      <testcase name="t1" classname="C" time="1" />
      <testcase name="t2" classname="C" time="0.5"><failure message="m" type="E">x</failure></testcase>
    </testsuite>`;
    const shard1 = file('shard-1.xml', `${shared}<testsuite name="Only1" tests="1" failures="0" errors="0" skipped="0" time="1" />`);
    const shard2 = file('shard-2.xml', `${shared}<testsuite name="Only2" tests="1" failures="0" errors="0" skipped="0" time="1" />`);

    const result = mergeJUnitXml([shard1, shard2]);

    expect(result.suiteCount).toBe(3);
    expect(result.warnings).toContainEqual(
      expect.stringMatching(/Suite "Shared" was identical.*counted once, not 2 times/)
    );
    const data = parseJUnitXML(result.xml);
    expect(data.summary.total).toBe(4);
    expect(data.summary.failed).toBe(1);
  });

  it('suppresses the per-suite warning when a duplicate is already explained by a whole-file-identical warning', () => {
    const shard = file('a.xml', `<testsuite name="Solo" tests="1" failures="0" errors="0" skipped="0" time="1" />`);
    const duplicate: JUnitXmlFile = { name: 'a.xml', xml: shard.xml };

    const result = mergeJUnitXml([shard, duplicate]);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/byte-for-byte identical/);
    expect(result.suiteCount).toBe(1);
  });

  it('uses "uploaded N times" wording when duplicate files share a name but aren\'t fully identical', () => {
    const shared = `<testsuite name="Shared" tests="1" failures="0" errors="0" skipped="0" time="1" />`;
    const shard1 = file('results.xml', `${shared}<testsuite name="Extra1" tests="1" failures="0" errors="0" skipped="0" time="1" />`);
    const shard2 = file('results.xml', `${shared}<testsuite name="Extra2" tests="1" failures="0" errors="0" skipped="0" time="1" />`);

    const result = mergeJUnitXml([shard1, shard2]);

    expect(result.warnings).toContainEqual(expect.stringMatching(/uploaded 2 times as "results\.xml"/));
    expect(result.suiteCount).toBe(3);
  });

  it('keeps every copy and warns when a same-named suite genuinely differs between files, even if duplicated 3+ times', () => {
    const shard1 = file('a.xml', `<testsuite name="Flaky" tests="1" failures="0" errors="0" skipped="0" time="1" />`);
    const shard2 = file('b.xml', `<testsuite name="Flaky" tests="1" failures="1" errors="0" skipped="0" time="1" />`);
    const shard3 = file('c.xml', `<testsuite name="Flaky" tests="1" failures="0" errors="1" skipped="0" time="1" />`);

    const result = mergeJUnitXml([shard1, shard2, shard3]);

    expect(result.suiteCount).toBe(3);
    expect(result.warnings).toContainEqual(expect.stringMatching(/Suite "Flaky" appears in more than one file \(a\.xml, b\.xml, c\.xml\) with different contents/));
  });

  it('produces a single (non-array) testsuite element when only one suite exists in total', () => {
    const only = file('a.xml', `<testsuite name="Solo" tests="1" failures="0" errors="0" skipped="0" time="1" />`);

    const result = mergeJUnitXml([only]);

    expect(result.suiteCount).toBe(1);
    expect(result.fileCount).toBe(1);
    const data = parseJUnitXML(result.xml);
    expect(data.suites).toHaveLength(1);
  });

  it('treats a missing or non-numeric suite attribute as 0 when summing totals', () => {
    const shard1 = file('a.xml', `<testsuite name="A" tests="1" failures="0" errors="0" skipped="0" time="not-a-number" />`);
    const shard2 = file('b.xml', `<testsuite name="B" failures="0" errors="0" skipped="0" time="2.5" />`);

    const result = mergeJUnitXml([shard1, shard2]);

    // A's time is non-numeric (treated as 0) and B has no tests attribute at
    // all (also treated as 0) — neither should make the sum NaN.
    expect(result.xml).toContain('tests="1"');
    expect(result.xml).toContain('time="2.500"');
  });

  it('handles a <testsuites> wrapper with no <testsuite> children at all', () => {
    const empty = file('empty.xml', '');
    const withSuite = file('a.xml', `<testsuite name="A" tests="1" failures="0" errors="0" skipped="0" time="1" />`);

    const result = mergeJUnitXml([empty, withSuite]);

    expect(result.fileCount).toBe(2);
    expect(result.suiteCount).toBe(1);
    const data = parseJUnitXML(result.xml);
    expect(data.suites.map((s) => s.name)).toEqual(['A']);
  });

  it('omits the <testsuite> element entirely when every file has zero suites', () => {
    const empty1 = file('a.xml', '');
    const empty2 = file('b.xml', '');

    const result = mergeJUnitXml([empty1, empty2]);

    expect(result.suiteCount).toBe(0);
    expect(result.xml).toContain('tests="0"');
    expect(parseJUnitXML(result.xml).suites).toEqual([]);
  });
});
