import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

/** Glu 3D nella Home dell'app di prova: solo Chromium (il 3D su WebKit headless non è affidabile). */

const VERSION = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version
const DEV_USER = '00000000-0000-4000-8000-00000000de00'

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'Glu 3D si prova solo su Chromium')
})

/** Apre la Home senza primo avvio né novità; `check` è la verifica 3D salvata (null: nessuna). */
async function openHome(page: Page, check: 'ok' | null) {
  await page.route(/open-meteo\.com/, (route) => route.fulfill({ json: { daily: { temperature_2m_max: [31] } } }))
  await page.addInitScript(
    ({ user, version, check }) => {
      localStorage.setItem(`dev.bere.onboarded.${user}`, 'true')
      localStorage.setItem('bere.seenVersion', version)
      localStorage.setItem('bere.newsRead', version)
      // L'app di prova mette «dev.» davanti alle sue chiavi (storageKey).
      if (check) localStorage.setItem('dev.bere.glu3dCheck', JSON.stringify({ result: check, version }))
    },
    { user: DEV_USER, version: VERSION, check },
  )
  await page.goto('./#/home')
  await expect(page.getByRole('button', { name: /Ho bevuto/ })).toBeVisible()
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    const body = document.querySelector('.shell-body')
    return {
      page: document.documentElement.scrollWidth - window.innerWidth,
      body: body ? body.scrollWidth - body.clientWidth : 0,
    }
  })
  expect(overflow.page, 'la pagina scorre di lato').toBeLessThanOrEqual(1)
  expect(overflow.body, 'il contenuto esce di lato').toBeLessThanOrEqual(1)
}

test('con la verifica 3D riuscita la Home mostra Glu 3D, senza scorrimento laterale', async ({ page }) => {
  await openHome(page, 'ok')
  await expect(page.getByTestId('glu-3d')).toBeVisible()
  await expect(page.getByTestId('glu')).toHaveCount(0)
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 700 })
    await expect(page.getByTestId('glu-3d')).toBeVisible()
    await expectNoHorizontalScroll(page)
  }
})

test('senza WebGL la Home mostra Glu 2D e il 3D non compare mai', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type === 'webgl' || type === 'webgl2') return null
      return (original as (...args: unknown[]) => unknown).call(this, type, ...rest)
    } as typeof original
    const w = window as unknown as { __glu3dSeen: boolean }
    w.__glu3dSeen = false
    new MutationObserver(() => {
      if (document.querySelector('[data-testid="glu-3d"]')) w.__glu3dSeen = true
    }).observe(document, { childList: true, subtree: true })
  })
  await openHome(page, null)
  await expect(page.getByTestId('glu')).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { __glu3dSeen: boolean }).__glu3dSeen)).toBe(false)
})
