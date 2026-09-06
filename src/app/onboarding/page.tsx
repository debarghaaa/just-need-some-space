import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { OnboardingFlow } from '@/components/game/OnboardingFlow';
import { getViewer } from '@/server/profile';

export const metadata: Metadata = { title: 'Name your planet' };
export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const viewer = await getViewer();
  if (!viewer) redirect('/enter?next=/onboarding');
  if (viewer.profile?.onboarded_at) redirect('/universe');
  return (
    <div className="wrap section">
      <OnboardingFlow suggestedUsername={viewer.email ? viewer.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20) : `explorer_${viewer.userId.replace(/-/g, '').slice(0, 6)}`} isGuest={viewer.isGuest} />
    </div>
  );
}
