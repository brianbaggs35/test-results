import type { ExportBundle, FailureProgressItem, TestData } from '../types';
import { downloadFile, readFileAsText } from './download';

export function buildExportBundle(
  testData: TestData,
  progress: Record<string, FailureProgressItem>,
): ExportBundle {
  return { version: 1, testData, progress };
}

export function downloadJson(filename: string, data: unknown): void {
  downloadFile(filename, JSON.stringify(data, null, 2), 'application/json');
}

export function exportProgressBundle(
  testData: TestData,
  progress: Record<string, FailureProgressItem>,
): void {
  downloadJson(
    `test-results-export-${new Date().toISOString().split('T')[0]}.json`,
    buildExportBundle(testData, progress),
  );
}

/** Parses and minimally validates a File as an ExportBundle produced by exportProgressBundle. */
export async function readExportBundle(file: File): Promise<ExportBundle> {
  const text = await readFileAsText(file);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`"${file.name}" is not valid JSON. Export it from the Progress tab first.`);
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('testData' in parsed) ||
    !('progress' in parsed)
  ) {
    throw new Error(`"${file.name}" doesn't look like a test-results export file.`);
  }
  return parsed as ExportBundle;
}
