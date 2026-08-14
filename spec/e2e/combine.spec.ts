import { stat } from 'node:fs/promises';

import { test, expect } from './baseFixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:5173/')
})

test.describe('Combine split E2E Tests', () => {

  test('should combine split XML files', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Test Results Dashboard' })).toBeVisible()

    await page.getByRole('button', { name: 'Split' }).click()

    await expect(page.getByRole('heading', { name: 'Split a report for your team' })).toBeVisible()

    const [fileUpload] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.locator('span.text-sm.font-medium.text-gray-700.mb-2').filter({ hasText: 'Export A' }).click()
    ])

    await fileUpload.setFiles('./spec/testfiles/test-results-export-a.json')

    await expect(page.locator('span.text-xs.text-gray-500').filter({ hasText: 'test-results-export-a.json' })).toBeVisible()

    const [fileUploadB] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.locator('span.text-sm.font-medium.text-gray-700.mb-2').filter({ hasText: 'Export B' }).click()
    ])

    await fileUploadB.setFiles('./spec/testfiles/test-results-export-b.json')

    await expect(page.locator('span.text-xs.text-gray-500').filter({ hasText: 'test-results-export-b.json' })).toBeVisible()

    await page.getByRole('button', { name: 'Combine' }).click()

    await expect(page.locator('div.flex.items-center.text-green-700.mb-2').filter({ hasText: 'Combined 9 tests (4 failed) with all resolution progress merged.' })).toBeVisible()

    await page.getByRole('button', { name: 'Continue to Report' }).click()

    await expect(page.getByRole('heading', { name: 'Report Generator' })).toBeVisible()

    await page.getByRole('textbox', { name: 'Author' }).fill('Tester')

    await page.getByRole('textbox', { name: 'Project Name' }).fill('Test Project')

    await page.getByRole('checkbox', { name: 'Include Failure Resolution Progress' }).check()

    await page.getByRole('button', { name: 'Preview Report' }).click()

    await expect(page.getByRole('heading', { name: 'Automated Test Results Report' })).toBeVisible()

    const [pdfDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download PDF' }).click()
    ])

    await expect(pdfDownload.suggestedFilename()).toContain('test-results-report')

    await expect(pdfDownload.suggestedFilename()).toContain('.pdf')

    const filePath = await pdfDownload.path()
    expect((await stat(filePath!)).size).toBeGreaterThan(300000)
  })
})
