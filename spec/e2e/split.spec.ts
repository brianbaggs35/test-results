import { stat } from 'node:fs/promises';

import { test, expect } from './baseFixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:5190/')
})

test.describe('Split E2E Tests', () => {

  test('should evenly split an XML file', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Test Results Dashboard' })).toBeVisible()

    await page.getByRole('button', { name: 'Split' }).click()

    await expect(page.getByRole('heading', { name: 'Split a report for your team' })).toBeVisible()

    const [fileUpload] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Choose XML File' }).click()
    ])

    await fileUpload.setFiles('./spec/testfiles/sample.xml')

    await expect(page.locator('span.text-sm.text-gray-500').filter({ hasText: 'Using: sample.xml' })).toBeVisible()

    await page.getByRole('main').getByRole('button', { name: 'Split' }).click()

    await expect(page.locator('p.text-sm.text-gray-600.mb-3').filter({ hasText: '4 failed/errored tests split into 2 and 2. All passed and skipped tests are included in both files.' })).toBeVisible()

    const [fileDownloadA] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download File A (2)' }).click()
    ])

    await expect(fileDownloadA.suggestedFilename()).toBe('test-results-split-a.xml')

    const filePath = await fileDownloadA.path()
    await expect(stat(filePath!)).resolves.toMatchObject({ size: 1158 })

    const [fileDownloadB] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download File B (2)' }).click()
    ])

    await expect(fileDownloadB.suggestedFilename()).toBe('test-results-split-b.xml')

    const filePathB = await fileDownloadB.path()
    await expect(stat(filePathB!)).resolves.toMatchObject({ size: 1153 })
  })
})
