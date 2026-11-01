export function formatLiters(ml: number): string {
  const liters = Math.round(ml / 10) / 100
  return `${String(liters).replace('.', ',')} L`
}

export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}:${String(m).padStart(2, '0')}`
}
