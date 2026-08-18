import { test, expect } from './baseFixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:5173/')

  const [fileUpload] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Select File' }).click()
  ])

  await fileUpload.setFiles('./spec/testfiles/sample.xml')

  await expect(page.getByRole('heading', { name: 'Test Execution Summary' })).toBeVisible()
})

test.describe('Progress Page', () => {

  test('should open stack trace modal', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Test Results Dashboard' })).toBeVisible()

    await page.getByRole('button', { name: 'Progress' }).click()

    await page.getByRole('button', { name: 'View Stack Trace' }).first().click()

    await expect(page.getByRole('heading', { name: 'Test Details' })).toBeVisible()

    await expect(page.locator('pre.p-4.text-sm')).toContainText('First failure in Suite A')
  })

  test('should confirm local storage', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Test Results Dashboard' })).toBeVisible()

    await page.getByRole('button', { name: 'Progress' }).click()

    const testFixProgress = await page.evaluate(() => {
      const value = localStorage.getItem('testFixProgress')
      return value ? JSON.parse(value) : null
    })

    expect(testFixProgress).toMatchObject({
      '["Suite A","SuiteA.TestClass2","test2"]': {
        id: '["Suite A","SuiteA.TestClass2","test2"]',
        name: 'test2',
        suite: 'Suite A',
        errorMessage: 'Test failed',
        status: 'pending',
        notes: '',
      },
      '["Suite A","SuiteA.TestClass3","test3"]': {
        id: '["Suite A","SuiteA.TestClass3","test3"]',
        name: 'test3',
        suite: 'Suite A',
        errorMessage: 'Another failure',
        status: 'pending',
        notes: '',
      },
      '["Suite B","SuiteB.TestClass2","test2"]': {
        id: '["Suite B","SuiteB.TestClass2","test2"]',
        name: 'test2',
        suite: 'Suite B',
        errorMessage: 'Failed in Suite B',
        status: 'pending',
        notes: '',
      },
      '["Suite C","SuiteC.TestClass1","test1"]': {
        id: '["Suite C","SuiteC.TestClass1","test1"]',
        name: 'test1',
        suite: 'Suite C',
        errorMessage: 'Failed in Suite C',
        status: 'pending',
        notes: '',
      },
    })
  })

  test('should clear local storage', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Test Results Dashboard' })).toBeVisible()

    await page.getByRole('button', { name: 'Progress' }).click()

    await page.getByRole('button', { name: 'Clear Test Data' }).click()

    await expect(page.evaluate(() => localStorage.getItem('testFixProgress'))).resolves.toBeNull()
  })

  test('should import progress from a previously exported file', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Test Results Dashboard' })).toBeVisible()

    await page.getByRole('button', { name: 'Progress' }).click()

    const [fileUpload] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Import Progress' }).click()
    ])

    await fileUpload.setFiles('./spec/testfiles/test-results-import-progress.json')

    await expect(page.getByText(
      "Imported progress for 2 tests. 1 entry in the file didn't match a test in the currently loaded results and was skipped."
    )).toBeVisible()

    await expect(page.getByText('Fixed the null pointer issue')).toBeVisible()
    await expect(page.getByText('Dana')).toBeVisible()

    const testFixProgress = await page.evaluate(() => {
      const value = localStorage.getItem('testFixProgress')
      return value ? JSON.parse(value) : null
    })

    expect(testFixProgress['["Suite A","SuiteA.TestClass2","test2"]']).toMatchObject({
      status: 'completed',
      notes: 'Fixed the null pointer issue',
      assignee: 'Dana',
    })
    expect(testFixProgress['["Suite A","SuiteA.TestClass3","test3"]']).toMatchObject({
      status: 'in_progress',
      assignee: 'Sam',
    })
    // Stack trace still comes from the loaded XML, not the imported file.
    await page.getByRole('button', { name: 'View Stack Trace' }).first().click()
    await expect(page.locator('pre.p-4.text-sm')).toContainText('First failure in Suite A')
  })

  test('should reject a progress file exported from a different XML file', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Test Results Dashboard' })).toBeVisible()

    await page.getByRole('button', { name: 'Progress' }).click()

    const [fileUpload] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Import Progress' }).click()
    ])

    await fileUpload.setFiles('./spec/testfiles/test-results-import-progress-mismatch.json')

    await expect(page.getByText(/doesn't match the currently loaded results/)).toBeVisible()

    const testFixProgress = await page.evaluate(() => {
      const value = localStorage.getItem('testFixProgress')
      return value ? JSON.parse(value) : null
    })

    expect(testFixProgress['["Suite A","SuiteA.TestClass2","test2"]']).toMatchObject({ status: 'pending' })
  })
})
