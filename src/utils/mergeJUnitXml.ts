import { XMLParser, XMLBuilder } from 'fast-xml-parser';

// Matches src/utils/xmlParser.js's reader options exactly, so a testsuite
// carried through unchanged parses back to the identical shape.
const PARSER_OPTIONS = { ignoreAttributes: false, attributeNamePrefix: '' };

type XmlNode = Record<string, unknown>;

function toArray(value: unknown): XmlNode[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? (value as XmlNode[]) : [value as XmlNode];
}

function numberOf(value: unknown): number {
  const n = parseFloat(String(value ?? '0'));
  return Number.isFinite(n) ? n : 0;
}

export interface JUnitXmlFile {
  name: string;
  xml: string;
}

export interface MergeResult {
  xml: string;
  fileCount: number;
  suiteCount: number;
  warnings: string[];
}

/**
 * Combines independent JUnit XML reports — one per Playwright shard — into a
 * single JUnit XML document. Unlike combineResults.ts (which deliberately
 * de-duplicates the passed/skipped tests two *split* halves share by design),
 * a sharded run divides the suite across shards up front, so each shard's
 * <testsuite> blocks are expected to be disjoint: every testsuite from every
 * file is kept as-is and concatenated under one <testsuites> root, with
 * root-level totals recomputed as a sum across all of them rather than
 * trusted from any one file.
 *
 * The one exception is a suite that reappears, byte-for-byte identical,
 * across more than one file (the same shard re-uploaded, or two shards that
 * genuinely overlap): that's never counted twice. Elsewhere in this app, a
 * failing test is counted once per raw <testsuite> occurrence (Dashboard,
 * Failures) but once per unique test *identity* (Progress, which stores
 * entries in an object keyed by suite+classname+name), so silently keeping
 * an exact duplicate suite in both copies would make those screens disagree
 * about the same data — the Dashboard would show one count, Progress a
 * smaller "deduplicated" one, with nothing to explain why. A same-named
 * suite whose content actually *differs* between files is not auto-resolved
 * — there's no safe way to pick a winner — so every differing copy is kept,
 * and a warning flags the discrepancy instead of hiding it.
 */
export function mergeJUnitXml(files: JUnitXmlFile[]): MergeResult {
  if (files.length === 0) throw new Error('No files to combine.');

  const parser = new XMLParser(PARSER_OPTIONS);
  const warnings: string[] = [];
  let rootAttrs: XmlNode = {};
  let haveRootAttrs = false;
  // Every suite collected in file order, tagged with which file (by index,
  // not name — two uploads can share a filename) it came from.
  const collected: Array<{ suite: XmlNode; fileIndex: number }> = [];

  files.forEach((file, fileIndex) => {
    const parsed = parser.parse(file.xml) as { testsuites?: XmlNode; testsuite?: unknown };
    let suites: XmlNode[];
    if (parsed.testsuites) {
      const { testsuite, ...attrs } = parsed.testsuites;
      if (!haveRootAttrs) {
        rootAttrs = attrs;
        haveRootAttrs = true;
      }
      suites = toArray(testsuite);
    } else if (parsed.testsuite) {
      suites = toArray(parsed.testsuite);
    } else {
      throw new Error(`"${file.name}": Invalid JUnit XML format`);
    }

    suites.forEach((suite) => collected.push({ suite, fileIndex }));
  });

  // Identical whole-file uploads are the most common accidental-overlap
  // mistake — flagged by file position (not name) before the per-suite pass
  // below, which uses this set to avoid also warning about the very same
  // duplication one suite at a time.
  const identicalFilePairs = new Set<string>();
  for (let i = 0; i < files.length; i++) {
    for (let j = i + 1; j < files.length; j++) {
      if (files[i].xml.trim() === files[j].xml.trim()) {
        identicalFilePairs.add(`${i}|${j}`);
        warnings.push(
          `"${files[i].name}" and "${files[j].name}" are byte-for-byte identical — the duplicate's suites were counted once, not twice.`
        );
      }
    }
  }

  const byName = new Map<string, Array<{ suite: XmlNode; fileIndex: number; position: number }>>();
  collected.forEach(({ suite, fileIndex }, position) => {
    const name = suite.name !== undefined ? String(suite.name) : '';
    if (name === '') return;
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name)!.push({ suite, fileIndex, position });
  });

  const dropPositions = new Set<number>();
  byName.forEach((entries, name) => {
    const fileIndices = [...new Set(entries.map((e) => e.fileIndex))];
    // Same name repeated within a single file (e.g. the same spec re-run
    // under two browser projects) is ordinary and expected — not cross-file
    // overlap, so every occurrence is left alone.
    if (fileIndices.length <= 1) return;

    const distinctContent = new Set(entries.map((e) => JSON.stringify(e.suite)));
    if (distinctContent.size === 1) {
      entries.slice(1).forEach((e) => dropPositions.add(e.position));
      const explainedByWholeFileWarning =
        fileIndices.length === 2 && identicalFilePairs.has(`${Math.min(...fileIndices)}|${Math.max(...fileIndices)}`);
      if (!explainedByWholeFileWarning) {
        const fileNames = fileIndices.map((i) => files[i].name);
        const uniqueNames = [...new Set(fileNames)];
        const location =
          uniqueNames.length === 1
            ? `uploaded ${fileNames.length} times as "${uniqueNames[0]}"`
            : `in more than one file (${uniqueNames.join(', ')})`;
        warnings.push(`Suite "${name}" was identical, ${location} — counted once, not ${entries.length} times.`);
      }
    } else {
      const fileNames = [...new Set(fileIndices.map((i) => files[i].name))];
      warnings.push(
        `Suite "${name}" appears in more than one file (${fileNames.join(', ')}) with different contents — kept every copy, so the totals below may double-count it. Check these shards don't overlap.`
      );
    }
  });

  const allSuites = collected.filter((_, position) => !dropPositions.has(position)).map((e) => e.suite);

  const omit = new Set(['testsuite', 'tests', 'failures', 'errors', 'skipped', 'time']);
  const baseAttrs = Object.fromEntries(Object.entries(rootAttrs).filter(([k]) => !omit.has(k)));
  const sumAttr = (field: string) => allSuites.reduce((total, s) => total + numberOf(s[field]), 0);

  const builder = new XMLBuilder({ ignoreAttributes: false, attributeNamePrefix: '', format: true });
  const xml = builder.build({
    testsuites: {
      ...baseAttrs,
      tests: String(sumAttr('tests')),
      failures: String(sumAttr('failures')),
      errors: String(sumAttr('errors')),
      skipped: String(sumAttr('skipped')),
      time: sumAttr('time').toFixed(3),
      ...(allSuites.length > 0 ? { testsuite: allSuites.length === 1 ? allSuites[0] : allSuites } : {}),
    },
  });

  return {
    xml,
    fileCount: files.length,
    suiteCount: allSuites.length,
    warnings,
  };
}
