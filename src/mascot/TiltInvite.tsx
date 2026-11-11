interface Props {
  onAccept: () => void
  onDismiss: () => void
}

/** Invito sotto Glu (solo iOS, dove serve un permesso): l'acqua dentro segue il telefono. */
export function TiltInvite({ onAccept, onDismiss }: Props) {
  return (
    <div className="tilt-invite">
      <button type="button" className="tilt-invite-go" onClick={onAccept}>
        Fai muovere l'acqua
      </button>
      <button type="button" className="tilt-invite-close" aria-label="Non ora" onClick={onDismiss}>
        ×
      </button>
    </div>
  )
}
