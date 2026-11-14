// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { challengePayload, eveningPayload, goalAlertPayload, nudgePayload, runSocial, weeklyPayload, type GoalAlertRow, type NudgeRow, type SocialDeps, type WeeklyRow } from './social.ts'

const sub = (id: string) => ({ id, endpoint: `https://push/${id}`, p256dh: 'k', auth: 'a' })
const alert = (over: Partial<GoalAlertRow> = {}): GoalAlertRow => ({ event_id: 'e1', achiever: 'Anna', to_user: 'b', token: 't1', subscriptions: [sub('b1')], ...over })
const nudge = (over: Partial<NudgeRow> = {}): NudgeRow => ({ user_id: 'a', display_name: 'Anna', days_away: 1, stage: 0, goal_ml: 2700, subscriptions: [sub('a1')], ...over })

function deps(over: Partial<SocialDeps> = {}) {
  return {
    takeGoalAlerts: vi.fn(async () => [alert()]),
    takeNudges: vi.fn(async () => [nudge()]),
    takeEveningSummaries: vi.fn(async () => []),
    takeWeeklyReports: vi.fn(async () => []),
    takeChallengeAlerts: vi.fn(async () => []),
    push: vi.fn(async () => 201),
    removeSubscription: vi.fn(async () => {}),
    touchSubscription: vi.fn(async () => {}),
    ...over,
  }
}

describe('avviso obiettivo raggiunto', () => {
  it('dice chi ce l’ha fatta e porta il biglietto per i complimenti', () => {
    expect(goalAlertPayload(alert())).toEqual({
      title: "🎉 Anna ha raggiunto l'obiettivo di oggi",
      body: 'Tocca «Complimenti» per farglielo sapere 👏',
      url: '#/classifica',
      logId: '',
      cheerToken: 't1',
    })
  })
})

describe('promemoria a chi non apre l’app', () => {
  it('usa nome e obiettivo, e cambia tono a ogni passo', () => {
    expect(nudgePayload(nudge())).toMatchObject({ title: 'Anna, da ieri non ti vediamo 💧', body: "Un bicchiere d'acqua adesso? Il tuo obiettivo è 2,7 L al giorno." })
    expect(nudgePayload(nudge({ stage: 1, days_away: 3 })).title).toBe('Anna, sono 3 giorni che non segni niente')
    expect(nudgePayload(nudge({ stage: 2, days_away: 7 })).title).toBe('Ci manchi, Anna 💧')
    expect(nudgePayload(nudge()).logId).toBe('')
  })
})

describe('runSocial', () => {
  it('manda avvisi e promemoria ai dispositivi giusti', async () => {
    const d = deps()
    expect(await runSocial(d)).toEqual({ alerts: 1, nudges: 1, evenings: 0, weeklies: 0, challenges: 0 })
    expect(d.push).toHaveBeenCalledWith(sub('b1'), expect.objectContaining({ cheerToken: 't1' }))
    expect(d.push).toHaveBeenCalledWith(sub('a1'), expect.objectContaining({ title: 'Anna, da ieri non ti vediamo 💧' }))
  })

  it('se una lettura fallisce, l’altra parte va avanti', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const d = deps({ takeGoalAlerts: vi.fn(async () => { throw new Error('giù') }) })
    expect(await runSocial(d)).toEqual({ alerts: 0, nudges: 1, evenings: 0, weeklies: 0, challenges: 0 })
  })

  it('senza dispositivi non manda nulla', async () => {
    const d = deps({ takeGoalAlerts: vi.fn(async () => [alert({ subscriptions: null })]), takeNudges: vi.fn(async () => []) })
    expect(await runSocial(d)).toEqual({ alerts: 0, nudges: 0, evenings: 0, weeklies: 0, challenges: 0 })
    expect(d.push).not.toHaveBeenCalled()
  })
})

describe('riepilogo serale', () => {
  it("dice com'è andata e quanto è mancato", () => {
    expect(eveningPayload({ user_id: 'a', display_name: 'Anna', drunk_ml: 2400, goal_ml: 3000, subscriptions: [] })).toEqual({
      title: 'Anna, oggi 2,4 L su 3 L',
      body: 'Ti sono mancati 600 ml: domani recuperi? 💧',
      url: '#/storico',
      logId: '',
    })
  })
})

describe('resoconto del lunedì', () => {
  const week = (over: Partial<WeeklyRow> = {}): WeeklyRow => ({
    user_id: 'a', display_name: 'Anna', week_start: '2026-11-02', days_met: 5, average_ml: 2430, rank: 2, players: 4, subscriptions: [], ...over,
  })
  it('giorni a obiettivo, media e posto in classifica', () => {
    expect(weeklyPayload(week())).toMatchObject({ title: 'La tua settimana: 5 giorni su 7 a obiettivo', body: 'Media 2,4 L al giorno · 2° posto su 4 in classifica. Buona settimana!' })
  })
  it('festeggia la settimana perfetta e incoraggia quella vuota', () => {
    expect(weeklyPayload(week({ days_met: 7 })).title).toBe('Settimana perfetta: 7 giorni su 7 🏆')
    expect(weeklyPayload(week({ days_met: 0, players: 1 }))).toMatchObject({ title: 'Nuova settimana, nuova occasione 💧', body: 'La scorsa: media 2,4 L al giorno. Si riparte da oggi!' })
  })
  it('runSocial manda anche riepiloghi e resoconti', async () => {
    const d = deps({ takeGoalAlerts: vi.fn(async () => []), takeNudges: vi.fn(async () => []), takeWeeklyReports: vi.fn(async () => [week({ subscriptions: [sub('w')] })]) })
    expect(await runSocial(d)).toEqual({ alerts: 0, nudges: 0, evenings: 0, weeklies: 1, challenges: 0 })
  })
})

describe('pausa', () => {
  it('chi è in pausa non riceve avvisi sociali', async () => {
    const d = deps({ paused: async () => new Set(['a', 'b']) })
    expect(await runSocial(d)).toEqual({ alerts: 0, nudges: 0, evenings: 0, weeklies: 0, challenges: 0 })
    expect(d.push).not.toHaveBeenCalled()
  })

  it('gli altri li ricevono', async () => {
    const d = deps({ paused: async () => new Set(['a']) })
    expect(await runSocial(d)).toEqual({ alerts: 1, nudges: 0, evenings: 0, weeklies: 0, challenges: 0 })
  })
})

describe('avvisi delle sfide', () => {
  it('a chi è sfidato e a chi ha sfidato, quando accetta', async () => {
    const d = deps({
      takeGoalAlerts: vi.fn(async () => []),
      takeNudges: vi.fn(async () => []),
      takeChallengeAlerts: vi.fn(async () => [
        { kind: 'new' as const, to_user: 'a', other_name: 'Bruno', subscriptions: [sub('c1')] },
        { kind: 'accepted' as const, to_user: 'b', other_name: 'Anna', subscriptions: [sub('c2')] },
      ]),
    })
    expect(await runSocial(d)).toMatchObject({ challenges: 2 })
    const titles = d.push.mock.calls.map((call) => (call[1] as { title: string }).title)
    expect(titles).toEqual(expect.arrayContaining(['⚔️ Bruno ti sfida', '⚔️ Anna ha accettato la sfida']))
  })

  it('il testo della sfida nuova invita ad accettare', () => {
    expect(challengePayload({ kind: 'new', to_user: 'a', other_name: ' ', subscriptions: null })).toMatchObject({ title: '⚔️ Un amico ti sfida', url: '#/classifica' })
  })
})
