import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { GUIDE, PAGE_TIPS } from '../src/glu3d/help/guide'

/** Glu 3D dell'app di prova (Home e palcoscenico tra le schede): solo Chromium (il 3D su WebKit headless non è affidabile). */

const VERSION = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version
const DEV_USER = '00000000-0000-4000-8000-00000000de00'

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'Glu 3D si prova solo su Chromium')
})

/** Apre l'app senza primo avvio né novità; `check` è la verifica 3D salvata (null: nessuna). */
async function openHome(page: Page, check: 'ok' | 'nowebgl' | null, path = '#/home') {
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
  await page.goto(`./${path}`)
  if (path === '#/home') await expect(page.getByRole('button', { name: /Ho bevuto/ })).toBeVisible()
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

test('con la verifica 3D riuscita la Home mostra Glu 3D (nel palcoscenico), senza scorrimento laterale', async ({ page }) => {
  await openHome(page, 'ok')
  await expect(page.getByTestId('glu-stage').getByTestId('glu-3d')).toBeVisible()
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

type Box = { x: number; y: number; width: number; height: number }

const stageBox = (page: Page) => page.getByTestId('glu-stage-box')

/** Il riquadro di Glu a fine viaggio (smette di muoversi). */
async function settledBox(page: Page): Promise<Box> {
  let last: Box | null = null
  await expect(async () => {
    const box = (await stageBox(page).boundingBox())!
    const same = last && Math.abs(box.x - last.x) < 0.5 && Math.abs(box.y - last.y) < 0.5 && Math.abs(box.width - last.width) < 0.5
    last = box
    expect(same).toBe(true)
  }).toPass({ intervals: [150], timeout: 5000 })
  return last!
}

async function goTab(page: Page, name: string, hash: string) {
  await page.getByRole('navigation', { name: 'Sezioni' }).getByRole('link', { name }).click()
  await expect(page).toHaveURL(new RegExp(`${hash}$`))
}

/** Glu nel quarto in basso a destra, sopra la barra; nessun glu-corner; nessuno scorrimento laterale; ultima card sopra Glu. */
async function expectCorner(page: Page) {
  await expect(page.getByTestId('glu-stage')).toHaveCount(1)
  await expect(page.getByTestId('glu-stage')).toHaveAttribute('data-spot', 'corner')
  await expect(page.locator('.glu-corner')).toHaveCount(0)
  const box = await settledBox(page)
  const view = page.viewportSize()!
  const tabs = (await page.locator('.tabs').boundingBox())!
  expect(box.x, 'Glu nella metà destra').toBeGreaterThanOrEqual(view.width / 2)
  expect(box.x + box.width, 'Glu dentro lo schermo').toBeLessThanOrEqual(view.width)
  expect(box.y, 'Glu nella metà bassa').toBeGreaterThanOrEqual(view.height / 2)
  expect(box.y + box.height, 'Glu sopra la barra').toBeLessThanOrEqual(tabs.y + 0.5)
  // In fondo alla pagina l'ultima card resta sopra Glu.
  await page.evaluate(() => {
    const body = document.querySelector('.shell-body')!
    body.scrollTop = body.scrollHeight
  })
  await page.waitForTimeout(100)
  const cardBottom = await page.evaluate(() => {
    const cards = document.querySelectorAll('.shell-body main .card')
    const last = cards[cards.length - 1]
    return last ? last.getBoundingClientRect().bottom : null
  })
  expect(cardBottom, 'la pagina ha almeno una card').not.toBeNull()
  expect(cardBottom!, 'ultima card sopra Glu').toBeLessThanOrEqual(box.y)
  await page.evaluate(() => (document.querySelector('.shell-body')!.scrollTop = 0))
}

test('un solo Glu viaggia tra le schede: angolo sopra la barra, fuori scena nei dettagli, anello nella Home', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await openHome(page, 'ok')
  await expect(page.getByTestId('glu-stage')).toHaveCount(1)
  const ring = await settledBox(page)

  await goTab(page, 'Storico', '#/storico')
  await expectCorner(page)
  await expectNoHorizontalScroll(page)
  await goTab(page, 'Profilo', '#/profilo')
  await expectCorner(page)
  await expectNoHorizontalScroll(page)
  await goTab(page, 'Classifica', '#/classifica')
  await expectCorner(page)
  await expectNoHorizontalScroll(page)

  await goTab(page, 'Profilo', '#/profilo')
  await page.getByRole('link', { name: 'Gestisci i promemoria' }).click()
  await expect(page).toHaveURL(/#\/promemoria$/)
  await expect(page.getByTestId('glu-stage')).toHaveAttribute('data-spot', 'away')
  const away = await settledBox(page)
  expect(away.x, 'Glu fuori scena a destra').toBeGreaterThanOrEqual(320)
  await expectNoHorizontalScroll(page)

  await goTab(page, 'Oggi', '#/home')
  await expect(page.getByTestId('glu-stage')).toHaveAttribute('data-spot', 'ring')
  const back = await settledBox(page)
  const slot = (await page.getByTestId('glu-ring-slot').boundingBox())!
  expect(Math.abs(back.x - slot.x)).toBeLessThanOrEqual(2)
  expect(Math.abs(back.y - slot.y)).toBeLessThanOrEqual(2)
  expect(Math.abs(back.width - slot.width)).toBeLessThanOrEqual(2)
  expect(Math.abs(back.width - ring.width)).toBeLessThanOrEqual(2)
  await expect(page.getByTestId('glu-stage')).toHaveCount(1)
})

test('aprendo direttamente lo Storico col 3D il glu-corner non compare mai', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __cornerSeen: boolean }
    w.__cornerSeen = false
    new MutationObserver(() => {
      if (document.querySelector('.glu-corner')) w.__cornerSeen = true
    }).observe(document, { childList: true, subtree: true })
  })
  await openHome(page, 'ok', '#/storico')
  await expect(page.getByRole('heading', { name: 'Storico' })).toBeVisible()
  await expect(page.getByTestId('glu-stage')).toHaveAttribute('data-spot', 'corner')
  await page.waitForTimeout(300)
  expect(await page.evaluate(() => (window as unknown as { __cornerSeen: boolean }).__cornerSeen)).toBe(false)
})

test('senza 3D lo Storico ha il glu-corner di sempre e nessun palcoscenico', async ({ page }) => {
  await openHome(page, 'nowebgl', '#/storico')
  await expect(page.locator('.glu-corner')).toBeVisible()
  await expect(page.getByTestId('glu-stage')).toHaveCount(0)
})

// --- «Chiedi a Glu»: tocco su Glu e chat (guida offline) ---

const askGlu = (page: Page) => page.getByRole('button', { name: 'Glu, chiedi aiuto' })
const helpDialog = (page: Page) => page.getByRole('dialog', { name: 'Chiedi a Glu' })
const tipTitle = (id: string) => GUIDE.find((e) => e.id === id)!.title

/** Tocca Glu (fermo) e aspetta la chat. */
async function openHelp(page: Page) {
  await settledBox(page)
  await askGlu(page).click()
  await expect(helpDialog(page)).toBeVisible()
  await expect(helpDialog(page).getByRole('textbox', { name: 'La tua domanda' })).toBeFocused()
}

test('tocco su Glu nella Home: chat, domanda sull\'obiettivo, «Portami lì» apre il Profilo', async ({ page }) => {
  await openHome(page, 'ok')
  await openHelp(page)
  for (const id of PAGE_TIPS.home) await expect(helpDialog(page).getByRole('button', { name: tipTitle(id) })).toBeVisible()
  const input = helpDialog(page).getByRole('textbox', { name: 'La tua domanda' })
  await input.fill("come cambio l'obiettivo")
  await input.press('Enter')
  const log = helpDialog(page).getByRole('log')
  await expect(log.getByText("come cambio l'obiettivo")).toBeVisible()
  await expect(log.getByText(GUIDE.find((e) => e.id === 'goal-change')!.answer[0])).toBeVisible()
  await log.getByRole('button', { name: 'Portami lì' }).click()
  await expect(page).toHaveURL(/#\/profilo$/)
  await expect(helpDialog(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Profilo', level: 1 })).toBeVisible()
})

test('tocco su Glu nello Storico: i suggerimenti dello Storico; Esc chiude e il focus torna su Glu', async ({ page }) => {
  await openHome(page, 'ok', '#/storico')
  await expect(page.getByTestId('glu-stage')).toHaveAttribute('data-spot', 'corner')
  await openHelp(page)
  for (const id of PAGE_TIPS.storico) await expect(helpDialog(page).getByRole('button', { name: tipTitle(id) })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(helpDialog(page)).toHaveCount(0)
  await expect(askGlu(page)).toBeFocused()
})

for (const size of [{ width: 320, height: 640 }, { width: 320, height: 400 }]) {
  test(`chat a ${size.width}×${size.height}: campo e ultima risposta visibili, niente esce di lato`, async ({ page }) => {
    await page.setViewportSize(size)
    await openHome(page, 'ok', '#/storico')
    await expect(page.getByTestId('glu-stage')).toHaveAttribute('data-spot', 'corner')
    await openHelp(page)
    const input = helpDialog(page).getByRole('textbox', { name: 'La tua domanda' })
    for (const q of ['come funziona il salva-serie', 'come tolgo una bevuta']) {
      await input.fill(q)
      await input.press('Enter')
    }
    const last = helpDialog(page).locator('.help-msg').last()
    await expect(last).toBeInViewport()
    await expect(input).toBeInViewport({ ratio: 1 })
    const inputBox = (await input.boundingBox())!
    expect(inputBox.y + inputBox.height).toBeLessThanOrEqual(size.height)
    const overflow = await page.evaluate(() => {
      const sheet = document.querySelector('.help-sheet')!
      return { page: document.documentElement.scrollWidth - window.innerWidth, sheet: sheet.scrollWidth - sheet.clientWidth }
    })
    expect(overflow.page, 'la pagina scorre di lato').toBeLessThanOrEqual(1)
    expect(overflow.sheet, 'la chat esce di lato').toBeLessThanOrEqual(1)
  })
}

test('fuori dal riquadro di Glu i tocchi attraversano il palcoscenico', async ({ page }) => {
  await openHome(page, 'ok', '#/storico')
  const box = await settledBox(page)
  // Al centro di Glu c'è il suo pulsante; accanto, la pagina sotto il livello.
  const atGlu = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('aria-label'), { x: box.x + box.width / 2, y: box.y + box.height / 2 })
  expect(atGlu).toBe('Glu, chiedi aiuto')
  await goTab(page, 'Classifica', '#/classifica')
  await page.getByRole('navigation', { name: 'Sezioni' }).getByRole('link', { name: 'Storico' }).click()
  await expect(page).toHaveURL(/#\/storico$/)
  await expect(helpDialog(page)).toHaveCount(0)
})