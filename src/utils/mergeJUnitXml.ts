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
 * file is kept exactly as-is and concatenated under one <testsuites> root,
 * with root-level totals recomputed as a sum across all of them rather than
 * trusted from any one file. Warns — but still includes the data rather than
 * dropping anything — when two files look like they might not actually be
 * disjoint: identical file content, or the same suite name reappearing in
 * more than one file (a sign of a re-uploaded or overlapping shard).
 */
export function mergeJUnitXml(files: JUnitXmlFile[]): MergeResult {
  if (files.length === 0) throw new Error('No files to combine.');

  const parser = new XMLParser(PARSER_OPTIONS);
  const warnings: string[] = [];
  let rootAttrs: XmlNode = {};
  let haveRootAttrs = false;
  const allSuites: XmlNode[] = [];
  // Which file(s) each named suite was found in — used only to warn about
  // suspicious overlap, never to merge or drop anything.
  const suiteFileNames = new Map<string, Set<string>>();

  files.forEach((file) => {
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

    suites.forEach((suite) => {
      allSuites.push(suite);
      const name = suite.name !== undefined ? String(suite.name) : '';
      if (name === '') return;
      if (!suiteFileNames.has(name)) suiteFileNames.set(name, new Set());
      suiteFileNames.get(name)!.add(file.name);
    });
  });

  // Identical uploads are the most common accidental-overlap mistake — check
  // for them before the noisier per-suite-name overlap check below.
  for (let i = 0; i < files.length; i++) {
    for (let j = i + 1; j < files.length; j++) {
      if (files[i].xml.trim() === files[j].xml.trim()) {
        warnings.push(
          `"${files[i].name}" and "${files[j].name}" are byte-for-byte identical — check you didn't upload the same shard's report twice.`
        );
      }
    }
  }

  suiteFileNames.forEach((fileNames, suiteName) => {
    if (fileNames.size > 1) {
      warnings.push(
        `Suite "${suiteName}" appears in more than one file (${[...fileNames].join(', ')}) — if these shards overlap, the totals below may double-count tests.`
      );
    }
  });

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
