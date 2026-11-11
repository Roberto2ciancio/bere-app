import { useProfile } from '../../auth/ProfileProvider'
import { OnboardingShell } from '../OnboardingShell'

export function HelloStep({ onNext }: { onNext: () => void }) {
  const { profile } = useProfile()
  const name = profile?.display_name.trim().split(/\s+/)[0]
  const say = `Ciao${name ? ` ${name}` : ''}! Sono Glu. Ti aiuto a bere abbastanza, senza pensarci`
  return <OnboardingShell step="hello" mood="hello" say={say} onNext={onNext} nextLabel="Iniziamo!" />
}
