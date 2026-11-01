export interface LocalParts {
  date: string
  minutes: number
  /** 1 = lunedì, 7 = domenica */
  weekday: number
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(tz: string): Intl.DateTimeFormat {
  let formatter = formatters.get(tz)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    formatters.set(tz, formatter)
  }
  return formatter
}

export function weekdayOf(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return day === 0 ? 7 : day
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function localParts(instant: Date, tz: string): LocalParts {
  const parts: Record<string, string> = {}
  for (const { type, value } of formatterFor(tz).formatToParts(instant)) parts[type] = value
  const date = `${parts.year}-${parts.month}-${parts.day}`
  return {
    date,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    weekday: weekdayOf(date),
  }
}
