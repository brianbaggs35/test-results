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

test.describe('Theme tests', () => {

  test('should switch to dark theme', async ({ page }) => {
    const toggleDarkMode = page.getByRole('button', { name: 'Toggle dark mode' })
    const toggleLightMode = page.getByRole('button', { name: 'Toggle light mode' })

    if (await toggleDarkMode.isVisible()) {
      await toggleDarkMode.click()

      await expect(toggleDarkMode).toBeVisible()

      await expect(toggleLightMode).toBeHidden()

      await expect(page.locator('html')).toHaveClass('dark')

      await expect(page.evaluate(() => localStorage.getItem('test-results-theme'))).resolves.toBe('dark')

      await expect(page.locator('html')).not.toHaveClass('light')
    } else if (await toggleLightMode.isVisible()) {
      await toggleLightMode.click()

      await expect(toggleLightMode).toBeVisible()

      await expect(toggleDarkMode).toBeHidden()

      await expect(page.locator('html')).toHaveClass('light')

      await expect(page.evaluate(() => localStorage.getItem('test-results-theme'))).resolves.toBe('light')

      await expect(page.locator('html')).not.toHaveClass('dark')
    }
  })
})
