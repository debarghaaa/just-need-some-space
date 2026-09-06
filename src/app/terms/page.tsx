import type { Metadata } from 'next';
import { BRAND } from '@/game/copy';

export const metadata: Metadata = { title: 'Terms & Conditions' };

function Owner({ children }: { children: React.ReactNode }) {
  return (
    <div className="owner-info">
      <strong>Owner-supplied information required</strong>
      {children}
    </div>
  );
}

export default function TermsPage() {
  return (
    <div className="wrap-narrow prose">
      <div className="page-head">
        <p className="eyebrow">Legal</p>
        <h1>TERMS &amp; CONDITIONS</h1>
        <p>These terms govern the use of {BRAND} (the &quot;Service&quot;). Sections marked as owner-supplied must be completed by the operator before public launch; they are not legal claims until then.</p>
      </div>

      <Owner>Operator legal name, registered address, contact email and governing jurisdiction. Effective date of these terms.</Owner>

      <h2>1. The Service</h2>
      <p>{BRAND} is an online multiplayer game. It is provided as is, may change over time, and may be interrupted for maintenance or other reasons.</p>

      <h2>2. Accounts</h2>
      <ul>
        <li>You need an account (email and password) to play. You are responsible for keeping your credentials private.</li>
        <li>You must provide a working email address so that password resets can reach you.</li>
        <li>Usernames are visible to other players. Do not use a username that impersonates someone else or that is offensive.</li>
        <li>You may delete your account at any time from Settings. Deletion removes your profile, rockets, discoveries, inventory, points and friendships.</li>
      </ul>
      <Owner>Minimum age for account holders (for example 13 or 16 depending on jurisdiction) and any parental-consent requirements.</Owner>

      <h2>3. Acceptable use</h2>
      <ul>
        <li>Do not attempt to manipulate points, discoveries or inventory outside normal play. Progression is computed on the server and tampering attempts may result in account removal.</li>
        <li>Do not harass other players. The only social features are waving and friend invites; using them abusively (for example repeated unwanted invites) is not permitted.</li>
        <li>Do not attempt to access other players&apos; data, probe the Service&apos;s infrastructure, or interfere with its operation.</li>
      </ul>

      <h2>4. Your content</h2>
      <p>The only content you provide is your username, display name, planet name and rocket name. You grant the operator permission to display these to other players as part of the game (for example in the Codex as &quot;discovered by&quot;).</p>

      <h2>5. Game data</h2>
      <p>Points, discoveries, inventory and other progression have no monetary value and cannot be exchanged, sold or transferred. The operator may reset or adjust game data if needed to fix bugs or abuse.</p>

      <h2>6. Availability and changes</h2>
      <p>The operator may modify, suspend or discontinue the Service or any part of it. Where practical, notice will be given on the site.</p>

      <h2>7. Disclaimer and liability</h2>
      <p>The Service is provided without warranties of any kind to the extent permitted by law. The operator is not liable for indirect or consequential losses arising from use of the Service.</p>
      <Owner>Liability caps, consumer-law carve-outs and any mandatory local wording must be reviewed by the operator&apos;s legal advisor.</Owner>

      <h2>8. Termination</h2>
      <p>The operator may suspend or close accounts that breach these terms. You may stop using the Service and delete your account at any time.</p>

      <h2>9. Contact</h2>
      <Owner>Contact address for questions about these terms.</Owner>
    </div>
  );
}
