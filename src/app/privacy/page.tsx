import type { Metadata } from 'next';
import { BRAND } from '@/game/copy';

export const metadata: Metadata = { title: 'Privacy Policy' };

function Owner({ children }: { children: React.ReactNode }) {
  return (
    <div className="owner-info">
      <strong>Owner-supplied information required</strong>
      {children}
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <div className="wrap-narrow prose">
      <div className="page-head">
        <p className="eyebrow">Legal</p>
        <h1>PRIVACY POLICY</h1>
        <p>This policy describes what {BRAND} collects and why. It is written to match what the software actually does. Sections marked as owner-supplied must be completed by the operator before public launch.</p>
      </div>

      <Owner>Data controller name, address and contact email. Effective date. Data protection officer contact if one is required.</Owner>

      <h2>1. What we collect</h2>
      <ul>
        <li><strong>Account data:</strong> email address and a password hash, stored by Supabase Auth. Sign-in timestamps are recorded by the auth system.</li>
        <li><strong>Profile data:</strong> username, display name, home planet name.</li>
        <li><strong>Game data:</strong> rocket configuration, discoveries (what you found and when), inventory quantities, a points ledger, friend invites and friendships.</li>
        <li><strong>Presence data:</strong> which system or planet you are in and your position on it, refreshed every few seconds while you play. Rows older than a short window are ignored and your row is deleted when you leave or log out.</li>
        <li><strong>Interface preferences:</strong> sound, animation and scale settings, stored only in your browser&apos;s local storage. They are never sent to the server.</li>
      </ul>

      <h2>2. What we do not collect</h2>
      <ul>
        <li>No advertising identifiers, no third-party analytics, no tracking pixels.</li>
        <li>No chat or message content: the game has no chat.</li>
        <li>No payment information: there is nothing to buy.</li>
      </ul>

      <h2>3. Cookies</h2>
      <p>The Service uses session cookies set by Supabase Auth to keep you signed in. They are strictly necessary for the Service to function. No other cookies are set.</p>

      <h2>4. Why we process this data</h2>
      <p>To run the game: authenticate you, save your progress, show other players who is in the same area, and display the Codex. The legal basis is performance of the agreement you enter by creating an account.</p>
      <Owner>Confirm the legal basis wording for the operator&apos;s jurisdiction (for example GDPR Article 6(1)(b)).</Owner>

      <h2>5. Who can see what</h2>
      <ul>
        <li>Other signed-in players can see your username, display name, rocket, the discoveries you made (as &quot;discovered by&quot; in the Codex) and, while you play, your presence in a system or on a planet.</li>
        <li>Your email address, inventory and points ledger are visible only to you.</li>
      </ul>

      <h2>6. Where data is stored and who processes it</h2>
      <p>Data is stored in a Supabase project (PostgreSQL) and the web application is hosted on Vercel. Both act as processors for the operator.</p>
      <Owner>Supabase project region and Vercel deployment region. Links to each provider&apos;s data processing terms.</Owner>

      <h2>7. Retention</h2>
      <p>Account and game data are kept until you delete your account. Presence rows are transient. When you delete your account, all rows tied to your user id are removed; planets you were first to discover keep the discovery date but lose the link to you.</p>

      <h2>8. Your rights</h2>
      <p>You can view your profile, inventory and points ledger in the app at any time, change your display and planet names in Settings, and delete your account from Settings. For access or export requests beyond that, contact the operator.</p>
      <Owner>Contact route for data subject requests and the supervisory authority that applies.</Owner>

      <h2>9. Changes</h2>
      <p>If this policy changes, the effective date above will be updated and the change noted on this page.</p>
    </div>
  );
}
