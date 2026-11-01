export interface ViewProps {
  totalMl: number
  goalMl: number
  drinkMl: number
  /** Aumenta a ogni bevuta e fa ripartire l'animazione. */
  pulse: number
}

export const fillRatio = (totalMl: number, goalMl: number) => (goalMl > 0 ? Math.min(1, totalMl / goalMl) : 0)
