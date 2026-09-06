import type { Metadata } from 'next';

import Link from 'next/link';

import { redirect } from 'next/navigation';

import { Crumbs, Empty, Panel, Stat, Tag } from '@/components/ui';

import { BackendMissing } from '@/components/site/BackendMissing';

import { FriendsPanel } from '@/components/game/FriendsPanel';

import { RocketSprite } from '@/components/game/Sprites';

import { COPY } from '@/game/copy';

import { POINT_RULE_LABELS, type PointEvent } from '@/game/rules';

import { RESOURCE_BY_ID } from '@/game/universe';

import { isBackendConfigured } from '@/lib/env';

import { getServerSupabase } from '@/lib/supabase/server';

import { getViewer } from '@/server/profile';

export const metadata: Metadata = { title: 'Profile' };

export const dynamic = 'force-dynamic';

export const revalidate = 0;

export default async function ProfilePage() {
  if (!isBackendConfigured()) return <BackendMissing />;

  const viewer = await getViewer();

  if (!viewer) redirect('/enter?next=/profile');

  if (!viewer.profile?.onboarded_at) redirect('/onboarding');

  const p = viewer.profile;

  const supabase = (await getServerSupabase())!;

  const [inv, ledger, planets] = await Promise.all([
    supabase
      .from('inventory')
      .select('resource_id,quantity,updated_at')
      .eq('player_id', viewer.userId)
      .order('quantity', { ascending: false }),

    supabase
      .from('point_events')
      .select('event,points,source_id,created_at')
      .eq('player_id', viewer.userId)
      .order('created_at', { ascending: false })
      .limit(50),

    supabase
      .from('discoveries')
      .select('id', { count: 'exact', head: true })
      .eq('player_id', viewer.userId)
      .eq('discovery_type', 'planet'),
  ]);

  const inventory = inv.data ?? [];

  const events = ledger.data ?? [];

  const planetsDiscovered = planets.count ?? 0;

  return (
    <div className="wrap">
      <div className="game-head">
        <div>
          <Crumbs
            items={[
              { href: '/universe', label: 'Universe' },
              { label: 'Profile' },
            ]}
          />

          <div className="profile-head">
            <RocketSprite
              config={viewer.rocketConfig}
              scale={3}
              label="Your current rocket"
            />

            <div>
              <h1>{p.display_name}</h1>

              <div className="row" style={{ gap: '0.5rem' }}>
                <span className="mono dim">@{p.username}</span>

                <Tag kind="player">Real player</Tag>

                {viewer.isGuest ? (
                  <Tag kind="guest">{COPY.guest.tag}</Tag>
                ) : null}

                <span className="small muted">
                  Home base: {p.planet_name}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="row">
          <Link
            href="/customize"
            className="btn btn-secondary btn-sm"
          >
            Customize
          </Link>

          <Link
            href="/settings"
            className="btn btn-ghost btn-sm"
          >
            Settings
          </Link>
        </div>
      </div>

      <dl
        className="stats"
        id="points"
        style={{ marginBottom: '1.5rem' }}
      >
        <Stat
          label="Points"
          value={p.points.toLocaleString()}
        />

        <Stat
          label="Planets discovered"
          value={planetsDiscovered}
        />

        <Stat
          label="Discoveries"
          value={p.discovery_count}
        />

        <Stat
          label="Current rocket"
          value={
            <span style={{ fontSize: '0.95rem' }}>
              {viewer.rocket?.name ?? 'None'}
            </span>
          }
        />

        <Stat
          label="Explorer since"
          value={
            <span style={{ fontSize: '0.95rem' }}>
              {new Date(p.created_at).toLocaleDateString()}
            </span>
          }
        />
      </dl>

      <div className="grid-2">
        <Panel title="Inventory" as="section">
          <div id="inventory" />

          {inventory.length === 0 ? (
            <Empty
              head={COPY.emptyInventory.head}
              sub="Land somewhere and pick things up."
            />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Resource</th>
                  <th>Tier</th>
                  <th className="num">Qty</th>
                </tr>
              </thead>

              <tbody>
                {inventory.map((r) => {
                  const def = RESOURCE_BY_ID[r.resource_id as string];

                  return (
                    <tr key={r.resource_id as string}>
                      <td>{def?.name ?? r.resource_id}</td>

                      <td>
                        {def ? (
                          <Tag kind={def.tier}>
                            {def.tier}
                          </Tag>
                        ) : null}
                      </td>

                      <td className="num">
                        {r.quantity as number}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Points ledger" as="section">
          {events.length === 0 ? (
            <Empty
              head="NO POINTS YET."
              sub="Visit a system. The first one pays 150."
            />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Source</th>
                  <th className="num">Pts</th>
                </tr>
              </thead>

              <tbody>
                {events.map((e, i) => (
                  <tr key={i}>
                    <td>
                      {POINT_RULE_LABELS[e.event as PointEvent] ??
                        e.event}

                      <br />

                      <span className="small muted">
                        {new Date(
                          e.created_at as string
                        ).toLocaleString()}
                      </span>
                    </td>

                    <td className="mono small dim">
                      {e.source_id as string}
                    </td>

                    <td className="num amber">
                      +{e.points as number}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p
            className="small muted"
            style={{ margin: '0.75rem 0 0' }}
          >
            Every row is written by the server when the discovery is
            saved. The total above is the sum of this ledger.
          </p>
        </Panel>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <FriendsPanel />
      </div>
    </div>
  );
}