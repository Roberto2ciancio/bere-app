import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GluView } from '../home/GluView'

const view = (props: { calm?: boolean; fill?: number } = {}) => render(<GluView fill={props.fill ?? 0.5} mood="idle" name="Anna" now={0} calm={props.calm} choice="2d" />)
const stubIos = (answer = 'granted') => vi.stubGlobal('DeviceOrientationEvent', Object.assign(function () {}, { requestPermission: vi.fn(() => Promise.resolve(answer)) }))
const waterTransform = () => document.querySelector('.glu-tilt')?.getAttribute('transform') ?? null

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

describe('invito a far muovere l’acqua', () => {
  it('su iOS compare, e dopo il consenso l’acqua segue il telefono', async () => {
    stubIos()
    view()
    fireEvent.click(screen.getByRole('button', { name: "Fai muovere l'acqua" }))
    await waitFor(() => expect(screen.queryByRole('button', { name: "Fai muovere l'acqua" })).toBeNull())
    const event = new Event('deviceorientation')
    Object.assign(event, { gamma: 20 })
    act(() => void window.dispatchEvent(event))
    await waitFor(() => expect(waterTransform()).toContain('rotate(-20'))
  })

  it('con Glu pieno l’inclinazione si dimezza', async () => {
    const event = new Event('deviceorientation')
    Object.assign(event, { gamma: 20 })
    view({ fill: 1 })
    act(() => void window.dispatchEvent(event))
    await waitFor(() => expect(waterTransform()).toContain('rotate(-10'))
  })

  it('«Non ora» lo chiude per sempre', () => {
    stubIos()
    const first = view()
    fireEvent.click(screen.getByRole('button', { name: 'Non ora' }))
    expect(screen.queryByRole('button', { name: "Fai muovere l'acqua" })).toBeNull()
    first.unmount()
    view()
    expect(screen.queryByRole('button', { name: "Fai muovere l'acqua" })).toBeNull()
  })

  it('niente invito in «Glu tranquillo» né su Android', () => {
    stubIos()
    view({ calm: true })
    expect(screen.queryByRole('button', { name: "Fai muovere l'acqua" })).toBeNull()
    vi.unstubAllGlobals()
    view()
    expect(screen.queryByRole('button', { name: "Fai muovere l'acqua" })).toBeNull()
  })
})
