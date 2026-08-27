import type { IncomingWebhookSendArguments } from '@slack/webhook';
import type { KnownBlock } from '@slack/types';
import QuickChart from 'quickchart-js';

// Deliberately not imported from src/types: server/ and src/ are separate
// TypeScript projects (see tsconfig.node.json vs tsconfig.json), so shared
// shapes are redeclared locally on this side of the boundary, same as
// MetadataEntry in publishPlugin.ts.
export interface SlackMetadataEntry {
  key: string;
  value: string;
}

export interface SlackTestSuite {
  name: string;
  tests: number;
  failures: number;
  errors: number;
  skipped: number;
  time: number;
}

export interface SlackTestData {
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    time: number;
  };
  suites: SlackTestSuite[];
}

export interface BuildSlackMessageOptions {
  title: string;
  metadata: SlackMetadataEntry[];
}

// Cap on how many failing suites are listed individually, to stay well
// under Slack's per-message block limit (50) — each suite renders as two
// blocks (name + results/duration fields).
const MAX_FAILED_SUITES_SHOWN = 10;

const CHART_COLORS = { passed: '#2eb67d', failed: '#e01e5a', skipped: '#ecb22e' };
const CHART_WIDTH = 320;
// A single horizontal bar needs far less height than the doughnut this
// replaced — just enough for the bar itself plus the legend below it.
const CHART_HEIGHT = 110;
// Guaranteed minimum share of the bar's total length for any non-zero
// segment — about 4-5px at CHART_WIDTH, small enough to read as a thin
// sliver rather than a chunky block, but wide enough to still be a visible
// band of color rather than an antialiasing smudge. A real, common test run
// might be 3722 passed / 3 failed — at true proportions that's a fraction
// of a pixel wide, visually indistinguishable from zero. This is purely a
// VISUAL encoding choice: it never touches the real counts (still shown
// accurately in the Results text and legend), only how much of the bar each
// non-zero segment is drawn with, so a present failure/skip is always
// actually visible — without inflating segments that are already
// comfortably visible (see toVisualShares).
const MIN_SLICE_VISUAL_SHARE = 5 / 360;
// QuickChart defaults to a 2x (or higher) devicePixelRatio for crisper
// images, which silently doubled the actual PNG size beyond CHART_WIDTH/
// CHART_HEIGHT and rendered far larger in Slack than intended. Pinned to 1
// so the requested dimensions are the actual output size.
const CHART_DEVICE_PIXEL_RATIO = 1;

// Slack hard-rejects (the whole message fails to post) any header plain_text
// over 150 characters, but real run titles are never anywhere near that —
// 80 keeps the header tidy and compact while staying well under Slack's
// ceiling. The other caps below are generous-but-finite so a pasted stack
// trace in a metadata value, or a very deep spec file path, can't blow up
// the layout.
const HEADER_MAX_LENGTH = 80;
const SUITE_NAME_MAX_LENGTH = 200;
const METADATA_KEY_MAX_LENGTH = 100;
const METADATA_VALUE_MAX_LENGTH = 200;

// Slack hard-caps a section block at 10 fields — metadata is user-editable
// (the Publish page lets you add rows freely), so this chunks entries into
// multiple section blocks of at most 10 rather than risk exceeding that
// limit and having Slack reject the whole message once someone adds an
// 11th field. Each chunk still renders as a clean 2-column grid; only the
// very last row of the very last chunk can end up alone, which is normal
// Slack layout, not a bug.
const METADATA_FIELDS_PER_SECTION = 10;

const chunk = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const truncate = (text: string, maxLength: number): string =>
  text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (remainingSeconds > 0 || parts.length === 0) parts.push(`${remainingSeconds}s`);
  return parts.join(' ');
};

// Raw (unrounded) pass rate, used for the good/warning/danger threshold so
// the color isn't skewed by display rounding.
const passRateValue = (passed: number, total: number): number => (total === 0 ? 0 : (passed / total) * 100);

// Two decimal places, always rounded DOWN (floored) rather than to nearest —
// e.g. 6578/6596 is 99.727...%, shown as "99.72%" — so this can never
// overstate the real pass rate the way standard rounding could (99.727%
// rounding to a misleading "100%" at zero decimals, or even "99.73%"
// rounding up past the true value at two).
const formatPercent = (passed: number, total: number): string => {
  if (total === 0) return '0.00';
  const rawPercent = (passed / total) * 100;
  const flooredToTwoDecimals = Math.floor(rawPercent * 100) / 100;
  return flooredToTwoDecimals.toFixed(2);
};

const suitePassed = (suite: SlackTestSuite): number => suite.tests - suite.failures - suite.errors - suite.skipped;

const suiteHasFailures = (suite: SlackTestSuite): boolean => suite.failures + suite.errors > 0;

const attachmentColor = (summary: SlackTestData['summary']): 'good' | 'warning' | 'danger' => {
  if (summary.failed === 0) return 'good';
  return passRateValue(summary.passed, summary.total) < 90 ? 'danger' : 'warning';
};

// Floors each segment's true proportion at MIN_SLICE_VISUAL_SHARE — a
// segment already at or above that share (e.g. a normal 90/10 split) is
// left at its exact true value, so ordinary proportions render accurately;
// only a segment that would otherwise round to an invisible sliver gets
// lifted to the floor. Chart.js normalizes whatever relative magnitudes
// it's given (they don't need to sum to 1), so lifting one segment doesn't
// require manually stealing area from the others — it's handled by the
// chart itself slightly compressing everyone else, proportionally, when it
// renders. Callers must pre-filter to non-zero values (buildChartUrl's
// `segments` already does) — the floor isn't meaningful for a zero segment.
const toVisualShares = (values: number[]): number[] => {
  const total = values.reduce((sum, v) => sum + v, 0);
  return values.map(v => Math.max(v / total, MIN_SLICE_VISUAL_SHARE));
};

// A single horizontal bar, stacked and colored by pass/fail/skip share,
// rendered by QuickChart. Slack images must be fetched from a public URL —
// there's no backend in this app to render and host one ourselves — so this
// sends the pass/fail/skip counts to quickchart.io as URL params and gets
// back a PNG URL. Rendered as its own full-width image block (not a section
// accessory, which Slack shrinks to a small square thumbnail) so both the
// chart and its legend stay legible.
//
// A bar rather than a pie/doughnut: a wedge's visible width shrinks toward
// the circle's center at a fixed angle, so even a "floored" minimum-angle
// slice (see toVisualShares) can look thin and tapered; a bar segment's
// width is constant along its whole height, so the same floored share reads
// as a cleaner, more legible band of color — a better fit for the typically
// lopsided pass/fail/skip proportions this chart has to show.
//
// Chart.js version is pinned to 4 so the legend config below
// (options.plugins.legend) is unambiguous — QuickChart's own default
// version otherwise reads legend options from a different, older location.
// Returns null when there's nothing meaningful to chart.
const buildChartUrl = (summary: SlackTestData['summary']): string | null => {
  if (summary.total === 0) return null;

  const segments = [
    { label: 'Passed', value: summary.passed, color: CHART_COLORS.passed },
    { label: 'Failed', value: summary.failed, color: CHART_COLORS.failed },
    { label: 'Skipped', value: summary.skipped, color: CHART_COLORS.skipped },
  ].filter(s => s.value > 0);
  const shares = toVisualShares(segments.map(s => s.value));

  const chart = new QuickChart();
  chart.setConfig({
    type: 'bar',
    data: {
      // A single unlabeled row — each segment is its own dataset so they
      // stack into one bar rather than becoming separate bars.
      labels: [''],
      datasets: segments.map((s, i) => ({
        label: s.label,
        data: [shares[i]],
        backgroundColor: s.color,
      })),
    },
    options: {
      indexAxis: 'y',
      scales: {
        // No axis chrome — the legend below already labels the colors, and
        // an unlabeled 0-1 share axis wouldn't mean anything to a viewer.
        x: { stacked: true, display: false },
        y: { stacked: true, display: false },
      },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          align: 'center',
          labels: { padding: 16, boxWidth: 14 },
        },
        // QuickChart auto-enables chartjs-plugin-datalabels by default,
        // which prints a number on every segment — for a thin sliver that
        // number becomes illegible. The exact counts are already in the
        // Results text right above the chart and in the legend, so the
        // in-chart labels are redundant; disabling them keeps the chart to
        // what it's actually good at, a quick proportion glance.
        datalabels: { display: false },
      },
    },
  });
  chart.setVersion('4');
  chart.setWidth(CHART_WIDTH).setHeight(CHART_HEIGHT).setBackgroundColor('transparent');

  // quickchart-js only appends its own devicePixelRatio param when the
  // value differs from the LIBRARY's assumed default of 1 — but QuickChart's
  // SERVER actually defaults to 2, silently doubling the real PNG dimensions
  // (measured: a 320x220 request came back 640x440). setDevicePixelRatio(1)
  // is therefore a no-op through the library's own API; append the param to
  // the URL directly to force it.
  const url = new URL(chart.getUrl());
  url.searchParams.set('devicePixelRatio', String(CHART_DEVICE_PIXEL_RATIO));
  return url.toString();
};

export function buildSlackMessage(testData: SlackTestData, options: BuildSlackMessageOptions): IncomingWebhookSendArguments {
  const { summary, suites } = testData;
  const { title, metadata } = options;
  const overallPassRateText = formatPercent(summary.passed, summary.total);
  const chartUrl = buildChartUrl(summary);

  const blocks: KnownBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: truncate(title, HEADER_MAX_LENGTH), emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Results:*\n${summary.passed} / ${summary.total} Passed (${overallPassRateText}%)` },
        { type: 'mrkdwn', text: `*Duration:*\n${formatDuration(summary.time)}` },
      ],
    },
  ];

  if (chartUrl) {
    blocks.push({
      type: 'image',
      image_url: chartUrl,
      alt_text: `${overallPassRateText}% passed`,
    });
  }

  const metadataEntries = metadata.filter(m => m.key.trim());
  for (const metadataChunk of chunk(metadataEntries, METADATA_FIELDS_PER_SECTION)) {
    blocks.push({
      type: 'section',
      fields: metadataChunk.map(m => ({
        type: 'mrkdwn' as const,
        text: `*${truncate(m.key, METADATA_KEY_MAX_LENGTH)}:*\n${truncate(m.value, METADATA_VALUE_MAX_LENGTH)}`,
      })),
    });
  }

  const failedSuites = suites.filter(suiteHasFailures);
  if (failedSuites.length > 0) {
    blocks.push({ type: 'divider' });

    for (const suite of failedSuites.slice(0, MAX_FAILED_SUITES_SHOWN)) {
      const passed = suitePassed(suite);
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `:x: *${truncate(suite.name, SUITE_NAME_MAX_LENGTH)}*` },
      });
      blocks.push({
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Results:*\n${passed} / ${suite.tests} Passed (${formatPercent(passed, suite.tests)}%)` },
          { type: 'mrkdwn', text: `*Duration:*\n${formatDuration(suite.time)}` },
        ],
      });
    }

    const remaining = failedSuites.length - MAX_FAILED_SUITES_SHOWN;
    if (remaining > 0) {
      blocks.push({
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `…and ${remaining} more failing suite${remaining === 1 ? '' : 's'}` }],
      });
    }
  }

  return {
    text: `Automated Testing Results: ${summary.passed} / ${summary.total} passed (${overallPassRateText}%)`,
    attachments: [
      {
        color: attachmentColor(summary),
        blocks,
      },
    ],
  };
}
