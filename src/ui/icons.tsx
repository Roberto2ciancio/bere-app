import type { SVGProps } from 'react'

// Icone della barra in basso: tratto 2, angoli arrotondati, colore del testo.
function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  )
}

export const HomeIcon = () => (
  <Icon>
    <path d="M12 3.5c3 3.8 5.5 6.6 5.5 10a5.5 5.5 0 0 1-11 0c0-3.4 2.5-6.2 5.5-10z" />
    <path d="M9.5 14.5a2.6 2.6 0 0 0 2.2 2.2" />
  </Icon>
)

export const StatsIcon = () => (
  <Icon>
    <path d="M5 20V12" />
    <path d="M12 20V5" />
    <path d="M19 20v-9" />
  </Icon>
)

export const TrophyIcon = () => (
  <Icon>
    <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
    <path d="M8 6H5a3 3 0 0 0 3 4" />
    <path d="M16 6h3a3 3 0 0 1-3 4" />
    <path d="M12 13v4" />
    <path d="M8.5 20h7" />
  </Icon>
)

export const ProfileIcon = () => (
  <Icon>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
  </Icon>
)
