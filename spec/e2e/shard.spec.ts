import { stat } from 'node:fs/promises'
import { test, expect } from './baseFixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:5190/')
})

test.describe('Shard E2E Tests', () => {

  test('should combine sharded JUnit XML reports into one file', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Test Results Dashboard' })).toBeVisible()

    await page.getByRole('button', { name: 'Shard' }).click()

    await expect(page.getByRole('heading', { name: 'Combine sharded test runs' })).toBeVisible()

    const [fileUpload] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Choose XML Files' }).click()
    ])

    await fileUpload.setFiles([
      './spec/testfiles/test-results-shard-1.xml',
      './spec/testfiles/test-results-shard-2.xml'
    ])

    await expect(page.getByText('test-results-shard-1.xml')).toBeVisible()
    await expect(page.getByText('test-results-shard-2.xml')).toBeVisible()

    await page.getByRole('button', { name: 'Combine Shards' }).click()

    await expect(page.getByTestId('shard-result')).toContainText('Combined 7 tests (0 failed) from 2 files across 3 suites.')

    const [fileDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download Combined XML' }).click()
    ])

    await expect(fileDownload.suggestedFilename()).toBe('test-results-combined.xml')

    const filePath = await fileDownload.path()
    await expect(stat(filePath!)).resolves.toMatchObject({ size: 1550 })

    await page.getByRole('button', { name: 'View in Dashboard' }).click()

    await expect(page.getByRole('heading', { name: 'Test Results Dashboard' })).toBeVisible()

    await expect(page.getByTestId('stat-passed')).toContainText('7Passed')

    await expect(page.getByTestId('stat-failed')).toContainText('0Failed')
  })

  test('should remove an uploaded shard before combining', async ({ page }) => {
    await page.getByRole('button', { name: 'Shard' }).click()

    const [fileUpload] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Choose XML Files' }).click()
    ])

    await fileUpload.setFiles([
      './spec/testfiles/test-results-shard-1.xml',
      './spec/testfiles/test-results-shard-2.xml'
    ])

    await expect(page.getByText('test-results-shard-2.xml')).toBeVisible()

    await page.getByRole('button', { name: 'Remove test-results-shard-2.xml' }).click()

    await expect(page.getByText('test-results-shard-2.xml')).not.toBeVisible()

    await expect(page.getByText('Add at least one more shard report to combine.')).toBeVisible()

    await expect(page.getByRole('button', { name: 'Combine Shards' })).toBeDisabled()
  })
})
