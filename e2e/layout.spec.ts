import { test as base, expect, type Page } from '@playwright/test'

/**
 * textScale simula «Dimensione carattere» di Android (1 = normale, 1.3 = 130%): ingrandisce il testo,
 * non la pagina. Si imposta per progetto nella configurazione: use: { textScale: 1.3 }.
 */
const test = base.extend<{ textScale: number }>({
  textScale: [1, { option: true }],
  page: async ({ page, textScale }, provide) => {
    if (textScale !== 1) {
      await page.addInitScript((scale) => {
        const css = `html{font-size:${scale * 100}% !important}body,input,select,textarea{font-size:${16 * scale}px !important}`
        const add = () => document.head.append(Object.assign(document.createElement('style'), { textContent: css }))
        if (document.head) add()
        else document.addEventListener('DOMContentLoaded', add)
      }, textScale)
    }
    await provide(page)
  },
})
import { readFileSync } from 'node:fs'

const VERSION = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version
const DB_KEY = 'dev.bere.dev.db'
const DEV_USER = '00000000-0000-4000-8000-00000000de00'

/** Prima configurazione già fatta: altrimenti l'app di prova si apre su «Passo 1 di 3». */
async function skipOnboarding(page: Page) {
  await page.addInitScript((user) => localStorage.setItem(`dev.bere.onboarded.${user}`, 'true'), DEV_USER)
}

interface Profile {
  [key: string]: unknown
}

/** Cosa cambiare nel finto database prima di aprire la pagina. */
interface Setup {
  profile?: Profile
  /** Aumenti dell'obiettivo di oggi: tipo → ml. */
  boosts?: Record<string, number>
}

/** Apre l'app di prova senza popup delle novità, dopo aver preparato il finto database. */
async function openApp(page: Page, path: string, setup: Setup = {}) {
  await skipOnboarding(page)
  // Mai il meteo vero nei test.
  await page.route(/open-meteo\.com/, (route) => route.fulfill({ json: { daily: { temperature_2m_max: [31] } } }))
  await page.addInitScript((version) => {
    localStorage.setItem('bere.seenVersion', version)
    localStorage.setItem('bere.newsRead', version)
  }, VERSION)
  await page.goto('./#/home')
  await expect(page.getByRole('button', { name: /Ho bevuto/ })).toBeVisible()
  // Si modifica il finto database da una pagina senza l'app: l'app aperta potrebbe riscriverlo subito dopo.
  await page.goto('./favicon.svg')
  await page.evaluate(
    ({ key, setup }) => {
      const db = JSON.parse(localStorage.getItem(key) ?? 'null') as { tables: Record<string, Record<string, unknown>[]> }
      const profile = db.tables.profiles[0]
      Object.assign(profile, setup.profile ?? {})
      const today = new Date().toLocaleDateString('sv-SE')
      // Con un aumento per il caldo serve il caldo acceso, altrimenti l'app (giustamente) lo toglie.
      if (setup.boosts?.heat) {
        Object.assign(profile, { heat_boost: true, city_name: 'Roma (Lazio)', city_lat: 41.9, city_lon: 12.5 })
        localStorage.setItem(`bere.heatChecked.${profile.id}`, `${today}:41.9,12.5`)
      }
      db.tables.goal_boosts = Object.entries(setup.boosts ?? {}).map(([kind, ml]) => ({
        user_id: profile.id,
        local_date: today,
        kind,
        extra_ml: ml,
        note: kind === 'heat' ? '31 °C' : null,
      }))
      localStorage.setItem(key, JSON.stringify(db))
    },
    { key: DB_KEY, setup },
  )
  await page.goto(`./#${path}`)
  await page.reload()
  // Dopo il ricaricamento l'app si disegna un attimo dopo: si misura solo quando c'è.
  await expect(page.getByRole('navigation', { name: 'Sezioni' })).toBeVisible()
  if (path === '/home') await expect(page.locator('.home-view')).toBeVisible()
}

type Box = { top: number; bottom: number; left: number; right: number }

async function box(page: Page, selector: string): Promise<Box | null> {
  const locator = page.locator(selector).first()
  if ((await locator.count()) === 0) return null
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }
  })
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
  // Anche dentro le card: nessun elemento visibile oltre il bordo destro dello schermo.
  const outside = await page.evaluate(() => {
    const width = document.documentElement.clientWidth
    return [...document.querySelectorAll('.shell-body *')]
      .filter((el) => {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0 || r.right <= width + 1 || getComputedStyle(el).visibility === 'hidden') return false
        // Tagliato da un contenitore (per esempio l'onda dell'acqua dentro la bottiglia): a schermo non esce.
        for (let parent = el.parentElement; parent && !parent.classList.contains('shell-body'); parent = parent.parentElement) {
          const style = getComputedStyle(parent)
          if (/hidden|clip/.test(style.overflowX) && parent.getBoundingClientRect().right <= width + 1) return false
        }
        return true
      })
      .slice(0, 3)
      .map((el) => `${el.tagName.toLowerCase()}.${el.className} «${(el.textContent ?? '').trim().slice(0, 30)}»`)
  })
  expect(outside, 'elementi oltre il bordo destro').toEqual([])
}

/** I blocchi della schermata Oggi, dall'alto in basso, non si sovrappongono e l'illustrazione resta nel suo spazio. */
async function expectHomeInOrder(page: Page) {
  const view = await box(page, '.home-view')
  const art = await box(page, '.bottle-box, .ring-box, .character-box, .drops')
  expect(view, 'manca lo spazio della vista').not.toBeNull()
  expect(art, "manca l'illustrazione").not.toBeNull()
  expect(art!.top, "l'illustrazione esce sopra il suo spazio").toBeGreaterThanOrEqual(view!.top - 1)
  expect(art!.bottom, "l'illustrazione esce sotto il suo spazio").toBeLessThanOrEqual(view!.bottom + 1)

  const order = ['.home-head', '.home-view', '.home-info', '.drink-row', '.caffeine', '.workout-tile', '.home-undos']
  let previous: { selector: string; bottom: number } | null = null
  for (const selector of order) {
    const b = await box(page, selector)
    if (!b || b.bottom - b.top < 1) continue
    if (previous) expect(b.top, `${selector} si sovrappone a ${previous.selector}`).toBeGreaterThanOrEqual(previous.bottom - 1)
    previous = { selector, bottom: b.bottom }
  }

  // L'icona della Newsletter non deve coprire il numero del totale.
  const icon = await box(page, '.news-icon')
  const total = await page.locator('.home-total').evaluate((el) => {
    const range = document.createRange()
    range.selectNodeContents(el)
    const r = range.getBoundingClientRect()
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }
  })
  if (icon) {
    const overlaps = icon.right > total.left && icon.left < total.right && icon.bottom > total.top && icon.top < total.bottom
    expect(overlaps, "l'icona della Newsletter copre il totale").toBe(false)
  }
}

const ALL_DAY = { active_split: true, active_start_min: 0, active_end_min: 1440 }

test.describe('Oggi', () => {
  test('così come si apre', async ({ page }) => {
    await openApp(page, '/home')
    await expectHomeInOrder(page)
    await expectNoHorizontalScroll(page)
  })

  test('con tutto acceso: fascia attiva, caldo, allenamento e «Annulla»', async ({ page }) => {
    await openApp(page, '/home', { profile: ALL_DAY, boosts: { heat: 500, workout: 500 } })
    await page.getByRole('button', { name: /Ho bevuto/ }).click()
    await page.getByRole('button', { name: /^Caffè/ }).click()
    await expect(page.getByText(/per il caldo/)).toBeVisible()
    await expect(page.getByRole('button', { name: "Annulla l'ultima" })).toBeVisible()
    await expectHomeInOrder(page)
    await expectNoHorizontalScroll(page)
  })

  for (const style of ['ring', 'character', 'drops']) {
    test(`stile ${style} con la fascia attiva`, async ({ page }) => {
      await openApp(page, '/home', { profile: { ...ALL_DAY, home_style: style } })
      await expectHomeInOrder(page)
      await expectNoHorizontalScroll(page)
    })
  }
})

const PAGES = [
  ['Storico', '/storico', 'Storico'],
  ['Calendario', '/storico/calendario', 'Calendario'],
  ['Classifica', '/classifica', 'Classifica'],
  ['Profilo', '/profilo', 'Profilo'],
  ['Newsletter', '/novita', 'Newsletter'],
  ['Promemoria', '/promemoria', null],
  ['Tazze e bevande', '/tazze', null],
  ['Suggerimenti', '/feedback', null],
  ['Privacy', '/privacy', null],
  ['Stato notifiche', '/notifiche', null],
] as const

for (const [name, path, heading] of PAGES) {
  test(`${name}: niente esce di lato`, async ({ page }) => {
    await openApp(page, path, { profile: { heat_boost: true, city_name: 'Reggio nell’Emilia (Emilia-Romagna)', city_lat: 44.7, city_lon: 10.6 } })
    if (heading) await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
    await page.waitForTimeout(300)
    await expectNoHorizontalScroll(page)
  })
}

test('il popup delle novità sta nello schermo', async ({ page }) => {
  await skipOnboarding(page)
  await page.addInitScript(() => localStorage.setItem('bere.seenVersion', '1.0.0'))
  await page.goto('./#/home')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const b = (await dialog.boundingBox())!
  const viewport = page.viewportSize()!
  expect(b.y).toBeGreaterThanOrEqual(0)
  expect(b.y + b.height).toBeLessThanOrEqual(viewport.height + 1)
  expect(b.x + b.width).toBeLessThanOrEqual(viewport.width + 1)
  await page.getByRole('button', { name: 'Ho capito' }).click()
  await expect(dialog).toBeHidden()
})

test('con «riduci movimento» nessuna animazione gira', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iPhone SE ridotto', 'solo per il progetto con movimento ridotto')
  await openApp(page, '/home')
  await page.waitForTimeout(1000)
  const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length)
  expect(running).toBe(0)
})
