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

test.describe('Clear test data', () => {

  test('should clear the test data', async ({ page }) => {
    await expect(page.getByTestId('stat-passed')).toContainText('5Passed')

    await expect(page.getByTestId('stat-failed')).toContainText('4Failed')

    await expect(page.getByTestId('stat-skipped')).toContainText('0Skipped')

    await expect(page.getByTestId('stat-flaky')).toContainText('0Flaky')

    await expect(page.evaluate(() => localStorage.getItem('testFixProgress_structureHash'))).resolves.not.toBeNull()

    await page.getByRole('button', { name: 'Clear Test Data' }).click()

    await page.getByRole('dialog').getByRole('button', { name: 'Clear data' }).click()

    await expect(page.getByTestId('stat-passed')).toBeHidden()

    await expect(page.getByTestId('stat-failed')).toBeHidden()

    await expect(page.getByTestId('stat-skipped')).toBeHidden()

    await expect(page.getByTestId('stat-flaky')).toBeHidden()

    await expect(page.evaluate(() => localStorage.getItem('testFixProgress_structureHash'))).resolves.toBeNull()
  })

  test('should cancel clearing the test data', async ({ page }) => {
    await expect(page.getByTestId('stat-passed')).toContainText('5Passed')

    await expect(page.getByTestId('stat-failed')).toContainText('4Failed')

    await expect(page.getByTestId('stat-skipped')).toContainText('0Skipped')

    await expect(page.getByTestId('stat-flaky')).toContainText('0Flaky')

    await page.getByRole('button', { name: 'Clear Test Data' }).click()

    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByRole('dialog')).toBeHidden()

    await expect(page.getByTestId('stat-passed')).toContainText('5Passed')

    await expect(page.getByTestId('stat-failed')).toContainText('4Failed')

    await expect(page.getByTestId('stat-skipped')).toContainText('0Skipped')

    await expect(page.getByTestId('stat-flaky')).toContainText('0Flaky')
  })
})
