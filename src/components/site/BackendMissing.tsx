import { Notice } from '@/components/ui';

/** Shown on any page that needs Supabase when the environment variables are not set. */
export function BackendMissing() {
  return (
    <div className="wrap-narrow section">
      <Notice head="BACKEND NOT CONFIGURED." tone="red">
        <p>This page needs Supabase. The app is not connected to a project, so accounts, saving and multiplayer are unavailable and nothing here is simulated.</p>
        <p style={{ margin: 0 }} className="mono small">
          Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY, run supabase/migrations/0001_init.sql, then restart. For local development run <code>npm run stack:up</code>.
        </p>
      </Notice>
    </div>
  );
}
