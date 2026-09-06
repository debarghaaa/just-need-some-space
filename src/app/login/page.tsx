import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthForm } from '@/components/site/AuthForm';

export const metadata: Metadata = { title: 'Log in' };

export default function Page() {
  return (
    <div className="wrap auth-shell">
      <Suspense fallback={null}>
        <AuthForm mode="login" />
      </Suspense>
    </div>
  );
}
