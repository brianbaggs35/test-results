import { test, expect } from './baseFixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:5173/')
})

test.describe('Publish Page', () => {

  test('should fill out the publish form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Test Results Dashboard' })).toBeVisible()

    await page.getByRole('navigation').getByRole('button', { name: 'Publish' }).click()

    await page.getByRole('textbox', { name: 'Run Name' }).fill('Test run')

    await page.getByRole('textbox', { name: 'Title' }).fill('Test run 2')

    await page.getByPlaceholder('e.g., Failed Tests').fill('Failed tests')

    await page.getByPlaceholder('e.g., 54').fill('22')

    await page.getByPlaceholder('e.g., Executed By').fill('Executed by')

    await page.getByPlaceholder('e.g., Brian').fill('Test user')

    await expect(page.getByRole('textbox', { name: 'Run Name' })).toHaveValue('Test run')

    await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('Test run 2')

    await expect(page.getByPlaceholder('e.g., Failed Tests')).toHaveValue('Failed tests')

    await expect(page.getByPlaceholder('e.g., 54')).toHaveValue('22')

    await expect(page.getByPlaceholder('e.g., Brian')).toHaveValue('Test user')

    await expect(page.getByPlaceholder('e.g., Executed By')).toHaveValue('Executed by')
  })
})
