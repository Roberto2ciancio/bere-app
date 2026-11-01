export const MIN_INTERVAL = 15
export const MAX_INTERVAL = 720

/** Orari da `from` a `to` compresi, ogni `every` minuti. La fascia resta dentro lo stesso giorno. */
export function intervalMinutes(from: number, to: number, every: number): number[] {
  if (!(every > 0) || !(to >= from)) return []
  const times: number[] = []
  for (let minutes = from; minutes <= to; minutes += every) times.push(minutes)
  return times
}

export function intervalLabel(every: number): string {
  if (every === 90) return '1 ora e mezza'
  if (every === 60) return '1 ora'
  if (every > 60 && every % 60 === 0) return `${every / 60} ore`
  return `${every} min`
}

const NAMES = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

export function describeDays(weekdays: number[]): string {
  const days = [...weekdays].sort((a, b) => a - b)
  const key = days.join()
  if (key === '1,2,3,4,5,6,7') return 'Ogni giorno'
  if (key === '1,2,3,4,5') return 'Lun-Ven'
  if (key === '6,7') return 'Sab-Dom'
  return days.map((d) => NAMES[d - 1]).join(', ')
}
