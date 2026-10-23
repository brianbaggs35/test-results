import { stat } from 'node:fs/promises'
import { test, expect } from './baseFixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:5190/')
})

test.describe('Shard E2E Tests', () => {

  test('should combine two realistically-balanced sharded JUnit XML reports into one file', async ({ page }) => {
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

    await expect(page.getByTestId('shard-result')).toContainText('Combined 25 tests (4 failed) from 2 files across 15 suites.')

    await expect(page.getByTestId('shard-result')).not.toContainText('appears in more than one file')

    const [fileDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download Combined XML' }).click()
    ])

    await expect(fileDownload.suggestedFilename()).toBe('test-results-combined.xml')

    const filePath = await fileDownload.path()
    await expect(stat(filePath!)).resolves.toMatchObject({ size: 38158 })

    await page.getByRole('button', { name: 'View in Dashboard' }).click()

    await expect(page.getByRole('heading', { name: 'Test Results Dashboard' })).toBeVisible()

    await expect(page.getByTestId('stat-passed')).toContainText('20Passed')

    await expect(page.getByTestId('stat-failed')).toContainText('4Failed')

    await expect(page.getByTestId('stat-skipped')).toContainText('1Skipped')
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

  test('should combine three shards, de-duplicating a suite that genuinely reappears across files', async ({ page }) => {
    await page.getByRole('button', { name: 'Shard' }).click()

    const [fileUpload] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Choose XML Files' }).click()
    ])

    await fileUpload.setFiles([
      './spec/testfiles/test-results-shard-1.xml',
      './spec/testfiles/test-results-shard-2.xml',
      './spec/testfiles/test-results-shard-3.xml'
    ])

    await expect(page.getByText('test-results-shard-3.xml')).toBeVisible()

    await page.getByRole('button', { name: 'Combine Shards' }).click()

    await expect(page.getByText(/Suite ".*false_positive\.spec\.ts" was identical.*counted once, not 2 times/)).toBeVisible()

    await expect(page.getByTestId('shard-result')).toContainText('Combined 31 tests (4 failed) from 3 files across 19 suites.')

    // The de-duplication keeps the Dashboard's raw per-suite count and the Progress
    // tab's per-test-identity count in agreement, instead of silently disagreeing.
    await page.getByRole('button', { name: 'View in Dashboard' }).click()

    await expect(page.getByTestId('stat-failed')).toContainText('4Failed')

    await page.getByRole('button', { name: 'Progress' }).click()

    await expect(page.getByText('Total Tracked Tests').locator('..').getByText('4')).toBeVisible()
  })

  test('should treat the same shard report uploaded twice as one copy, not a double-count', async ({ page }) => {
    await page.getByRole('button', { name: 'Shard' }).click()

    const [firstUpload] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Choose XML Files' }).click()
    ])

    await firstUpload.setFiles('./spec/testfiles/test-results-shard-1.xml')

    const [secondUpload] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Choose XML Files' }).click()
    ])

    await secondUpload.setFiles('./spec/testfiles/test-results-shard-1.xml')

    await expect(page.getByLabel('Uploaded shard reports').getByText('test-results-shard-1.xml')).toHaveCount(2)

    await page.getByRole('button', { name: 'Combine Shards' }).click()

    await expect(page.getByText(/are byte-for-byte identical/)).toBeVisible()

    // Deduplicated down to exactly what shard-1 alone contains — not doubled.
    await expect(page.getByTestId('shard-result')).toContainText('Combined 13 tests (3 failed) from 2 files across 7 suites.')

    await page.getByRole('button', { name: 'View in Dashboard' }).click()

    await expect(page.getByTestId('stat-failed')).toContainText('3Failed')

    await page.getByRole('button', { name: 'Progress' }).click()

    await expect(page.getByText('Total Tracked Tests').locator('..').getByText('3')).toBeVisible()
  })
})
