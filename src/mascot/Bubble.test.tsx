import { render, screen } from '@testing-library/react'
import { LazyMotion, domAnimation } from 'motion/react'
import { describe, expect, it } from 'vitest'
import { Bubble } from './Bubble'

describe('Bubble', () => {
  it('mostra il testo ed è annunciato in modo cortese', () => {
    render(
      <LazyMotion features={domAnimation} strict>
        <Bubble text="Ciao Anna!" />
      </LazyMotion>,
    )
    const el = screen.getByText('Ciao Anna!')
    expect(el.parentElement).toHaveAttribute('aria-live', 'polite')
    expect(el).toHaveClass('glu-bubble')
  })
})
