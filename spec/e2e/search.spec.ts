import { test, expect } from './baseFixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:5190/')

  const [fileUpload] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Select File' }).click()
  ])

  await fileUpload.setFiles('./spec/testfiles/sample.xml')

  await expect(page.getByRole('heading', { name: 'Test Execution Summary' })).toBeVisible()
})

test.describe('Search tests', () => {

  test('should search for a test on the dashboard then clear', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Test Results Dashboard' })).toBeVisible()

    await page.getByRole('textbox', { name: 'Search tests' }).pressSequentially('test3')

    await expect(page.getByRole('row', { name: 'test3 Suite A' })).toBeVisible()

    await expect(page.getByRole('row', { name: 'test3 Suite B' })).toBeVisible()

    await expect(page.getByRole('row', { name: 'test1 Suite A' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test1 Suite B' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test1 Suite C' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test2 Suite A' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test2 Suite B' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test2 Suite C' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test4 Suite A' })).toBeHidden()

    await page.locator('button').filter({ hasText: 'Clear Filters' }).click()

    await expect(page.getByRole('textbox', { name: 'Search tests' })).toBeEmpty()

    await expect(page.getByRole('row', { name: 'test1 Suite A' })).toBeVisible()

    await expect(page.getByRole('row', { name: 'test1 Suite B' })).toBeVisible()

    await expect(page.getByRole('row', { name: 'test1 Suite C' })).toBeVisible()

    await expect(page.getByRole('row', { name: 'test2 Suite A' })).toBeVisible()

    await expect(page.getByRole('row', { name: 'test2 Suite B' })).toBeVisible()

    await expect(page.getByRole('row', { name: 'test2 Suite C' })).toBeVisible()

    await expect(page.getByRole('row', { name: 'test3 Suite A' })).toBeVisible()

    await expect(page.getByRole('row', { name: 'test3 Suite B' })).toBeVisible()

    await expect(page.getByRole('row', { name: 'test4 Suite A' })).toBeVisible()
  })

  test('should search for a test on the failures page then clear', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Test Results Dashboard' })).toBeVisible()

    await page.getByRole('button', { name: 'Failures' }).click()

    await expect(page.getByRole('heading', { name: 'Failure Analysis' })).toBeVisible()

    await page.getByRole('textbox', { name: 'Search tests' }).fill('test3')

    await expect(page.getByRole('button', { name: 'test3 Suite: Suite A' })).toBeVisible()

    await expect(page.getByRole('button', { name: 'test2 Suite: Suite A' })).toBeHidden()

    await expect(page.getByRole('button', { name: 'test2 Suite: Suite B' })).toBeHidden()

    await expect(page.getByRole('button', { name: 'test1 Suite: Suite C' })).toBeHidden()

    await page.locator('button').filter({ hasText: 'Clear Filters' }).click()

    await expect(page.getByRole('textbox', { name: 'Search tests' })).toBeEmpty()

    await expect(page.getByRole('button', { name: 'test3 Suite: Suite A' })).toBeVisible()

    await expect(page.getByRole('button', { name: 'test2 Suite: Suite A' })).toBeVisible()

    await expect(page.getByRole('button', { name: 'test2 Suite: Suite B' })).toBeVisible()

    await expect(page.getByRole('button', { name: 'test1 Suite: Suite C' })).toBeVisible()
  })

  test('should search for a test on the progress page then clear', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Test Results Dashboard' })).toBeVisible()

    await page.getByRole('button', { name: 'Progress' }).click()

    await expect(page.getByRole('heading', { name: 'Failure Resolution Progress' })).toBeVisible()

    await page.getByRole('textbox', { name: 'Search tests' }).fill('test1')

    await expect(page.getByRole('main').filter({ hasText: 'test1Suite: Suite C' })).toBeVisible()

    await expect(page.getByRole('main').filter({ hasText: 'test3Suite: Suite A' })).toBeHidden()

    await expect(page.getByRole('main').filter({ hasText: 'test2Suite: Suite A' })).toBeHidden()

    await expect(page.getByRole('main').filter({ hasText: 'test2Suite: Suite B' })).toBeHidden()

    await page.locator('button').filter({ hasText: 'Clear Filters' }).click()

    await expect(page.getByRole('textbox', { name: 'Search tests' })).toBeEmpty()

    await expect(page.getByRole('main').filter({ hasText: 'test1Suite: Suite C' })).toBeVisible()

    await expect(page.getByRole('main').filter({ hasText: 'test3Suite: Suite A' })).toBeVisible()

    await expect(page.getByRole('main').filter({ hasText: 'test2Suite: Suite A' })).toBeVisible()

    await expect(page.getByRole('main').filter({ hasText: 'test2Suite: Suite B' })).toBeVisible()
  })
})
