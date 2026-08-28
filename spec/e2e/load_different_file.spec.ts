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

test.describe('Load a different file', () => {

  test('should load a different XML and clear stats', async ({ page }) => {
    await expect(page.evaluate(() => localStorage.getItem('testFixProgress_structureHash'))).resolves.toBe('459ba6cef60ac2aef460f23c20e5159a4e7880e30225befd198c306788fb42a5')

    await expect(page.getByTestId('stat-passed')).toContainText('5Passed')

    await expect(page.getByTestId('stat-failed')).toContainText('4Failed')

    await expect(page.getByTestId('stat-skipped')).toContainText('0Skipped')

    await expect(page.getByTestId('stat-flaky')).toContainText('0Flaky')

    const [fileUpload] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Load Different File' }).click()
    ])

    await fileUpload.setFiles('./spec/testfiles/sample_large.xml')

    await expect(page.getByRole('listitem')).toContainText('Loaded a different XML file — previous failure-resolution progress was cleared.')

    await page.getByLabel('Close toast').click()

    await expect(page.getByRole('listitem')).not.toBeVisible()

    await expect(page.evaluate(() => localStorage.getItem('testFixProgress_structureHash'))).resolves.toBe('b08279305a4e5c8780961d378440f9527f90c231cf8c7dcd18cf7d3ca1ac80a8')

    await expect(page.getByTestId('stat-passed')).toContainText('246Passed')

    await expect(page.getByTestId('stat-failed')).toContainText('54Failed')

    await expect(page.getByTestId('stat-skipped')).toContainText('0Skipped')

    await expect(page.getByTestId('stat-flaky')).toContainText('0Flaky')
  })
})
