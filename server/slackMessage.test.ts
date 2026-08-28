import { describe, it, expect } from 'vitest';
import { buildSlackMessage } from './slackMessage';
import type { SlackTestData } from './slackMessage';

interface TestableBlock {
  type: string;
  text?: { type: string; text: string };
  fields?: { type: string; text: string }[];
  elements?: { type: string; text: string }[];
  image_url?: string;
  alt_text?: string;
}

function getBlocks(message: ReturnType<typeof buildSlackMessage>): TestableBlock[] {
  return message.attachments![0].blocks as unknown as TestableBlock[];
}

// The chart image URL's `c` param is a JS-object-literal-like string (from
// quickchart-js's own serializer — single-quoted, unquoted keys), not
// strict JSON, so it can't be JSON.parse()'d. Extract each dataset's single
// value directly instead — the bar chart has one dataset per segment
// (Passed/Failed/Skipped, in that order), each holding a one-element array.
function getChartDataValues(imageUrl: string): number[] {
  // URLSearchParams.get() already returns the decoded value.
  const configStr = new URL(imageUrl).searchParams.get('c')!;
  return [...configStr.matchAll(/data:\[([\d.]+)\]/g)].map(m => Number(m[1]));
}

describe('buildSlackMessage', () => {
  it('omits the seconds part of the duration when it lands on an exact minute', () => {
    const testData: SlackTestData = {
      summary: { total: 1, passed: 1, failed: 0, skipped: 0, time: 120 },
      suites: [{ name: 'Suite A', tests: 1, failures: 0, errors: 0, skipped: 0, time: 120 }],
    };

    const message = buildSlackMessage(testData, { title: 'Run', metadata: [] });

    const blocks = getBlocks(message);
    const summarySection = blocks.find(b => b.fields?.[0]?.text.startsWith('*Results:*'));
    expect(summarySection?.fields?.[1].text).toBe('*Duration:*\n2m');
  });

  it('uses a green attachment, no failure blocks, and a chart image when everything passed', () => {
    const testData: SlackTestData = {
      summary: { total: 5, passed: 5, failed: 0, skipped: 0, time: 65 },
      suites: [{ name: 'Suite A', tests: 5, failures: 0, errors: 0, skipped: 0, time: 65 }],
    };

    const message = buildSlackMessage(testData, { title: 'Nightly', metadata: [] });

    expect(message.attachments![0].color).toBe('good');
    const blocks = getBlocks(message);
    expect(blocks.find(b => b.type === 'header')?.text?.text).toBe('Nightly');
    const summarySection = blocks.find(b => b.type === 'section' && b.fields);
    expect(summarySection?.fields?.[0].text).toBe('*Results:*\n5 / 5 Passed (100.00%)');
    expect(summarySection?.fields?.[1].text).toBe('*Duration:*\n1m 5s');
    expect(blocks.some(b => b.type === 'divider')).toBe(false);
    expect(message.text).toBe('Automated Testing Results: 5 / 5 passed (100.00%)');

    // The chart renders as its own full-width image block (not a section
    // accessory, which Slack shrinks to a small, hard-to-read thumbnail),
    // placed right after the summary section.
    const chartBlock = blocks.find(b => b.type === 'image');
    expect(chartBlock?.image_url).toMatch(/^https:\/\/quickchart\.io\/chart\?/);
    expect(chartBlock?.alt_text).toBe('100.00% passed');
    const summaryIndex = blocks.indexOf(summarySection!);
    const chartIndex = blocks.findIndex(b => b.type === 'image');
    expect(chartIndex).toBe(summaryIndex + 1);
  });

  it('boosts tiny non-zero slices to a minimum visible share of the chart, without altering the displayed counts', () => {
    // A real reported case: 3 failed / 13 skipped out of 3738 is under a
    // pixel wide at true proportions — invisible in the rendered chart.
    const testData: SlackTestData = {
      summary: { total: 3738, passed: 3722, failed: 3, skipped: 13, time: 100 },
      suites: [],
    };

    const message = buildSlackMessage(testData, { title: 'Run', metadata: [] });
    const blocks = getBlocks(message);
    const chartBlock = blocks.find(b => b.type === 'image')!;

    expect(chartBlock.image_url).toContain('indexAxis%3A%27y%27');

    // Matches MIN_SLICE_VISUAL_PIXELS / CHART_WIDTH in slackMessage.ts.
    const MIN_SHARE = 2 / 320;
    const [passedShare, failedShare, skippedShare] = getChartDataValues(chartBlock.image_url!);
    // Both minority segments are true-tiny (well under the floor), so both
    // get lifted to exactly the floor.
    expect(failedShare).toBeCloseTo(MIN_SHARE, 5);
    expect(skippedShare).toBeCloseTo(MIN_SHARE, 5);
    // Passed is far above the floor, so it's left at its exact true
    // proportion — nothing is manually stolen from it; Chart.js's own
    // normalization is what makes room for the lifted segments at render
    // time (see toVisualShares).
    expect(passedShare).toBeCloseTo(3722 / 3738, 5);

    // The boost never touches what's actually displayed as text. (13
    // skipped are excluded from the denominator, so it's 3738 - 13 = 3725,
    // not the raw total.)
    const summarySection = blocks.find(b => b.type === 'section' && b.fields);
    expect(summarySection?.fields?.[0].text).toContain('3722 / 3725 Passed');
  });

  it('excludes skipped tests from the overall pass ratio and percentage (a skip is neither a pass nor a fail)', () => {
    // The exact reported case: 5 failed, 9 skipped out of 3740 total.
    // Previously rendered as "3726 / 3740 Passed", which reads as if 14
    // tests failed instead of the real 5.
    const testData: SlackTestData = {
      summary: { total: 3740, passed: 3726, failed: 5, skipped: 9, time: 19410 },
      suites: [],
    };

    const message = buildSlackMessage(testData, { title: 'Release-August-27 Critical', metadata: [] });

    const blocks = getBlocks(message);
    const summarySection = blocks.find(b => b.fields?.[0]?.text.startsWith('*Results:*'));
    expect(summarySection?.fields?.[0].text).toBe('*Results:*\n3726 / 3731 Passed (99.86%)');
    expect(message.text).toBe('Automated Testing Results: 3726 / 3731 passed (99.86%)');
  });

  it('leaves an already-visible split (e.g. 90/10) at its exact true proportion, not compressed toward the floor', () => {
    const testData: SlackTestData = {
      summary: { total: 100, passed: 90, failed: 10, skipped: 0, time: 10 },
      suites: [],
    };

    const message = buildSlackMessage(testData, { title: 'Run', metadata: [] });
    const blocks = getBlocks(message);
    const chartBlock = blocks.find(b => b.type === 'image')!;

    const [passedShare, failedShare] = getChartDataValues(chartBlock.image_url!);
    expect(passedShare).toBeCloseTo(0.9, 5);
    expect(failedShare).toBeCloseTo(0.1, 5);
  });

  it('does not need to boost a single-category chart — it already fills the whole bar', () => {
    const testData: SlackTestData = {
      summary: { total: 5, passed: 5, failed: 0, skipped: 0, time: 5 },
      suites: [],
    };

    const message = buildSlackMessage(testData, { title: 'Run', metadata: [] });
    const blocks = getBlocks(message);
    const chartBlock = blocks.find(b => b.type === 'image')!;

    const [passedShare] = getChartDataValues(chartBlock.image_url!);
    expect(passedShare).toBeCloseTo(1, 5);
  });

  it('never rounds a passing rate up to a misleading 100% when there are real failures', () => {
    // The exact TestBeats reference numbers: 6578/6596 passed is 99.72%, not 100%.
    const testData: SlackTestData = {
      summary: { total: 6596, passed: 6578, failed: 18, skipped: 0, time: 34348 },
      suites: [{ name: 'Suite A', tests: 6596, failures: 18, errors: 0, skipped: 0, time: 34348 }],
    };

    const message = buildSlackMessage(testData, { title: 'Full Regression', metadata: [] });

    const blocks = getBlocks(message);
    const summarySection = blocks.find(b => b.type === 'section' && b.fields);
    expect(summarySection?.fields?.[0].text).toBe('*Results:*\n6578 / 6596 Passed (99.72%)');
    expect(message.attachments![0].color).toBe('warning');
  });

  it('floors (never rounds up) a percentage that would round up at two decimals', () => {
    // 2/3 = 66.6666...% — rounding to 2dp would give 66.67, which overstates
    // the true rate. Flooring must give 66.66.
    const testData: SlackTestData = {
      summary: { total: 3, passed: 2, failed: 1, skipped: 0, time: 3 },
      suites: [{ name: 'Suite A', tests: 3, failures: 1, errors: 0, skipped: 0, time: 3 }],
    };

    const message = buildSlackMessage(testData, { title: 'Run', metadata: [] });

    const blocks = getBlocks(message);
    const summarySection = blocks.find(b => b.type === 'section' && b.fields);
    expect(summarySection?.fields?.[0].text).toBe('*Results:*\n2 / 3 Passed (66.66%)');
  });

  it('uses a yellow (warning) attachment when failures keep the pass rate at or above 90%', () => {
    const testData: SlackTestData = {
      summary: { total: 100, passed: 95, failed: 5, skipped: 0, time: 3725 },
      suites: [{ name: 'Suite A', tests: 100, failures: 5, errors: 0, skipped: 0, time: 3725 }],
    };

    const message = buildSlackMessage(testData, {
      title: 'TitleXYZ',
      metadata: [{ key: 'Env', value: 'staging' }],
    });

    expect(message.attachments![0].color).toBe('warning');
    const blocks = getBlocks(message);
    const metadataSection = blocks.find(b => b.fields?.[0]?.text.startsWith('*Env:*'));
    expect(metadataSection?.fields?.[0].text).toBe('*Env:*\nstaging');
    const summarySection = blocks.find(b => b.fields?.[0]?.text.startsWith('*Results:*'));
    expect(summarySection?.fields?.[0].text).toBe('*Results:*\n95 / 100 Passed (95.00%)');
    expect(summarySection?.fields?.[1].text).toBe('*Duration:*\n1h 2m 5s');
  });

  it('uses a red (danger) attachment when the pass rate drops below 90%', () => {
    const testData: SlackTestData = {
      summary: { total: 100, passed: 50, failed: 50, skipped: 0, time: 10 },
      suites: [{ name: 'Suite A', tests: 100, failures: 50, errors: 0, skipped: 0, time: 10 }],
    };

    const message = buildSlackMessage(testData, { title: 'Run', metadata: [] });

    expect(message.attachments![0].color).toBe('danger');
  });

  it('guards against divide-by-zero when every test is skipped but some are also marked failed', () => {
    // Executed count (total - skipped) is 0 here even though failed > 0 — an inconsistent-looking
    // summary, but nothing stops a caller from passing one. passRateValue must not divide by that
    // zero executed count when computing the danger/warning threshold.
    const testData: SlackTestData = {
      summary: { total: 5, passed: 0, failed: 1, skipped: 5, time: 5 },
      suites: [{ name: 'Suite A', tests: 5, failures: 1, errors: 0, skipped: 5, time: 5 }],
    };

    const message = buildSlackMessage(testData, { title: 'AllSkipped', metadata: [] });

    expect(message.attachments![0].color).toBe('danger');
  });

  it('guards against divide-by-zero when there are no tests at all', () => {
    const testData: SlackTestData = {
      summary: { total: 0, passed: 0, failed: 0, skipped: 0, time: 0 },
      suites: [],
    };

    const message = buildSlackMessage(testData, { title: 'Empty', metadata: [] });

    expect(message.attachments![0].color).toBe('good');
    const blocks = getBlocks(message);
    const summarySection = blocks.find(b => b.fields?.[0]?.text.startsWith('*Results:*'));
    expect(summarySection?.fields?.[0].text).toBe('*Results:*\n0 / 0 Passed (0.00%)');
    // Nothing meaningful to chart with zero tests.
    expect(blocks.some(b => b.type === 'image')).toBe(false);
  });

  it('omits the metadata section when no metadata entries have a key', () => {
    const testData: SlackTestData = {
      summary: { total: 1, passed: 1, failed: 0, skipped: 0, time: 1 },
      suites: [{ name: 'Suite A', tests: 1, failures: 0, errors: 0, skipped: 0, time: 1 }],
    };

    const message = buildSlackMessage(testData, {
      title: 'Run',
      metadata: [{ key: '', value: 'ignored' }],
    });

    const blocks = getBlocks(message);
    expect(blocks.some(b => b.fields?.[0]?.text.includes('ignored'))).toBe(false);
  });

  it('splits metadata across multiple section blocks once it exceeds Slack\'s 10-field-per-section limit', () => {
    const testData: SlackTestData = {
      summary: { total: 1, passed: 1, failed: 0, skipped: 0, time: 1 },
      suites: [{ name: 'Suite A', tests: 1, failures: 0, errors: 0, skipped: 0, time: 1 }],
    };
    const manyMetadataEntries = Array.from({ length: 15 }, (_, i) => ({ key: `Key${i + 1}`, value: `Value${i + 1}` }));

    const message = buildSlackMessage(testData, { title: 'Run', metadata: manyMetadataEntries });
    const blocks = getBlocks(message);

    const metadataSections = blocks.filter(b => b.fields?.[0]?.text.startsWith('*Key'));
    expect(metadataSections).toHaveLength(2);
    expect(metadataSections[0].fields).toHaveLength(10);
    expect(metadataSections[1].fields).toHaveLength(5);
    // No section anywhere in the message exceeds Slack's field cap.
    expect(blocks.every(b => (b.fields?.length ?? 0) <= 10)).toBe(true);
    expect(metadataSections[0].fields?.[0].text).toBe('*Key1:*\nValue1');
    expect(metadataSections[1].fields?.[0].text).toBe('*Key11:*\nValue11');
  });

  it('lists only the failing suites, with correct pass counts and durations', () => {
    const testData: SlackTestData = {
      summary: { total: 21, passed: 15, failed: 6, skipped: 0, time: 118 },
      suites: [
        { name: 'Passing Suite', tests: 10, failures: 0, errors: 0, skipped: 0, time: 10 },
        { name: 'Suite X', tests: 10, failures: 2, errors: 1, skipped: 1, time: 53 },
        { name: 'Suite Y (errors only)', tests: 1, failures: 0, errors: 1, skipped: 0, time: 5 },
      ],
    };

    const message = buildSlackMessage(testData, { title: 'Run', metadata: [] });
    const blocks = getBlocks(message);

    expect(blocks.some(b => b.type === 'divider')).toBe(true);
    expect(blocks.some(b => b.text?.text === ':x: *Passing Suite*')).toBe(false);
    expect(blocks.some(b => b.text?.text === ':x: *Suite X*')).toBe(true);
    expect(blocks.some(b => b.text?.text === ':x: *Suite Y (errors only)*')).toBe(true);

    const suiteXIndex = blocks.findIndex(b => b.text?.text === ':x: *Suite X*');
    const suiteXFields = blocks[suiteXIndex + 1].fields;
    // Suite X has 1 skipped test, excluded from the denominator: 10 - 1 = 9.
    expect(suiteXFields?.[0].text).toBe('*Results:*\n6 / 9 Passed (66.66%)');
    expect(suiteXFields?.[1].text).toBe('*Duration:*\n53s');
  });

  it('truncates long failure lists and pluralizes the "more" note correctly', () => {
    const manyFailingSuites: SlackTestData['suites'] = Array.from({ length: 12 }, (_, i) => ({
      name: `Suite ${i + 1}`,
      tests: 1,
      failures: 1,
      errors: 0,
      skipped: 0,
      time: 1,
    }));
    const testData: SlackTestData = {
      summary: { total: 12, passed: 0, failed: 12, skipped: 0, time: 12 },
      suites: manyFailingSuites,
    };

    const message = buildSlackMessage(testData, { title: 'Run', metadata: [] });
    const blocks = getBlocks(message);

    expect(blocks.filter(b => b.text?.text.startsWith(':x:'))).toHaveLength(10);
    expect(blocks.find(b => b.elements?.[0]?.text.includes('more failing suite'))?.elements?.[0].text).toBe(
      '…and 2 more failing suites'
    );
  });

  it('uses singular phrasing when exactly one failing suite is truncated', () => {
    const manyFailingSuites: SlackTestData['suites'] = Array.from({ length: 11 }, (_, i) => ({
      name: `Suite ${i + 1}`,
      tests: 1,
      failures: 1,
      errors: 0,
      skipped: 0,
      time: 1,
    }));
    const testData: SlackTestData = {
      summary: { total: 11, passed: 0, failed: 11, skipped: 0, time: 11 },
      suites: manyFailingSuites,
    };

    const message = buildSlackMessage(testData, { title: 'Run', metadata: [] });
    const blocks = getBlocks(message);

    expect(blocks.find(b => b.elements?.[0]?.text.includes('more failing suite'))?.elements?.[0].text).toBe(
      '…and 1 more failing suite'
    );
  });

  describe('long input truncation', () => {
    const testData: SlackTestData = {
      summary: { total: 1, passed: 0, failed: 1, skipped: 0, time: 1 },
      suites: [{ name: 'a'.repeat(500), tests: 1, failures: 1, errors: 0, skipped: 0, time: 1 }],
    };

    it('keeps the header block within the 80-character display cap (well under Slack\'s 150-character hard limit)', () => {
      const longTitle = 'T'.repeat(500);
      const message = buildSlackMessage(testData, { title: longTitle, metadata: [] });

      const blocks = getBlocks(message);
      const headerText = blocks.find(b => b.type === 'header')?.text?.text ?? '';
      expect(headerText.length).toBe(80);
      expect(headerText.endsWith('…')).toBe(true);
    });

    it('leaves short titles untouched', () => {
      const message = buildSlackMessage(testData, { title: 'Short Title', metadata: [] });
      const blocks = getBlocks(message);
      expect(blocks.find(b => b.type === 'header')?.text?.text).toBe('Short Title');
    });

    it('truncates a long failing suite name', () => {
      const message = buildSlackMessage(testData, { title: 'Title', metadata: [] });
      const blocks = getBlocks(message);
      const suiteHeading = blocks.find(b => b.text?.text.startsWith(':x:'))?.text?.text ?? '';
      // ":x: *" + 199 chars + "…" + "*"
      expect(suiteHeading.length).toBe(':x: **'.length + 200);
    });

    it('truncates long metadata keys and values', () => {
      const longKey = 'K'.repeat(300);
      const longValue = 'V'.repeat(300);
      const message = buildSlackMessage(testData, {
        title: 'Title',
        metadata: [{ key: longKey, value: longValue }],
      });

      const blocks = getBlocks(message);
      const metadataText = blocks.find(b => b.fields?.[0]?.text.startsWith('*K'))?.fields?.[0].text ?? '';
      const [keyPart, valuePart] = metadataText.split('\n');
      expect(keyPart.length).toBe(103); // "*" + 100 truncated chars + ":*"
      expect(valuePart.length).toBe(200);
    });
  });
});
