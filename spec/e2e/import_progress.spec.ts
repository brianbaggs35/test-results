import { test, expect } from './baseFixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:5190/')

  const [fileUpload] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Select File' }).click()
  ])

  await fileUpload.setFiles('./spec/testfiles/sample_large.xml')

  await expect(page.getByRole('heading', { name: 'Test Execution Summary' })).toBeVisible()
})

test.describe('Importing progress', () => {

  test('should import an in progress json file', async ({ page }) => {
    await page.getByRole('button', { name: 'Progress' }).click()

    await expect(page.getByRole('heading', { name: 'Failure Resolution Progress' })).toBeVisible()

    await expect(page.getByText('Total Tracked Tests').locator('..').getByText('54')).toBeVisible()

    await expect(page.getByText('Completed').locator('..').getByText('0')).toBeVisible()

    await expect(page.getByText('In Progress').locator('..').getByText('0')).toBeVisible()

    const [fileUpload] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Import Progress' }).click()
    ])

    await fileUpload.setFiles('./spec/testfiles/sample_large_progress_export.json')

    await expect(page.getByRole('alert')).toContainText('Imported progress for 54 tests.')

    await expect(page.getByText('Total Tracked Tests').locator('..').getByText('54')).toBeVisible()

    await expect(page.getByText('Completed').locator('..').getByText('10')).toBeVisible()

    await expect(page.getByText('In Progress').locator('..').getByText('1')).toBeVisible()
  })
})
