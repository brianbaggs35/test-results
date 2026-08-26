import { test, expect } from './baseFixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:5190/')

  const [fileUpload] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Select File' }).click()
  ])

  await fileUpload.setFiles('./spec/testfiles/sample.xml')

  await expect(page.getByRole('heading', { name: 'Test Execution Summary' })).toBeVisible()
})

test.describe('Filter tests', () => {

  test('should filter on the dashboard by status then clear', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Test Results Dashboard' })).toBeVisible()

    await page.locator('button').filter({ hasText: 'Filters' }).click()

    await page.getByRole('combobox', { name: 'Status' }).selectOption('failed')

    await expect(page.getByRole('row', { name: 'test1 Suite C' })).toBeVisible()

    await expect(page.getByRole('row', { name: 'test2 Suite A' })).toBeVisible()

    await expect(page.getByRole('row', { name: 'test2 Suite B' })).toBeVisible()

    await expect(page.getByRole('row', { name: 'test3 Suite A' })).toBeVisible()

    await expect(page.getByRole('row', { name: 'test1 Suite A' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test1 Suite B' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test2 Suite C' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test3 Suite B' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test4 Suite A' })).toBeHidden()

    await page.locator('button').filter({ hasText: 'Clear Filters' }).click()

    await expect(page.getByRole('combobox', { name: 'Status' })).toHaveValue('all')

    await expect(page.getByRole('row', { name: 'test1 Suite C' })).toBeVisible()

    await expect(page.getByRole('row', { name: 'test2 Suite A' })).toBeVisible()

    await expect(page.getByRole('row', { name: 'test2 Suite B' })).toBeVisible()

    await expect(page.getByRole('row', { name: 'test3 Suite A' })).toBeVisible()

    await expect(page.getByRole('row', { name: 'test1 Suite A' })).toBeVisible()

    await expect(page.getByRole('row', { name: 'test1 Suite B' })).toBeVisible()

    await expect(page.getByRole('row', { name: 'test2 Suite C' })).toBeVisible()

    await expect(page.getByRole('row', { name: 'test3 Suite B' })).toBeVisible()

    await expect(page.getByRole('row', { name: 'test4 Suite A' })).toBeVisible()
  })

  test('should filter on the dashboard by suite', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Test Results Dashboard' })).toBeVisible()

    await page.locator('button').filter({ hasText: 'Filters' }).click()

    await page.getByRole('combobox', { name: 'Test Suite' }).selectOption('Suite A')

    await expect(page.getByRole('row', { name: 'test1 Suite A' })).toBeVisible()

    await expect(page.getByRole('row', { name: 'test2 Suite A' })).toBeVisible()

    await expect(page.getByRole('row', { name: 'test3 Suite A' })).toBeVisible()

    await expect(page.getByRole('row', { name: 'test4 Suite A' })).toBeVisible()

    await expect(page.getByRole('row', { name: 'test1 Suite B' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test2 Suite B' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test3 Suite B' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test1 Suite C' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test2 Suite C' })).toBeHidden()
  })

  test('should filter on the dashboard by class', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Test Results Dashboard' })).toBeVisible()

    await page.locator('button').filter({ hasText: 'Filters' }).click()

    await page.getByRole('combobox', { name: 'Class Name' }).selectOption('SuiteA.TestClass1')

    await expect(page.getByRole('row', { name: 'test1 Suite A' })).toBeVisible()

    await expect(page.getByRole('row', { name: 'test2 Suite A' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test3 Suite A' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test4 Suite A' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test1 Suite B' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test2 Suite B' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test3 Suite B' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test1 Suite C' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test2 Suite C' })).toBeHidden()
  })

  test('should filter on the dashboard by status and suite', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Test Results Dashboard' })).toBeVisible()

    await page.locator('button').filter({ hasText: 'Filters' }).click()

    await page.getByRole('combobox', { name: 'Status' }).selectOption('failed')

    await page.getByRole('combobox', { name: 'Test Suite' }).selectOption('Suite B')

    await expect(page.getByRole('row', { name: 'test2 Suite B' })).toBeVisible()

    await expect(page.getByRole('row', { name: 'test1 Suite A' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test2 Suite A' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test3 Suite A' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test4 Suite A' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test1 Suite B' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test3 Suite B' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test1 Suite C' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test2 Suite C' })).toBeHidden()
  })

  test('failures page should be filtered by failure status', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Test Results Dashboard' })).toBeVisible()

    await page.getByRole('button', { name: 'Failures' }).click()

    await expect(page.getByRole('heading', { name: 'Failure Analysis' })).toBeVisible()

    await page.getByRole('button', { name: 'Filters', exact: true }).click()

    await expect(page.getByRole('combobox', { name: 'Status' })).toHaveValue('failed')

    await expect(page.locator('div.px-6.py-4')).toHaveCount(4)
  })

  test('filter failures page by suite then clear', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Test Results Dashboard' })).toBeVisible()

    await page.getByRole('button', { name: 'Failures' }).click()

    await expect(page.getByRole('heading', { name: 'Failure Analysis' })).toBeVisible()

    await page.getByRole('button', { name: 'Filters', exact: true }).click()

    await page.getByRole('combobox', { name: 'Test Suite' }).selectOption('Suite A')

    await expect(page.getByRole('button', { name: 'test2 Suite: Suite A' })).toBeVisible()

    await expect(page.getByRole('button', { name: 'test3 Suite: Suite A' })).toBeVisible()

    await expect(page.getByRole('button', { name: 'test2 Suite: Suite B' })).toBeHidden()

    await expect(page.getByRole('button', { name: 'test1 Suite: Suite C' })).toBeHidden()

    await expect(page.locator('div.px-6.py-4')).toHaveCount(2)

    await page.locator('button').filter({ hasText: 'Clear Filters' }).click()

    await expect(page.getByRole('combobox', { name: 'Status' })).toHaveValue('failed')

    await expect(page.getByRole('combobox', { name: 'Test Suite' })).toHaveValue('all')

    await expect(page.getByRole('button', { name: 'test2 Suite: Suite A' })).toBeVisible()

    await expect(page.getByRole('button', { name: 'test3 Suite: Suite A' })).toBeVisible()

    await expect(page.getByRole('button', { name: 'test2 Suite: Suite B' })).toBeVisible()

    await expect(page.getByRole('button', { name: 'test1 Suite: Suite C' })).toBeVisible()

    await expect(page.locator('div.px-6.py-4')).toHaveCount(4)
  })

  test('filter progress page by suite then clear', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Test Results Dashboard' })).toBeVisible()

    await page.getByRole('button', { name: 'Progress' }).click()

    await expect(page.getByRole('heading', { name: 'Failure Resolution Progress' })).toBeVisible()

    await page.getByRole('button', { name: 'Filters', exact: true }).click()

    await page.getByRole('combobox', { name: 'Test Suite' }).selectOption('Suite A')

    await expect(page.getByRole('main').filter({ hasText: 'test2Suite: Suite A' })).toBeVisible()

    await expect(page.getByRole('main').filter({ hasText: 'test3Suite: Suite A' })).toBeVisible()

    await expect(page.getByRole('main').filter({ hasText: 'test2Suite: Suite B' })).toBeHidden()

    await expect(page.getByRole('main').filter({ hasText: 'test1Suite: Suite C' })).toBeHidden()

    // All tests are freshly-loaded (still "pending") in this scenario, so the plain
    // card-wrapper selector alone already scopes to exactly the visible test cards.
    await expect(page.locator('div.border.rounded-lg.overflow-hidden')).toHaveCount(2)

    await page.locator('button').filter({ hasText: 'Clear Filters' }).click()

    await expect(page.getByRole('combobox', { name: 'Test Suite' })).toHaveValue('all')

    await expect(page.getByRole('combobox', { name: 'Class Name' })).toHaveValue('all')

    await expect(page.getByRole('main').filter({ hasText: 'test2Suite: Suite A' })).toBeVisible()

    await expect(page.getByRole('main').filter({ hasText: 'test3Suite: Suite A' })).toBeVisible()

    await expect(page.getByRole('main').filter({ hasText: 'test2Suite: Suite B' })).toBeVisible()

    await expect(page.getByRole('main').filter({ hasText: 'test1Suite: Suite C' })).toBeVisible()
  })
})
