import { XMLParser } from 'fast-xml-parser';
export const parseJUnitXML = xmlContent => {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: ''
  });
  try {
    const result = parser.parse(xmlContent);
    // Process testsuites (multiple suites case)
    if (result.testsuites) {
      return processTestSuites(result.testsuites.testsuite);
    }
    // Process single testsuite
    if (result.testsuite) {
      return processTestSuites([result.testsuite]);
    }
    throw new Error('Invalid JUnit XML format');
  } catch (error) {
    console.error('Error parsing XML:', error);
    throw error;
  }
};
const processTestSuites = suites => {
  // Ensure suites is an array
  const suitesArray = Array.isArray(suites) ? suites : [suites];
  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  let totalTime = 0;
  const processedSuites = suitesArray.map(suite => {
    // Extract basic suite info
    const suiteInfo = {
      name: suite.name || 'Unknown Suite',
      tests: parseInt(suite.tests || 0),
      failures: parseInt(suite.failures || 0),
      errors: parseInt(suite.errors || 0),
      skipped: parseInt(suite.skipped || 0),
      time: parseFloat(suite.time || 0),
      timestamp: suite.timestamp || new Date().toISOString(),
      testcases: []
    };
    // Update totals
    totalTests += suiteInfo.tests;
    totalFailed += suiteInfo.failures + suiteInfo.errors;
    totalSkipped += suiteInfo.skipped;
    totalTime += suiteInfo.time;
    // Process testcases if available
    if (suite.testcase) {
      const testcases = Array.isArray(suite.testcase) ? suite.testcase : [suite.testcase];
      suiteInfo.testcases = testcases.map(testcase => {
        let status = 'passed';
        let errorMessage = null;
        let failureDetails = null;
        if (testcase.failure) {
          status = 'failed';
          // Handle both string and object failure messages
          if (typeof testcase.failure === 'string') {
            errorMessage = testcase.failure;
          } else {
            errorMessage = testcase.failure.message || 'Test failed';
            // Capture the full failure message including stack trace
            failureDetails = {
              message: testcase.failure.message || '',
              type: testcase.failure.type || '',
              stackTrace: testcase.failure['#text'] || ''
            };
          }
        } else if (testcase.error) {
          status = 'failed';
          if (typeof testcase.error === 'string') {
            errorMessage = testcase.error;
          } else {
            errorMessage = testcase.error.message || 'Test error';
            failureDetails = {
              message: testcase.error.message || '',
              type: testcase.error.type || '',
              stackTrace: testcase.error['#text'] || ''
            };
          }
        } else if (testcase.skipped) {
          status = 'skipped';
        }
        return {
          name: testcase.name || 'Unnamed Test',
          classname: testcase.classname || '',
          time: parseFloat(testcase.time || 0),
          status,
          errorMessage,
          failureDetails
        };
      });
    }
    return suiteInfo;
  });
  // Calculate passed tests
  totalPassed = totalTests - totalFailed - totalSkipped;
  return {
    summary: {
      total: totalTests,
      passed: totalPassed,
      failed: totalFailed,
      skipped: totalSkipped,
      time: totalTime
    },
    suites: processedSuites
  };
};