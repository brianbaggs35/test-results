import { test, expect } from './baseFixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:5190/')

  const [fileUpload] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Select File' }).click()
  ])

  await fileUpload.setFiles('./spec/testfiles/sample-flaky.xml')

  await expect(page.getByRole('heading', { name: 'Test Execution Summary' })).toBeVisible()
})

test.describe('Flaky test tracking', () => {

  test('should show a flaky stat tile on the Dashboard', async ({ page }) => {
    await expect(page.getByTestId('stat-flaky')).toContainText('1')
    await expect(page.getByTestId('stat-passed')).toContainText('5')
    await expect(page.getByTestId('stat-failed')).toContainText('1')
    await expect(page.getByTestId('stat-skipped')).toContainText('0')
  })

  test('should offer Flaky as a status filter option and filter the results table to it', async ({ page }) => {
    await page.getByRole('button', { name: 'Filters' }).click()
    await page.getByLabel('Status').selectOption('flaky')

    await expect(page.getByText('test3')).toBeVisible()
    await expect(page.getByText('test2')).not.toBeVisible()
  })

  test('should show the flaky test on the Failures tab with yellow styling, distinct from the failed test', async ({ page }) => {
    await page.getByRole('navigation').getByRole('button', { name: 'Failures' }).click()

    // The default view is Failed-only — switch to All to see the flaky test alongside it.
    await page.getByRole('button', { name: 'Filters', exact: true }).click()
    await page.getByLabel('Status').selectOption('all')

    await expect(page.getByText('1 failed and 1 flaky')).toBeVisible()

    const failedRow = page.locator('button', { hasText: 'test2' })
    const flakyRow = page.locator('button', { hasText: 'test3' })
    await expect(failedRow).toHaveClass(/bg-destructive\/5/)
    await expect(flakyRow).toHaveClass(/bg-flaky\/5/)

    await flakyRow.click()
    await expect(page.getByRole('heading', { name: 'Test Details' })).toBeVisible()
    await expect(page.getByText('Failure Type')).toBeVisible()
    await expect(page.getByText('Flaky').first()).toBeVisible()
  })

  test('should track the flaky test on the Progress tab alongside the failed one', async ({ page }) => {
    await page.getByRole('navigation').getByRole('button', { name: 'Progress' }).click()

    await expect(page.getByText('2 tests tracked')).toBeVisible()
    await expect(page.getByText('test2')).toBeVisible()
    await expect(page.getByText('test3')).toBeVisible()

    await page.getByRole('button', { name: 'Filters' }).click()
    await page.getByLabel('Status').selectOption('flaky')

    await expect(page.getByText('test3')).toBeVisible()
    await expect(page.getByText('test2')).not.toBeVisible()
  })

  test('should keep flaky tests out of the report by default, and include them once checked', async ({ page }) => {
    await page.getByRole('navigation').getByRole('button', { name: 'Report' }).click()

    await expect(page.getByRole('checkbox', { name: 'Include Flaky Tests' })).not.toBeChecked()

    await page.getByRole('checkbox', { name: 'Include Flaky Tests' }).check()
    await page.getByRole('button', { name: 'Preview Report' }).click()

    await expect(page.getByTestId('preview-container')).toBeVisible()
    await expect(page.getByText('Flaky').first()).toBeVisible()
  })
})
