import { useEffect, useRef, type ElementType, type ReactNode } from 'react'

const STEP_MS = 50

// I figli diretti entrano a cascata solo al primo montaggio. Si animano gli elementi del DOM
// (non si avvolgono) così il markup e i selettori CSS `.page > …` restano uguali.
export function Stagger({ children, as: Tag = 'div', className }: { children: ReactNode; as?: 'div' | 'section' | 'main'; className?: string }) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof el.animate !== 'function') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    Array.from(el.children).forEach((child, index) => {
      child.animate(
        [
          { opacity: 0, transform: 'translateY(12px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        { duration: 320, delay: index * STEP_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' },
      )
    })
  }, [])

  const Component = Tag as ElementType
  return (
    <Component ref={ref} className={className}>
      {children}
    </Component>
  )
}
