import { test, expect } from './baseFixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:5173/')
})

test.describe('Dashboard E2E Tests', () => {

  test('should display the dashboard title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Test Results Dashboard' })).toBeVisible()
  })

  test('should be able to switch between tabs', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Test Results Dashboard' })).toBeVisible()

    await page.getByRole('button', { name: 'Failures' }).click()

    await expect(page.getByRole('heading', { name: 'No Test Data Available' })).toBeVisible()

    await page.getByRole('button', { name: 'Progress' }).click()

    await expect(page.getByRole('heading', { name: 'No Test Data Available' })).toBeVisible()

    await page.getByRole('button', { name: 'Report' }).click()

    await expect(page.getByRole('button', { name: 'Go to Dashboard' })).toBeVisible()

    await page.getByRole('button', { name: 'Go to Dashboard' }).click()

    await expect(page.getByRole('button', { name: 'Select File' })).toBeVisible()
  })

  test('Upload sample XML file', async ({ page }) => {
    const [fileUpload] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Select File' }).click()
    ])

    await fileUpload.setFiles('./spec/testfiles/sample.xml')

    await expect(page.getByRole('heading', { name: 'Test Execution Summary' })).toBeVisible()
  })
})