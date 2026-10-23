import { test, expect } from './baseFixtures'
import type { Page } from '@playwright/test'

// The same suites, classnames and test names as sample.xml — so the same *structure* — but
// a new run of it: Suite A/test2 and Suite B/test2 are fixed, Suite B/test3 is a new failure.
const NEW_RUN_OF_SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="Suite A" tests="4" failures="1" errors="0" time="2.1">
    <testcase name="test1" classname="SuiteA.TestClass1" time="0.5"/>
    <testcase name="test2" classname="SuiteA.TestClass2" time="0.5"/>
    <testcase name="test3" classname="SuiteA.TestClass3" time="0.6">
      <failure message="Another failure" type="AssertionError">Second failure in Suite A</failure>
    </testcase>
    <testcase name="test4" classname="SuiteA.TestClass4" time="0.5"/>
  </testsuite>
  <testsuite name="Suite B" tests="3" failures="1" errors="0" time="1.6">
    <testcase name="test1" classname="SuiteB.TestClass1" time="0.5"/>
    <testcase name="test2" classname="SuiteB.TestClass2" time="0.5"/>
    <testcase name="test3" classname="SuiteB.TestClass3" time="0.6">
      <failure message="Brand new failure" type="AssertionError">New failure in Suite B</failure>
    </testcase>
  </testsuite>
  <testsuite name="Suite C" tests="2" failures="1" errors="0" time="1.0">
    <testcase name="test1" classname="SuiteC.TestClass1" time="0.5">
      <failure message="Failed in Suite C" type="AssertionError">Failure in Suite C</failure>
    </testcase>
    <testcase name="test2" classname="SuiteC.TestClass2" time="0.5"/>
  </testsuite>
</testsuites>
`

const newRunOfSample = { name: 'new-run.xml', mimeType: 'text/xml', buffer: Buffer.from(NEW_RUN_OF_SAMPLE_XML) }

const CLEARED_TOAST = 'Loaded a different XML file — previous failure-resolution progress was cleared.'

async function chooseFile(page: Page, buttonName: string, file: string | typeof newRunOfSample) {
  const [fileUpload] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: buttonName }).click()
  ])

  await fileUpload.setFiles(file)

  await expect(page.getByRole('heading', { name: 'Test Execution Summary' })).toBeVisible()
}

async function completeFirstFailureOnProgressTab(page: Page) {
  await page.getByRole('button', { name: 'Progress' }).click()

  await expect(page.getByRole('heading', { name: 'Failure Resolution Progress' })).toBeVisible()

  await page.getByRole('button', { name: 'Edit' }).first().click()

  await page.getByRole('button', { name: 'Complete', exact: true }).first().click()

  await expect.poll(async () => (await storedProgress(page)).filter((item) => item.status === 'completed').length).toBe(1)
}

async function storedProgress(page: Page) {
  return page.evaluate(() => {
    const value = localStorage.getItem('testFixProgress')
    const progress: Record<string, { suite: string, name: string, status: string }> = value ? JSON.parse(value) : {}
    return Object.values(progress)
  })
}

// What a build from before results hashes existed left behind: the progress itself plus a
// structure-only hash (sample.xml's), and no results hash.
async function leaveOnlyTheOlderStructureHash(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('testFixProgress_resultsHash')
    localStorage.setItem('testFixProgress_structureHash', '459ba6cef60ac2aef460f23c20e5159a4e7880e30225befd198c306788fb42a5')
  })
}

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:5190/')

  await chooseFile(page, 'Select File', './spec/testfiles/sample.xml')
})

test.describe('Load a different file', () => {

  test('should load a different XML and clear stats', async ({ page }) => {
    await expect(page.evaluate(() => localStorage.getItem('testFixProgress_resultsHash'))).resolves.toBe('65ddf085717d289138e61792fb421bb3a58590a912b0102174ba8d890d57ff44')

    await expect(page.getByTestId('stat-passed')).toContainText('5Passed')

    await expect(page.getByTestId('stat-failed')).toContainText('4Failed')

    await expect(page.getByTestId('stat-skipped')).toContainText('0Skipped')

    await expect(page.getByTestId('stat-flaky')).toContainText('0Flaky')

    const [fileUpload] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Load Different File' }).click()
    ])

    await fileUpload.setFiles('./spec/testfiles/sample_large.xml')

    await expect(page.getByRole('listitem')).toContainText(CLEARED_TOAST)

    await page.getByLabel('Close toast').click()

    await expect(page.getByRole('listitem')).not.toBeVisible()

    await expect(page.evaluate(() => localStorage.getItem('testFixProgress_resultsHash'))).resolves.toBe('ff06920e9963bc3efefe87809fafbacf49757a0a74e48cb487885be939e1f456')

    await expect(page.getByTestId('stat-passed')).toContainText('246Passed')

    await expect(page.getByTestId('stat-failed')).toContainText('54Failed')

    await expect(page.getByTestId('stat-skipped')).toContainText('0Skipped')

    await expect(page.getByTestId('stat-flaky')).toContainText('0Flaky')
  })

  test('should clear progress and track the new failures when loading a new run of the same suite', async ({ page }) => {
    await completeFirstFailureOnProgressTab(page)

    await page.getByRole('button', { name: 'Dashboard' }).click()

    await chooseFile(page, 'Load Different File', newRunOfSample)

    await expect(page.getByRole('listitem')).toContainText(CLEARED_TOAST)

    await page.getByRole('button', { name: 'Progress' }).click()

    await expect(page.getByRole('heading', { name: 'Failure Resolution Progress' })).toBeVisible()

    await expect(page.getByText('Total Tracked Tests').locator('..').getByText('3')).toBeVisible()

    const progress = await storedProgress(page)

    expect(progress.map((item) => `${item.suite}/${item.name}:${item.status}`).sort()).toEqual([
      'Suite A/test3:pending',
      'Suite B/test3:pending',
      'Suite C/test1:pending',
    ])
  })

  test('should keep progress when the same XML is loaded again in a new session', async ({ page }) => {
    await completeFirstFailureOnProgressTab(page)

    const progressBefore = await storedProgress(page)

    await page.reload()

    await chooseFile(page, 'Select File', './spec/testfiles/sample.xml')

    await page.getByRole('button', { name: 'Progress' }).click()

    await expect(page.getByRole('heading', { name: 'Failure Resolution Progress' })).toBeVisible()

    await expect(page.getByText('Total Tracked Tests').locator('..').getByText('4')).toBeVisible()

    await expect(page.getByText(CLEARED_TOAST)).toHaveCount(0)

    expect(await storedProgress(page)).toEqual(progressBefore)
  })

  test('should clear progress when a different XML is loaded in a new session', async ({ page }) => {
    await completeFirstFailureOnProgressTab(page)

    await page.reload()

    await chooseFile(page, 'Select File', './spec/testfiles/sample_large.xml')

    await expect(page.getByRole('listitem')).toContainText(CLEARED_TOAST)

    await page.getByRole('button', { name: 'Progress' }).click()

    await expect(page.getByRole('heading', { name: 'Failure Resolution Progress' })).toBeVisible()

    await expect(page.getByText('Total Tracked Tests').locator('..').getByText('54')).toBeVisible()

    const progress = await storedProgress(page)

    expect(progress).toHaveLength(54)
    expect(progress.every((item) => item.status === 'pending')).toBe(true)
  })

  test('should clean up stale progress saved before results hashes existed when a new run loads', async ({ page }) => {
    await completeFirstFailureOnProgressTab(page)

    await leaveOnlyTheOlderStructureHash(page)

    await page.reload()

    await chooseFile(page, 'Select File', newRunOfSample)

    await expect(page.getByRole('listitem')).toContainText(CLEARED_TOAST)

    await page.getByRole('button', { name: 'Progress' }).click()

    await expect(page.getByRole('heading', { name: 'Failure Resolution Progress' })).toBeVisible()

    await expect(page.getByText('Total Tracked Tests').locator('..').getByText('3')).toBeVisible()

    const progress = await storedProgress(page)

    expect(progress.map((item) => `${item.suite}/${item.name}:${item.status}`).sort()).toEqual([
      'Suite A/test3:pending',
      'Suite B/test3:pending',
      'Suite C/test1:pending',
    ])

    await expect(page.evaluate(() => localStorage.getItem('testFixProgress_structureHash'))).resolves.toBeNull()
  })

  test('should keep progress saved before results hashes existed when the same XML is loaded again', async ({ page }) => {
    await completeFirstFailureOnProgressTab(page)

    const progressBefore = await storedProgress(page)

    await leaveOnlyTheOlderStructureHash(page)

    await page.reload()

    await chooseFile(page, 'Select File', './spec/testfiles/sample.xml')

    await page.getByRole('button', { name: 'Progress' }).click()

    await expect(page.getByRole('heading', { name: 'Failure Resolution Progress' })).toBeVisible()

    await expect(page.getByText('Total Tracked Tests').locator('..').getByText('4')).toBeVisible()

    await expect(page.getByText(CLEARED_TOAST)).toHaveCount(0)

    expect(await storedProgress(page)).toEqual(progressBefore)

    // From here on the progress is tied to this file by its results hash.
    await expect(page.evaluate(() => localStorage.getItem('testFixProgress_resultsHash'))).resolves.not.toBeNull()
  })
})
