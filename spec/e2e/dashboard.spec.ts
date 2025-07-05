import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:5173/')
})

test.describe('Dashboard E2E Tests', () => {

  test('should display the dashboard title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Test Results Dashboard' })).toBeVisible()
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