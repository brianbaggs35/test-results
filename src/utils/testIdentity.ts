/**
 * Canonical identity for a single testcase within a suite, shared by
 * splitJUnitXml/combineResults/exportBundle/FailureAnalysisProgress so they
 * can never drift into disagreeing about what makes two tests "the same
 * test." Includes classname so two different tests that happen to share a
 * name (e.g. the same method name reused across classes, common at the
 * scale of a few hundred failures) are never conflated with each other.
 * Built with JSON.stringify rather than string concatenation so no
 * combination of suite/class/test names — including ones that contain
 * whatever separator a naive concatenation would have used — can produce a
 * false collision between two genuinely different tests.
 */
export function testIdentityKey(suiteName: string, classname: string | undefined, testName: string): string {
  return JSON.stringify([suiteName, classname ?? '', testName]);
}
