const DAYS = [
  [1, 'Lun'],
  [2, 'Mar'],
  [3, 'Mer'],
  [4, 'Gio'],
  [5, 'Ven'],
  [6, 'Sab'],
  [7, 'Dom'],
] as const

export function DayPicker({ value, onChange }: { value: number[]; onChange(days: number[]): void }) {
  return (
    <div className="choices" role="group" aria-label="Giorni">
      {DAYS.map(([day, label]) => (
        <button
          key={day}
          type="button"
          className="choice"
          aria-pressed={value.includes(day)}
          onClick={() => onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day])}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
