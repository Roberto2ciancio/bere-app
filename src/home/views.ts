export const fillRatio = (totalMl: number, goalMl: number) => (goalMl > 0 ? Math.min(1, totalMl / goalMl) : 0)
