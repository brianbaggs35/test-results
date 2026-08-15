import { test, expect } from './baseFixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:5173/')

  const [fileUpload] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Select File' }).click()
  ])

  await fileUpload.setFiles('./spec/testfiles/sample.xml')

  await expect(page.getByRole('heading', { name: 'Test Execution Summary' })).toBeVisible()
})

test.describe('Progress Page', () => {

  test('should open stack trace modal', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Test Results Dashboard' })).toBeVisible()

    await page.getByRole('button', { name: 'Progress' }).click()

    await page.getByRole('button', { name: 'View Stack Trace' }).first().click()

    await expect(page.getByRole('heading', { name: 'Test Details' })).toBeVisible()

    await expect(page.locator('pre.p-4.text-sm')).toContainText('First failure in Suite A')
  })

  test('should confirm local storage', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Test Results Dashboard' })).toBeVisible()

    await page.getByRole('button', { name: 'Progress' }).click()

    const testFixProgress = await page.evaluate(() => {
      const value = localStorage.getItem('testFixProgress')
      return value ? JSON.parse(value) : null
    })

    expect(testFixProgress).toMatchObject({
      'Suite A-test2': {
        id: 'Suite A-test2',
        name: 'test2',
        suite: 'Suite A',
        errorMessage: 'Test failed',
        status: 'pending',
        notes: '',
      },
      'Suite A-test3': {
        id: 'Suite A-test3',
        name: 'test3',
        suite: 'Suite A',
        errorMessage: 'Another failure',
        status: 'pending',
        notes: '',
      },
      'Suite B-test2': {
        id: 'Suite B-test2',
        name: 'test2',
        suite: 'Suite B',
        errorMessage: 'Failed in Suite B',
        status: 'pending',
        notes: '',
      },
      'Suite C-test1': {
        id: 'Suite C-test1',
        name: 'test1',
        suite: 'Suite C',
        errorMessage: 'Failed in Suite C',
        status: 'pending',
        notes: '',
      },
    })
  })

  test('should clear local storage', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Test Results Dashboard' })).toBeVisible()

    await page.getByRole('button', { name: 'Progress' }).click()

    await page.getByRole('button', { name: 'Clear Test Data' }).click()

    await expect(page.evaluate(() => localStorage.getItem('testFixProgress'))).resolves.toBeNull()
  })
})
