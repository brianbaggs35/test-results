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

test.describe('Pagination tests', () => {

  test('should navigate through the pagination', async ({ page }) => {
    await expect(page.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page')

    await expect(page.getByRole('button', { name: '6' })).toBeHidden()

    await page.getByRole('button', { name: 'Next' }).click()

    await expect(page.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page')

    await expect(page.getByRole('row', { name: 'test175	Suite 6	Suite6.TestClass25' })).toBeVisible()

    await expect(page.getByRole('row', { name: 'test177	Suite 6	Suite6.TestClass27' })).toBeVisible()

    await expect(page.getByRole('row', { name: 'test182	Suite 7	Suite7.TestClass2' })).toBeVisible()

    await expect(page.getByRole('button', { name: 'Previous' })).toBeEnabled()

    await page.getByRole('button', { name: 'Next' }).click()

    await expect(page.getByRole('button', { name: '3' })).toHaveAttribute('aria-current', 'page')

    await expect(page.getByRole('row', { name: 'test175	Suite 6	Suite6.TestClass25' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test177	Suite 6	Suite6.TestClass27' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test182	Suite 7	Suite7.TestClass2' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test229	Suite 8	Suite8.TestClass19' })).toBeVisible()

    await expect(page.getByRole('row', { name: 'test226	Suite 8	Suite8.TestClass16' })).toBeVisible()

    await page.getByRole('button', { name: 'Next' }).click()

    await expect(page.getByRole('button', { name: '1' })).toBeHidden()

    await expect(page.getByRole('button', { name: '4' })).toContainClass('bg-gradient-to-b')

    await expect(page.getByRole('row', { name: 'test276	Suite 10	Suite10.TestClass6' })).toBeVisible()

    await expect(page.getByRole('row', { name: 'test175	Suite 6	Suite6.TestClass25' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test177	Suite 6	Suite6.TestClass27' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test182	Suite 7	Suite7.TestClass2' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test229	Suite 8	Suite8.TestClass19' })).toBeHidden()

    await expect(page.getByRole('row', { name: 'test226	Suite 8	Suite8.TestClass16' })).toBeHidden()

    await page.getByRole('button', { name: 'Previous' }).click()

    await expect(page.getByRole('row', { name: 'test229	Suite 8	Suite8.TestClass19' })).toBeVisible()

    await expect(page.getByRole('row', { name: 'test226	Suite 8	Suite8.TestClass16' })).toBeVisible()

    await page.getByRole('button', { name: 'Next' }).click()

    await page.getByRole('button', { name: 'Next' }).click()

    await page.getByRole('button', { name: 'Next' }).click()

    await expect(await page.getByRole('button', { name: 'Next' })).toBeDisabled()

    await expect(page.getByRole('button', { name: '1' })).toBeHidden()

    await expect(page.locator('p.text-muted-foreground').filter({ hasText: 'Showing 251 to 300 of 300 results(Page 6 of 6)'})).toBeVisible()
  })
})
