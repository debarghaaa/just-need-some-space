import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthForm } from '@/components/site/AuthForm';

export const metadata: Metadata = { title: 'Reset password' };

export default function Page() {
  return (
    <div className="wrap auth-shell">
      <Suspense fallback={null}>
        <AuthForm mode="reset" />
      </Suspense>
    </div>
  );
}
