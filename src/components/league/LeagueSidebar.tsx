'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import {
  LayoutGrid, UserPlus, Users, BarChart2, Activity, Trophy, Handshake, ShieldCheck,
  ReceiptText, Palette, Globe, Lock, CopyPlus, RotateCcw, Award, Eye, EyeOff, Trash2,
  ChevronDown, Settings2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import CoOrganizersModal from '@/components/CoOrganizersModal';
import PlayerAccessModal from '@/components/league/PlayerAccessModal';
import TemplateSelector from '@/components/TemplateSelector';
import type { LeagueNavSummary } from '@/lib/types';

/** One navigation destination in the rail. */
interface NavLink {
  href: string;
  label: string;
  Icon: typeof Users;
  title?: string;
}

interface LeagueSidebarProps {
  leagueId: string;
  nav: LeagueNavSummary;
  /** Re-reads the summary after an action changed it. */
  refresh: () => void;
  /**
   * Announces that league state changed, so the page in the content column can
   * reload. The rail's actions edit the same league the page is rendering —
   * without this, toggling Public or picking a template would leave the league
   * page showing the old answer until a manual reload.
   */
  notifyChanged: () => void;
  /** Set by the mobile drawer so it closes itself after any navigation. */
  onNavigate?: () => void;
}

/**
 * The league workspace's navigation rail, rendered by `LeagueChrome` on every
 * non-immersive `/leagues/[id]/*` screen.
 *
 * Two kinds of thing live here, deliberately separated: the top groups are
 * plain links — prefetched, with the active one highlighted — while everything
 * under *Manage* is an action that mutates the league. The actions are
 * collapsed by default, because an organizer navigates many times per session
 * and changes a setting rarely.
 *
 * Every visibility rule below mirrors the league page's old toolbar, which in
 * turn mirrors what the API will actually allow — the rail never offers a
 * button the handler would answer 403 to.
 */
export default function LeagueSidebar({
  leagueId, nav, refresh, notifyChanged, onNavigate,
}: LeagueSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const base = `/leagues/${leagueId}`;

  const [manageOpen, setManageOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [coOrgOpen, setCoOrgOpen] = useState(false);
  const [playerAccessOpen, setPlayerAccessOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [pending, setPending] = useState<'public' | 'certificates' | null>(null);

  const certificatesReleased = !!nav.certificatesReleasedAt;
  const rosterLocked = !nav.rosterVisibleToPlayers || !nav.playersCanDeleteCards;

  // `canManage` gets the full workspace; everyone else gets the read-only
  // screens a public league exposes, exactly as the toolbar did.
  const sections: { heading?: string; items: NavLink[] }[] = nav.canManage
    ? [
      { items: [{ href: base, label: 'Overview', Icon: LayoutGrid }] },
      {
        heading: 'Squad',
        items: [
          { href: `${base}/players/new`, label: 'Add Player', Icon: UserPlus },
          { href: `${base}/teams`, label: 'Teams', Icon: Users },
          { href: `${base}/matches`, label: 'Matches', Icon: BarChart2 },
        ],
      },
      {
        heading: 'Insights',
        items: [
          { href: `${base}/analytics`, label: 'Analytics', Icon: Activity },
          { href: `${base}/leaderboard`, label: 'Leaderboard', Icon: Trophy },
        ],
      },
      {
        heading: 'League',
        items: [
          { href: `${base}/sponsors/manage`, label: 'Sponsors', Icon: Handshake },
          {
            href: `${base}/identity`, label: 'Documents', Icon: ShieldCheck,
            title: 'Identity proofs and payment receipts — organizers only',
          },
          {
            href: `${base}/ledger`, label: 'Ledger', Icon: ReceiptText,
            title: 'Income & expenses — optional, and only shared once you publish it',
          },
        ],
      },
    ]
    : [
      { items: [{ href: base, label: 'Overview', Icon: LayoutGrid }] },
      ...(nav.isPublic
        ? [{
          heading: 'Explore',
          items: [
            { href: `${base}/teams`, label: 'Teams', Icon: Users },
            { href: `${base}/analytics`, label: 'Analytics', Icon: Activity },
            { href: `${base}/leaderboard`, label: 'Leaderboard', Icon: Trophy },
            { href: `${base}/sponsors`, label: 'Sponsors', Icon: Handshake },
          ],
        }]
        : []),
      // Members only, and only once the organizers published something — the
      // same rule the ledger API enforces, so this never offers a 403.
      ...(nav.isMember && nav.ledgerPublished
        ? [{ items: [{ href: `${base}/ledger`, label: 'Ledger', Icon: ReceiptText }] }]
        : []),
    ];

  /** Overview matches exactly; every other item also matches its sub-routes. */
  function isActive(href: string): boolean {
    if (href === base) return pathname === base;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function patchLeague(body: Record<string, unknown>) {
    const res = await fetch(`/api/leagues/${leagueId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Request failed');
    return res.json();
  }

  /** Any action that changed the league: re-read the rail *and* the page. */
  function changed() {
    refresh();
    notifyChanged();
  }

  async function handleTemplateChange(templateId: string) {
    try {
      await patchLeague({ templateId });
      toast.success('Template updated');
      changed();
    } catch {
      toast.error('Failed to save template');
    }
  }

  async function handleTogglePublic() {
    setPending('public');
    try {
      const updated = await patchLeague({ isPublic: !nav.isPublic });
      toast.success(updated.isPublic
        ? `League is now public · Code: ${updated.joinCode}`
        : 'League set to private');
      changed();
    } catch { toast.error('Failed to update visibility'); }
    finally { setPending(null); }
  }

  /**
   * Release participation certificates to every player, or withdraw them.
   * Releasing is only the gate — nothing is generated up front — so it goes
   * through without a prompt. Withdrawing takes a download away from people who
   * may already have been told it's there, so that one confirms first.
   */
  async function setCertificates(next: boolean) {
    setPending('certificates');
    try {
      await patchLeague({ certificatesReleased: next });
      toast.success(next
        ? 'Certificates released — players can download theirs from their profile'
        : 'Certificates withdrawn');
      changed();
      setWithdrawOpen(false);
    } catch { toast.error('Failed to update certificates'); }
    finally { setPending(null); }
  }

  async function handleResetAuction() {
    try {
      const res = await fetch(`/api/leagues/${leagueId}/auction/reset`, { method: 'POST' });
      if (!res.ok) throw new Error();
      const { reset } = await res.json();
      toast.success(`Auction reset — ${reset} player${reset === 1 ? '' : 's'} cleared`);
      changed();
      setResetOpen(false);
    } catch {
      // Dialog stays open so the organizer can retry without re-confirming.
      toast.error('Failed to reset auction');
    }
  }

  async function handleDeleteLeague() {
    try {
      const res = await fetch(`/api/leagues/${leagueId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('League deleted');
      // Deliberately leaves the dialog spinning until the route change lands —
      // the league is gone, so re-enabling this screen would only show a 404.
      router.push('/');
    } catch {
      toast.error('Failed to delete league');
    }
  }

  return (
    <>
      <nav className="flex flex-col gap-5" aria-label="League navigation">
        {sections.map((section, i) => (
          <div key={section.heading ?? `section-${i}`}>
            {section.heading && (
              <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                {section.heading}
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {section.items.map(({ href, label, Icon, title }) => (
                <Link
                  key={href}
                  href={href}
                  title={title}
                  onClick={onNavigate}
                  aria-current={isActive(href) ? 'page' : undefined}
                  className="rail-link"
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}

        {/* Management actions — mutations, not destinations, hence the split. */}
        {nav.canManage && (
          <div>
            <button
              onClick={() => setManageOpen((v) => !v)}
              aria-expanded={manageOpen}
              className="rail-link w-full justify-between text-muted-foreground/60 hover:text-foreground"
            >
              <span className="flex items-center gap-2.5">
                <Settings2 className="w-4 h-4 shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Manage</span>
              </span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${manageOpen ? 'rotate-180' : ''}`} />
            </button>

            {manageOpen && (
              <div className="flex flex-col gap-0.5 mt-0.5">
                <button onClick={() => setTemplateOpen(true)} className="rail-link">
                  <Palette className="w-4 h-4 shrink-0" />Card Template
                </button>

                <button
                  onClick={() => setPlayerAccessOpen(true)}
                  title="Control whether players can see the full roster and delete their own card"
                  className={`rail-link ${rosterLocked ? 'rail-link-flagged' : ''}`}
                >
                  {rosterLocked ? <EyeOff className="w-4 h-4 shrink-0" /> : <Eye className="w-4 h-4 shrink-0" />}
                  Player Access
                </button>

                {/* Only the creator manages who co-organizes — the platform
                    owner deliberately doesn't inherit this one. */}
                {nav.isCreator && (
                  <button
                    onClick={() => setCoOrgOpen(true)}
                    title="Invite trusted people to help run this league"
                    className="rail-link"
                  >
                    <ShieldCheck className="w-4 h-4 shrink-0" />Co-Organizers
                  </button>
                )}

                <button
                  onClick={() => (certificatesReleased ? setWithdrawOpen(true) : setCertificates(true))}
                  disabled={pending === 'certificates' || nav.playerCount === 0}
                  className={`rail-link ${certificatesReleased ? 'rail-link-flagged' : ''}`}
                  title={nav.playerCount === 0
                    ? 'Add players before releasing certificates'
                    : certificatesReleased
                      ? `Released ${new Date(nav.certificatesReleasedAt!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} — click to withdraw`
                      : 'Let every player download a participation certificate from their profile'}
                >
                  {pending === 'certificates'
                    ? <span className="w-4 h-4 shrink-0 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                    : <Award className="w-4 h-4 shrink-0" />}
                  <span className="truncate">
                    {certificatesReleased ? 'Certificates Released' : 'Release Certificates'}
                  </span>
                </button>

                <button onClick={handleTogglePublic} disabled={pending === 'public'} className="rail-link">
                  {pending === 'public'
                    ? <span className="w-4 h-4 shrink-0 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                    : nav.isPublic ? <Lock className="w-4 h-4 shrink-0" /> : <Globe className="w-4 h-4 shrink-0" />}
                  {nav.isPublic ? 'Make Private' : 'Make Public'}
                </button>

                <Link
                  href={`${base}/clone`}
                  onClick={onNavigate}
                  title="Create a copy of this league"
                  className="rail-link"
                >
                  <CopyPlus className="w-4 h-4 shrink-0" />Clone League
                </Link>

                {nav.hasAuctionData && (
                  <button
                    onClick={() => setResetOpen(true)}
                    title="Clear all sold players and unsold flags"
                    className="rail-link rail-link-danger"
                  >
                    <RotateCcw className="w-4 h-4 shrink-0" />Reset Auction
                  </button>
                )}

                {nav.isCreator && (
                  <button onClick={() => setDeleteOpen(true)} className="rail-link rail-link-danger">
                    <Trash2 className="w-4 h-4 shrink-0" />Delete League
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Card template. A dialog rather than the inline panel it replaces — the
          rail is on every screen, and only the league page had room below its
          header for a panel. */}
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogTitle className="text-gradient-green">Card Template</DialogTitle>
          <p className="text-sm text-muted-foreground -mt-2">
            Applies to every player card in this league, exports included.
          </p>
          <TemplateSelector value={nav.templateId} onChange={handleTemplateChange} />
        </DialogContent>
      </Dialog>

      {playerAccessOpen && (
        <PlayerAccessModal
          leagueId={leagueId}
          rosterVisibleToPlayers={nav.rosterVisibleToPlayers}
          playersCanDeleteCards={nav.playersCanDeleteCards}
          isPublic={nav.isPublic}
          onSaved={changed}
          onClose={() => setPlayerAccessOpen(false)}
        />
      )}

      {coOrgOpen && (
        <CoOrganizersModal
          leagueId={leagueId}
          onClose={(didChange) => { setCoOrgOpen(false); if (didChange) changed(); }}
        />
      )}

      <ConfirmDialog
        open={withdrawOpen}
        title="Withdraw certificates?"
        description="Players lose the download from their profile until you release again."
        confirmLabel="Withdraw"
        pendingLabel="Withdrawing…"
        onConfirm={() => setCertificates(false)}
        onClose={() => setWithdrawOpen(false)}
      />

      <ConfirmDialog
        open={resetOpen}
        title="Reset the auction?"
        description="Every sold player is removed from their team and unsold flags are cleared. Pre-assigned icon players stay on their teams. This cannot be undone."
        confirmLabel="Reset auction"
        pendingLabel="Resetting…"
        onConfirm={handleResetAuction}
        onClose={() => setResetOpen(false)}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this league?"
        description={
          <>
            <strong className="text-foreground">{nav.name}</strong> and all {nav.playerCount} player
            card{nav.playerCount === 1 ? '' : 's'} will be removed, along with its teams, matches,
            sponsors and ledger. This cannot be undone.
          </>
        }
        confirmLabel="Delete league"
        pendingLabel="Deleting…"
        onConfirm={handleDeleteLeague}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}
