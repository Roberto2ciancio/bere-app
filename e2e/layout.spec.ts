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

/** Prima configurazione già fatta: altrimenti l'app di prova si apre su «Passo 1 di 7». */
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
  /** Obiettivo giornaliero in ml. */
  goalMl?: number
  /** Nessun promemoria salvato. */
  noSchedules?: boolean
  /** Ora fissa dell'app (ISO con fuso): le reazioni di Glu dipendono dall'ora del giorno. */
  at?: string
  /** Ultima bevuta di oggi tante ore fa (sete di Glu). */
  lastDrinkHoursAgo?: number
  /** Caffè preso tanti minuti fa (Glu agitato). */
  coffeeMinutesAgo?: number
  /** Giorni di fila a obiettivo fino a ieri (corona di Glu). */
  streak?: number
  /** Verifica 3D salvata: 'ok' per Glu 3D; di default «niente WebGL», così le misure restano sul Glu 2D. */
  glu3d?: 'ok'
}

/** Apre l'app di prova senza popup delle novità, dopo aver preparato il finto database. */
async function openApp(page: Page, path: string, setup: Setup = {}) {
  await skipOnboarding(page)
  if (setup.at) await page.clock.setFixedTime(new Date(setup.at))
  // Mai il meteo vero nei test.
  await page.route(/open-meteo\.com/, (route) => route.fulfill({ json: { daily: { temperature_2m_max: [31] } } }))
  await page.addInitScript(
    ({ version, glu3d }) => {
      localStorage.setItem('bere.seenVersion', version)
      localStorage.setItem('bere.newsRead', version)
      // L'app di prova mette «dev.» davanti alle sue chiavi (storageKey).
      localStorage.setItem('dev.bere.glu3dCheck', JSON.stringify({ result: glu3d === 'ok' ? 'ok' : 'nowebgl', version }))
    },
    { version: VERSION, glu3d: setup.glu3d },
  )
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
      if (setup.noSchedules) db.tables.schedules = []
      if (setup.goalMl) db.tables.goal_changes.forEach((g) => (g.goal_ml = setup.goalMl))
      db.tables.goal_boosts = Object.entries(setup.boosts ?? {}).map(([kind, ml]) => ({
        user_id: profile.id,
        local_date: today,
        kind,
        extra_ml: ml,
        note: kind === 'heat' ? '31 °C' : null,
      }))
      // Bevute, caffè e giorni passati, per far reagire Glu (la data di oggi è quella dell'ora fissa, se c'è).
      const day = (back: number) => new Date(Date.now() - back * 86_400_000).toLocaleDateString('sv-SE')
      const drinks = (db.tables.drinks ??= [])
      const drink = (id: string, at: number, local_date: string) =>
        drinks.push({ user_id: profile.id, client_id: id, amount_ml: 200, drink_type: 'water', hydration_pct: 100, drunk_at: new Date(at).toISOString(), local_date })
      if (setup.lastDrinkHoursAgo !== undefined) drink('e2e-last', Date.now() - setup.lastDrinkHoursAgo * 3_600_000, today)
      for (let i = 1; i <= (setup.streak ?? 0); i++) {
        drinks.push({ user_id: profile.id, client_id: `e2e-day${i}`, amount_ml: 5000, drink_type: 'water', hydration_pct: 100, drunk_at: new Date(Date.now() - i * 86_400_000).toISOString(), local_date: day(i) })
      }
      if (setup.coffeeMinutesAgo !== undefined) {
        const cups = (db.tables.caffeine_intakes ??= [])
        cups.push({ user_id: profile.id, client_id: 'e2e-coffee', kind: 'coffee', mg: 80, taken_at: new Date(Date.now() - setup.coffeeMinutesAgo * 60_000).toISOString(), local_date: today })
      }
      localStorage.setItem(key, JSON.stringify(db))
    },
    { key: DB_KEY, setup },
  )
  await page.goto(`./#${path}`)
  await page.reload()
  // Dopo il ricaricamento l'app si disegna un attimo dopo: si misura solo quando c'è.
  await expect(page.getByRole('navigation', { name: 'Sezioni' })).toBeVisible()
  if (path === '/home') await expect(page.locator('.home-view')).toBeVisible()
  await waitForSettled(page)
}

/**
 * Aspetta la fine delle animazioni di ingresso (Stagger e PageTransition): finché girano, i riquadri
 * misurati includono lo spostamento e sulle macchine lente le posizioni sono sfalsate di qualche pixel.
 * Quelle infinite (onde, Glu) si ignorano; la pagina che entra usa Motion (non sempre visibile a getAnimations), quindi si controlla anche il suo transform (non quello dei discendenti: l'anello, per esempio, è ruotato di proposito).
 */
async function waitForSettled(page: Page) {
  await page.waitForFunction(() => {
    const running = document.getAnimations().some((a) => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity)
    const moved = [...document.querySelectorAll('.page-transition')].some((el) => {
      const t = getComputedStyle(el).transform
      return t !== 'none' && t !== 'matrix(1, 0, 0, 1, 0, 0)'
    })
    return !running && !moved
  })
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
  await waitForSettled(page)
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
        // Dentro un disegno SVG conta il disegno intero: i suoi gruppi misurano anche l'onda di Glu, ritagliata dalla goccia.
        if (el.closest('svg') !== el && el.closest('svg')) return false
        // Tagliato da un contenitore (per esempio l'onda dell'acqua dentro la bottiglia): a schermo non esce.
        for (let parent = el.parentElement; parent && !parent.classList.contains('shell-body'); parent = parent.parentElement) {
          const style = getComputedStyle(parent)
          if (/hidden|clip/.test(style.overflowX) && parent.getBoundingClientRect().right <= width + 1) return false
        }
        return true
      })
      .slice(0, 3)
      .map((el) => `${el.tagName.toLowerCase()}.${el.getAttribute('class')} «${(el.textContent ?? '').trim().slice(0, 30)}»`)
  })
  expect(outside, 'elementi oltre il bordo destro').toEqual([])
}

/** In alto, senza scorrere: «Ho bevuto» e «+» si vedono interi, sopra la barra in basso. */
async function expectActionsAboveTabs(page: Page) {
  await page.locator('.shell-body').evaluate((el) => (el.scrollTop = 0))
  const tabs = (await box(page, 'nav.tabs'))!
  for (const selector of ['button.drink', 'button.drink-more']) {
    const b = (await box(page, selector))!
    expect(b.top, `${selector} esce sopra lo schermo`).toBeGreaterThanOrEqual(0)
    expect(b.bottom, `${selector} finisce sotto la barra`).toBeLessThanOrEqual(tabs.top + 1)
  }
}

/** Aree di tocco di almeno 44 px per tutto ciò che si tocca nella schermata Oggi. */
async function expectTouchTargets(page: Page) {
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('.home a, .home button')]
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && (r.width < 43.5 || r.height < 43.5))
      .map(({ el, r }) => `${el.getAttribute('class')} ${Math.round(r.width)}×${Math.round(r.height)}`),
  )
  expect(small, 'aree di tocco sotto i 44 px').toEqual([])
}

/**
 * I blocchi della schermata Oggi, dall'alto in basso, non si sovrappongono e il disegno resta nel suo spazio.
 * Le azioni sono ancorate in basso: si misura a pagina scorsa fino in fondo, dove tornano al loro posto.
 */
async function expectHomeInOrder(page: Page) {
  await waitForSettled(page)
  await expectActionsAboveTabs(page)
  await expectTouchTargets(page)
  await page.locator('.shell-body').evaluate((el) => (el.scrollTop = el.scrollHeight))
  // Tutto nello stesso istante: dopo una bevuta il fumetto cambia frase (e altezza) da solo.
  const { view, art, ring } = await page.evaluate(() => {
    const measure = (selector: string) => {
      const el = document.querySelector(selector)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }
    }
    return { view: measure('.home-view'), art: measure('.glu-box'), ring: measure('.progress-ring') }
  })
  expect(view, 'manca lo spazio della vista').not.toBeNull()
  expect(art, "manca l'illustrazione").not.toBeNull()
  expect(art!.top, "l'illustrazione esce sopra il suo spazio").toBeGreaterThanOrEqual(view!.top - 1)
  expect(art!.bottom, "l'illustrazione esce sotto il suo spazio").toBeLessThanOrEqual(view!.bottom + 1)
  // Lo stile Anello è già un anello: lì non c'è quello del progresso.
  if (ring) {
    expect(ring.top, "l'anello esce sopra il suo spazio").toBeGreaterThanOrEqual(view!.top - 1)
    expect(ring.bottom, "l'anello esce sotto il suo spazio").toBeLessThanOrEqual(view!.bottom + 1)
  }

  const order = ['.home-head', '.glu-bubble', '.progress-ring', '.home-stats', '.home-tiles', '.home-reminders', '.home-undos', '.drink-row']
  let previous: { selector: string; bottom: number } | null = null
  for (const selector of order) {
    const b = await box(page, selector)
    if (!b || b.bottom - b.top < 1) continue
    if (previous) expect(b.top, `${selector} si sovrappone a ${previous.selector}`).toBeGreaterThanOrEqual(previous.bottom - 1)
    previous = { selector, bottom: b.bottom }
  }
  // In fondo alla pagina l'ultima azione resta sopra la barra.
  const tabs = (await box(page, 'nav.tabs'))!
  expect(previous!.bottom, 'le azioni finiscono sotto la barra').toBeLessThanOrEqual(tabs.top + 1)

  // Il pulsante della Newsletter non copre il titolo.
  const icon = await box(page, '.news-icon')
  const title = await box(page, '.home-head h1')
  if (icon && title) {
    const overlaps = icon.right > title.left && icon.left < title.right && icon.bottom > title.top && icon.top < title.bottom
    expect(overlaps, 'la Newsletter copre il titolo').toBe(false)
  }
}

/** Con la tastiera (Tab) il controllo raggiunto non finisce sotto le azioni ancorate in basso (WCAG 2.4.11). */
async function expectFocusNotCovered(page: Page, browserName: string) {
  // Safari con Tab salta i pulsanti, e WebKit dei test non simula Opzione+Tab: si prova sui progetti Chromium
  // (tra cui 320×640 al 130%); scroll-margin vale uguale in tutti i motori.
  if (browserName === 'webkit') return
  await page.locator('.shell-body').evaluate((el) => (el.scrollTop = 0))
  await page.locator('.caffeine-tile').focus()
  for (const selector of ['.workout-tile', '.home-reminders']) {
    await page.keyboard.press('Tab')
    await expect(page.locator(selector)).toBeFocused()
    // Lo scorrimento dovuto al focus può essere animato: si misura quando si è fermato.
    await expect
      .poll(async () => {
        const target = (await box(page, selector))!
        const actions = (await box(page, '.home-actions'))!
        return Math.round(target.bottom - actions.top)
      }, { message: `${selector} finisce sotto le azioni` })
      .toBeLessThanOrEqual(1)
  }
}

// Le 15:00 di un giorno qualsiasi a Roma: sveglio, e abbastanza tardi perché «4 ore fa» sia dopo le 8:00.
const AFTERNOON = '2026-11-11T15:00:00+01:00'

const ALL_DAY = { active_split: true, active_start_min: 0, active_end_min: 1440 }

test.describe('Oggi', () => {
  test('così come si apre', async ({ page, browserName }) => {
    await openApp(page, '/home')
    await expect(page.getByRole('heading', { level: 1, name: 'Oggi' })).toBeVisible()
    await expect(page.getByRole('button', { name: "Annulla l'ultima" })).toHaveCount(0)
    await expectFocusNotCovered(page, browserName)
    await expectHomeInOrder(page)
    await expectNoHorizontalScroll(page)
  })

  // Le reazioni di Glu non devono spingere niente fuori posto, da 320 px e col testo al 130%.
  const reactions: [string, Setup, string][] = [
    ['sete forte', { at: AFTERNOON, noSchedules: true, lastDrinkHoursAgo: 4 }, '.glu-fan'],
    ['allenamento', { at: AFTERNOON, noSchedules: true, lastDrinkHoursAgo: 1, boosts: { workout: 500 } }, '.glu-headband'],
    ['serie di 7 giorni', { at: AFTERNOON, noSchedules: true, lastDrinkHoursAgo: 1, streak: 7 }, '.glu-crown'],
  ]
  for (const [name, setup, part] of reactions) {
    test(`Glu con ${name}`, async ({ page }) => {
      await openApp(page, '/home', setup)
      await expect(page.locator(part)).toHaveCount(1)
      await expectHomeInOrder(page)
      await expectNoHorizontalScroll(page)
    })
  }

  test('con tutto acceso: fascia attiva, caldo, allenamento e «Annulla»', async ({ page, browserName }) => {
    await openApp(page, '/home', { profile: ALL_DAY, boosts: { heat: 500, workout: 500 } })
    await page.getByRole('button', { name: /Ho bevuto/ }).click()
    await page.getByRole('button', { name: /^Caffè/ }).click()
    await expect(page.getByText(/per il caldo/)).toBeVisible()
    await expect(page.getByRole('button', { name: "Annulla l'ultima" })).toBeVisible()
    await expectFocusNotCovered(page, browserName)
    await expectHomeInOrder(page)
    await expectNoHorizontalScroll(page)
  })
})

test('la festa dell’obiettivo sta nello schermo', async ({ page }) => {
  await openApp(page, '/home', { goalMl: 200 })
  await page.getByRole('button', { name: /Ho bevuto/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Obiettivo raggiunto!' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('aria-modal', 'true')
  await expect(page.getByRole('button', { name: 'Evviva!' })).toBeFocused()
  const viewport = page.viewportSize()!
  // Il pannello sale dal basso: si misura quando è arrivato.
  await expect.poll(async () => {
    const b = (await dialog.boundingBox())!
    return Math.round(b.y + b.height)
  }).toBeLessThanOrEqual(viewport.height + 1)
  const b = (await dialog.boundingBox())!
  expect(b.y).toBeGreaterThanOrEqual(0)
  expect(b.x).toBeGreaterThanOrEqual(0)
  expect(b.x + b.width).toBeLessThanOrEqual(viewport.width + 1)
  // Ancorato in basso: tocca il fondo dello schermo.
  expect(b.y + b.height).toBeGreaterThanOrEqual(viewport.height - 1)
  await page.getByRole('button', { name: 'Evviva!' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('button', { name: /Ho bevuto/ })).toBeFocused()
})

const PAGES = [
  ['Storico', '/storico', 'Storico'],
  ['Calendario', '/storico/calendario', 'Calendario'],
  ['Classifica', '/classifica', 'Classifica'],
  ['Profilo', '/profilo', 'Profilo'],
  ['Obiettivo', '/profilo/obiettivo', 'Obiettivo'],
  ['Avvisi', '/profilo/avvisi', 'Promemoria e notifiche'],
  ['Bevute', '/profilo/bevute', 'Bevute e tazze'],
  ['Aspetto', '/profilo/aspetto', 'Aspetto e Glu'],
  ['Account', '/profilo/account', 'Account e privacy'],
  ['Aiuto', '/profilo/aiuto', 'Aiuto e suggerimenti'],
  ['Newsletter', '/novita', 'Newsletter'],
  ['Promemoria', '/promemoria', null],
  ['Tazze e bevande', '/tazze', null],
  ['Suggerimenti', '/feedback', null],
  ['Privacy', '/privacy', null],
  ['Segnala', '/segnala', 'Segnala'],
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

test('Storico: «Condividi la settimana» sta nello schermo e prepara il PNG', async ({ page, browserName }, testInfo) => {
  await openApp(page, '/storico', { streak: 5 })
  const button = page.getByRole('button', { name: 'Condividi la settimana' })
  await button.scrollIntoViewIfNeeded()
  await expect(button).toBeVisible()
  const b = (await button.boundingBox())!
  expect(b.height, 'area di tocco sotto i 44 px').toBeGreaterThanOrEqual(43.5)
  await expectNoHorizontalScroll(page)
  // Chromium dei test non condivide file: l'immagine si scarica. WebKit lo provano i telefoni veri.
  if (browserName !== 'chromium') return
  const [download] = await Promise.all([page.waitForEvent('download'), button.click()])
  expect(download.suggestedFilename()).toBe('bere-settimana.png')
  const file = await download.path()
  const png = readFileSync(file)
  // Intestazione PNG e misure 1080×1350 (campo IHDR).
  expect(png.subarray(1, 4).toString()).toBe('PNG')
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1080, 1350])
  await expect(button).toBeEnabled()
  await expect(page.getByRole('alert')).toHaveCount(0)
  // Per guardarla: SHARE_SHOTS=cartella npx playwright test …
  if (process.env.SHARE_SHOTS) await download.saveAs(`${process.env.SHARE_SHOTS}/settimana-${testInfo.project.name.replace(/\W+/g, '-')}.png`)
})

test('Aspetto e Glu: «Il tuo Glu» sta nello schermo e Glu Menta arriva in Home', async ({ page }) => {
  // Tre giorni a obiettivo: 150 punti, livello 2 (Glu Menta sbloccato).
  await openApp(page, '/profilo/aspetto', { streak: 3 })
  const group = page.getByRole('radiogroup', { name: 'Il tuo Glu' })
  await group.scrollIntoViewIfNeeded()
  await expect(group.getByRole('radio')).toHaveCount(6)
  const menta = group.getByRole('radio', { name: /^Glu Menta/ })
  await expect(menta).not.toHaveAttribute('data-locked', 'true')
  await expectNoHorizontalScroll(page)
  // Aree di tocco di almeno 44 px.
  for (const radio of await group.getByRole('radio').all()) {
    const b = (await radio.boundingBox())!
    expect(Math.min(b.width, b.height), 'area di tocco sotto i 44 px').toBeGreaterThanOrEqual(43.5)
  }
  // Una bloccata dice quanto manca.
  await group.getByRole('radio', { name: /^Glu Limone/ }).click()
  await expect(page.getByText('Ti mancano 150 punti al livello 3.')).toBeVisible()
  await menta.click()
  await expect(menta).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('navigation', { name: 'Sezioni' }).getByRole('link', { name: 'Oggi' }).click()
  await expect(page.locator('.home-view [data-testid="glu"]').first()).toHaveAttribute('data-variant', 'menta')
})

const SECTIONS = [
  ['Obiettivo', 'obiettivo'],
  ['Promemoria e notifiche', 'avvisi'],
  ['Bevute e tazze', 'bevute'],
  ['Aspetto e Glu', 'aspetto'],
  ['Account e privacy', 'account'],
  ['Aiuto e suggerimenti', 'aiuto'],
] as const

test('Profilo → voce → «‹ Profilo»: la linguetta Profilo resta accesa', async ({ page }) => {
  await openApp(page, '/profilo')
  const tab = page.getByRole('navigation', { name: 'Sezioni' }).getByRole('link', { name: 'Profilo' })
  for (const [title, slug] of SECTIONS) {
    await page.getByRole('link', { name: new RegExp(`^${title}`) }).click()
    await expect(page).toHaveURL(new RegExp(`#/profilo/${slug}$`))
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
    await expect(tab).toHaveClass(/active/)
    await page.getByRole('link', { name: '‹ Profilo' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Profilo' })).toBeVisible()
  }
  // L'avatar porta ad «Aspetto e Glu».
  await page.getByRole('link', { name: 'Cambia avatar e aspetto' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Aspetto e Glu' })).toBeVisible()
})

test('dalle pagine di dettaglio si torna alla voce giusta', async ({ page }) => {
  await openApp(page, '/profilo/bevute')
  await page.getByRole('link', { name: 'Tazze e bevande' }).click()
  await page.getByRole('link', { name: '‹ Bevute e tazze' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Bevute e tazze' })).toBeVisible()
  await page.goto('./#/profilo/avvisi')
  await page.getByRole('link', { name: 'Gestisci i promemoria' }).click()
  await page.getByRole('link', { name: '‹ Promemoria e notifiche' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Promemoria e notifiche' })).toBeVisible()
})

test('senza promemoria Glu è compatto e gli orari del modulo restano sopra la barra', async ({ page }) => {
  await openApp(page, '/promemoria', { noSchedules: true })
  await expect(page.getByTestId('glu')).toBeVisible()
  // Il modulo è lungo di suo: Glu non deve portare gli orari (Dalle/Alle) sotto la barra delle sezioni.
  const field = page.locator('.hours-pair input, .interval-window input').first()
  await expect(field).toBeVisible()
  const fieldBox = (await field.boundingBox())!
  const nav = (await box(page, 'nav[aria-label="Sezioni"]'))!
  expect(fieldBox.y + fieldBox.height).toBeLessThanOrEqual(nav.top)
})

test('primo avvio: ogni passo sta nello schermo e con «Salta» si arriva alla Home', async ({ page }) => {
  await page.addInitScript((version) => {
    localStorage.setItem('bere.seenVersion', version)
    localStorage.setItem('bere.newsRead', version)
  }, VERSION)
  await page.goto('./#/inizia')
  const viewport = page.viewportSize()!
  const seen: string[] = []
  for (let guard = 0; guard < 10 && !page.url().endsWith('/home'); guard++) {
    const bar = page.getByRole('progressbar')
    await expect(bar.or(page.getByRole('button', { name: /Ho bevuto/ }))).toBeVisible()
    if (!(await bar.isVisible())) break
    seen.push((await bar.getAttribute('aria-label'))!)
    await page.waitForTimeout(300)
    await expectNoHorizontalScroll(page)
    const primary = page.locator('.ob-actions .primary')
    await expect(primary).toBeVisible()
    const box = (await primary.boundingBox())!
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1)
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)
    const skip = page.getByRole('button', { name: 'Salta', exact: true })
    await (((await skip.count()) > 0 ? skip : primary).click())
  }
  expect(seen.length).toBeGreaterThanOrEqual(6)
  await expect(page.getByRole('button', { name: /Ho bevuto/ })).toBeVisible()
})

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
