export interface TestPathInfo {
  module: string;
  page: string;
  accountType: string;
  fullPath: string;
}
export const parseTestPath = (testName: string): TestPathInfo | null => {
  // Expected format: e2e/module/page/account
  const parts = testName.split('/');
  if (parts.length >= 4 && parts[0] === 'e2e') {
    return {
      module: parts[1].replace(/_/g, ' '),
      page: parts[2].replace(/_/g, ' '),
      accountType: parts[3],
      fullPath: testName
    };
  }
  return null;
};
export const getUniqueValues = (tests: any[], field: 'module' | 'page' | 'accountType'): string[] => {
  const values = new Set<string>();
  tests.forEach(test => {
    const pathInfo = parseTestPath(test.name);
    if (pathInfo) {
      values.add(pathInfo[field]);
    }
  });
  return Array.from(values).sort();
};