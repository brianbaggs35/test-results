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

  test('should combine three shards and warn when a suite reappears across files', async ({ page }) => {
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

    await expect(page.getByText(/Suite ".*false_positive\.spec\.ts" appears in more than one file/)).toBeVisible()

    await expect(page.getByTestId('shard-result')).toContainText('Combined 33 tests (5 failed) from 3 files across 20 suites.')
  })

  test('should warn when the same shard report is uploaded twice', async ({ page }) => {
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

    await expect(page.getByTestId('shard-result')).toContainText('Combined 26 tests (6 failed) from 2 files across 14 suites.')
  })
})
