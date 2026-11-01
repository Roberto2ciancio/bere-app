import { supabase } from '../lib/supabase'

const PAGE = 1000
const BATCH = 200

type Row = Record<string, unknown>

/** Il server restituisce al massimo 1000 righe per volta: chi usa l'app da anni ne ha di più. */
async function allRows(table: string, userId: string): Promise<Row[]> {
  const rows: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('*').eq('user_id', userId).range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...((data ?? []) as Row[]))
    if ((data ?? []).length < PAGE) return rows
  }
}

export async function exportData(userId: string) {
  const [drinks, caffeine_intakes, cups, drink_types, goal_changes, schedules] = await Promise.all(
    ['drinks', 'caffeine_intakes', 'cups', 'drink_types', 'goal_changes', 'schedules'].map((table) => allRows(table, userId)),
  )
  return { version: 1, exported_at: new Date().toISOString(), drinks, caffeine_intakes, cups, drink_types, goal_changes, schedules }
}

const csvCell = (value: unknown) => {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function toCsv(drinks: Row[]): string {
  const rows = drinks.map((d) => [d.local_date, d.drunk_at, d.drink_type ?? 'water', d.amount_ml, d.hydration_pct ?? 100].map(csvCell).join(','))
  return ['data,ora,bevanda,ml,percentuale', ...rows].join('\n')
}

const invalid = () => new Error('Questo file non è una copia valida di Bere')

function listOf(backup: Row, key: string, isValid: (row: Row) => boolean): Row[] {
  const list = backup[key] ?? []
  if (!Array.isArray(list) || !list.every((row) => row && typeof row === 'object' && isValid(row as Row))) throw invalid()
  return list as Row[]
}

async function upsertNew(table: string, rows: Row[]) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + BATCH), { onConflict: 'user_id,client_id', ignoreDuplicates: true })
    if (error) throw new Error(error.message)
  }
}

/** Aggiunge solo ciò che manca e assegna tutto a chi carica il file. Programmi e obiettivi non si toccano. */
export async function restoreData(userId: string, backup: unknown) {
  if (!backup || typeof backup !== 'object' || (backup as Row).version !== 1) throw invalid()
  const data = backup as Row
  const hasClient = (row: Row) => typeof row.client_id === 'string' && typeof row.local_date === 'string'
  const drinks = listOf(data, 'drinks', (row) => hasClient(row) && typeof row.amount_ml === 'number')
  const caffeine = listOf(data, 'caffeine_intakes', (row) => hasClient(row) && typeof row.mg === 'number')
  const cups = listOf(data, 'cups', (row) => typeof row.name === 'string' && typeof row.amount_ml === 'number')
  const drinkTypes = listOf(data, 'drink_types', (row) => typeof row.name === 'string' && typeof row.hydration_pct === 'number')

  const mine = (row: Row): Row => {
    const { id: _id, ...rest } = row
    return { ...rest, user_id: userId }
  }
  const missing = async (table: string, rows: Row[], key: string) => {
    const known = new Set((await allRows(table, userId)).map((row) => row[key]))
    return [...new Map(rows.map((row) => [row[key], mine(row)])).values()].filter((row) => !known.has(row[key]))
  }

  const newDrinks = await missing('drinks', drinks, 'client_id')
  const newCaffeine = await missing('caffeine_intakes', caffeine, 'client_id')
  const newCups = await missing('cups', cups, 'name')
  const newTypes = await missing('drink_types', drinkTypes, 'name')

  await upsertNew('drinks', newDrinks)
  await upsertNew('caffeine_intakes', newCaffeine)
  for (const [table, rows] of [['cups', newCups], ['drink_types', newTypes]] as const) {
    if (rows.length > 0) {
      const { error } = await supabase.from(table).insert(rows)
      if (error) throw new Error(error.message)
    }
  }
  return { drinks: newDrinks.length, caffeine: newCaffeine.length, cups: newCups.length, drinkTypes: newTypes.length }
}
