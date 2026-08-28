import { test, expect } from './baseFixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:5190/')
})

test.describe('Publish Page', () => {

  test('should fill out the publish form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Test Results Dashboard' })).toBeVisible()

    await page.getByRole('navigation').getByRole('button', { name: 'Publish' }).click()

    await page.getByRole('textbox', { name: 'Title' }).fill('Test run 2')

    await page.getByPlaceholder('e.g., Failed Tests').fill('Failed tests')

    await page.getByPlaceholder('e.g., 54').fill('22')

    await page.getByPlaceholder('e.g., Executed By').fill('Executed by')

    await page.getByPlaceholder('e.g., Brian').fill('Test user')

    await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('Test run 2')

    await expect(page.getByPlaceholder('e.g., Failed Tests')).toHaveValue('Failed tests')

    await expect(page.getByPlaceholder('e.g., 54')).toHaveValue('22')

    await expect(page.getByPlaceholder('e.g., Brian')).toHaveValue('Test user')

    await expect(page.getByPlaceholder('e.g., Executed By')).toHaveValue('Executed by')
  })

  // These two mock the /api/publish response at the network layer so the
  // suite never posts a real message to Slack — they exercise the full
  // client flow (upload → parse → fetch → success/error UI) against a
  // controlled response instead.
  test('should show a success message when publishing succeeds', async ({ page }) => {
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Select File' }).click()
    ])
    await fileChooser.setFiles('./spec/testfiles/sample.xml')
    await expect(page.getByRole('heading', { name: 'Test Execution Summary' })).toBeVisible()

    await page.getByRole('navigation').getByRole('button', { name: 'Publish' }).click()
    await page.getByRole('textbox', { name: 'Title' }).fill('Nightly Regression')

    let requestBody: { title?: string; testData?: unknown } = {}
    await page.route('**/api/publish', async route => {
      requestBody = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      })
    })

    await page.getByRole('main').getByRole('button', { name: 'Publish' }).click()

    await expect(page.getByText('Test results published to Slack!')).toBeVisible()
    expect(requestBody.title).toBe('Nightly Regression')
    expect(requestBody.testData).toBeTruthy()
  })

  test('should show the specific reason when publishing fails', async ({ page }) => {
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Select File' }).click()
    ])
    await fileChooser.setFiles('./spec/testfiles/sample.xml')
    await expect(page.getByRole('heading', { name: 'Test Execution Summary' })).toBeVisible()

    await page.getByRole('navigation').getByRole('button', { name: 'Publish' }).click()
    await page.getByRole('textbox', { name: 'Title' }).fill('Nightly Regression')

    await page.route('**/api/publish', async route => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Slack publishing is not configured. Set SLACK_WEBHOOK_URL in your .env file and restart the dev server.'
        })
      })
    })

    await page.getByRole('main').getByRole('button', { name: 'Publish' }).click()

    await expect(
      page.getByText('Slack publishing is not configured. Set SLACK_WEBHOOK_URL in your .env file and restart the dev server.')
    ).toBeVisible()
  })
})
