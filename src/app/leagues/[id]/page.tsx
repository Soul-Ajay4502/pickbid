'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import { Separator } from '@/components/ui/separator';
import PlayerCard from '@/components/PlayerCard';
import PlayerFullView from '@/components/PlayerFullView';
import DownloadPDFButton from '@/components/DownloadPDFButton';
import TemplateSelector from '@/components/TemplateSelector';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import CoOrganizersModal from '@/components/CoOrganizersModal';
import type { LeagueWithPlayers, UserProfile, Player } from '@/lib/types';
import { generateToken, copyToClipboard } from '@/lib/utils';
import { downloadTeamwiseRoster, downloadSquadPosters } from '@/lib/squadPdf';
import { toast } from 'sonner';
import {
  ArrowDown, ArrowUp, ArrowLeft, Search, X, Users, BarChart2, Globe, Lock, Unlock,
  ImageDown, Share2, ChevronDown, Copy, Link2, FileText, Trash2, Gavel, Palette,
  UsersRound, Images, UserPlus, RotateCcw, Activity, Trophy, CopyPlus, Sparkles, Handshake,
  ShieldCheck,
} from 'lucide-react';

function LeaguePageInner() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const isOpen = searchParams.get('open') === 'true';
  const { status: sessionStatus } = useSession();

  const leagueRedirectUrl = `/leagues/${id}${isOpen ? '?open=true' : ''}`;

  const [data, setData] = useState<LeagueWithPlayers | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTemplateId, setActiveTemplateId] = useState('');
  const [templatePanelOpen, setTemplatePanelOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [joining, setJoining] = useState(false);
  const [togglingPublic, setTogglingPublic] = useState(false);
  const [togglingRegistration, setTogglingRegistration] = useState(false);
  const [resettingAuction, setResettingAuction] = useState(false);
  // Player shown in the full-view modal (null = closed)
  const [viewPlayer, setViewPlayer] = useState<Player | null>(null);
  // Once an auction is complete the cards are hidden behind a banner; this reveals them
  const [showPlayers, setShowPlayers] = useState(false);
  // Creator-only co-organizer management modal
  const [coOrgOpen, setCoOrgOpen] = useState(false);

  const fetchLeague = useCallback(async () => {
    try {
      const res = await fetch(`/api/leagues/${id}`);
      if (!res.ok) {
        if (res.status === 404) router.push('/');
        return;
      }
      const json: LeagueWithPlayers = await res.json();
      setData(json);
      setActiveTemplateId(json.templateId);
    } catch {
      toast.error('Failed to load league');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { fetchLeague(); }, [fetchLeague]);

  useEffect(() => {
    if (sessionStatus !== 'authenticated') return;
    fetch('/api/profile')
      .then((r) => r.json())
      .then((d) => { if (d) setProfile(d); })
      .catch(() => { });
  }, [sessionStatus]);


  // Server-computed from the requester's userId, so it's consistent across devices
  const hasJoined = data?.hasJoined ?? false;

  async function handleJoin() {
    if (!profile) return;
    setJoining(true);
    const creatorToken = generateToken();
    try {
      const res = await fetch(`/api/leagues/${id}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profile.name,
          photo: profile.photo,
          battingType: profile.battingType,
          bowlingType: profile.bowlingType,
          role: profile.role,
          isWicketKeeper: profile.isWicketKeeper,
          creatorToken,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to join');
      }
      const player = await res.json();
      localStorage.setItem(`creator_player_${player.id}`, creatorToken);
      toast.success('You joined the league!');
      fetchLeague();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setJoining(false);
    }
  }

  // ── Share & Export menu ────────────────────────────────────────────────────
  const [shareOpen, setShareOpen] = useState(false);
  const [teamExporting, setTeamExporting] = useState<'roster' | 'posters' | null>(null);
  const shareRef = useRef<HTMLDivElement>(null);

  async function handleTeamExport(kind: 'roster' | 'posters') {
    if (!data || teamExporting) return;
    setTeamExporting(kind);
    try {
      if (kind === 'roster') {
        await downloadTeamwiseRoster(data, data.teams, data.players);
        toast.success('Team-wise roster downloaded');
      } else {
        await downloadSquadPosters(data, data.teams, data.players, data.officials ?? []);
        toast.success('Squad posters downloaded');
      }
      setShareOpen(false);
    } catch {
      toast.error('Export failed — please try again');
    } finally {
      setTeamExporting(null);
    }
  }

  useEffect(() => {
    if (!shareOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) setShareOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setShareOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [shareOpen]);

  // ── Scroll buttons ─────────────────────────────────────────────────────────
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    function onScroll() {
      const distFromBottom = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      setShowScrollBottom(distFromBottom > 200);
      setShowScrollTop(window.scrollY > 200);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Search ─────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ── Template ───────────────────────────────────────────────────────────────
  async function handleTemplateChange(templateId: string) {
    setActiveTemplateId(templateId);
    setSavingTemplate(true);
    try {
      const res = await fetch(`/api/leagues/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Template updated');
    } catch {
      toast.error('Failed to save template');
      setActiveTemplateId(data?.templateId ?? templateId);
    } finally {
      setSavingTemplate(false);
    }
  }

  // ── Player helpers ─────────────────────────────────────────────────────────
  function canEditPlayer(playerCreatorToken: string, playerId: string): boolean {
    if (typeof window === 'undefined') return false;
    const playerToken = localStorage.getItem(`creator_player_${playerId}`);
    return (
      data?.canManage === true ||
      (!!playerToken && playerToken === playerCreatorToken)
    );
  }

  async function handleDeletePlayer(playerId: string) {
    if (!confirm('Delete this player card?')) return;
    try {
      // Proves card ownership to the API when the deleter isn't the league creator
      const token = localStorage.getItem(`creator_player_${playerId}`);
      const qs = token ? `?creatorToken=${encodeURIComponent(token)}` : '';
      const res = await fetch(`/api/leagues/${id}/players/${playerId}${qs}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Player card deleted');
      fetchLeague();
    } catch {
      toast.error('Failed to delete player card');
    }
  }

  async function handleResetAuction() {
    if (!confirm('Reset the auction? Every sold player is removed from their team and unsold flags are cleared. Pre-assigned icon players stay on their teams. This cannot be undone.')) return;
    setResettingAuction(true);
    try {
      const res = await fetch(`/api/leagues/${id}/auction/reset`, { method: 'POST' });
      if (!res.ok) throw new Error();
      const { reset } = await res.json();
      toast.success(`Auction reset — ${reset} player${reset === 1 ? '' : 's'} cleared`);
      fetchLeague();
    } catch {
      toast.error('Failed to reset auction');
    } finally {
      setResettingAuction(false);
    }
  }

  async function handleDeleteLeague() {
    if (!confirm(`Delete "${data?.name}"? This will remove all player cards too and cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/leagues/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete league');
      toast.success('League deleted');
      router.push('/');
    } catch {
      toast.error('Failed to delete league');
    }
  }

  // ── Share ──────────────────────────────────────────────────────────────────
  function copyLink(url: string, label: string) {
    copyToClipboard(url).then((ok) => ok ? toast.success(`${label} copied!`) : toast.error('Could not copy to clipboard'));
  }

  async function handleDownloadRoster() {
    if (!data || data.players.length === 0) return;
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210;
    const margin = 20;
    let y = margin;

    const accent = [34, 197, 94] as const;
    doc.setFillColor(...accent);
    doc.rect(0, 0, pageW, 36, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(data.name, margin, 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Conducted by: ${data.conductedBy}`, margin, 24);
    doc.text(`${data.players.length} player${data.players.length !== 1 ? 's' : ''} · Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, margin, 31);
    y = 48;

    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('#', margin, y);
    doc.text('NAME', margin + 10, y);
    doc.text('ROLE', margin + 90, y);
    doc.text('BATTING', margin + 130, y);
    y += 2;
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageW - margin, y);
    y += 6;

    data.players.forEach((player, i) => {
      if (y > 272) {
        doc.addPage();
        y = margin;
        doc.setTextColor(120, 120, 120);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text('#', margin, y);
        doc.text('NAME', margin + 10, y);
        doc.text('ROLE', margin + 90, y);
        doc.text('BATTING', margin + 130, y);
        y += 2;
        doc.setDrawColor(220, 220, 220);
        doc.line(margin, y, pageW - margin, y);
        y += 6;
      }
      doc.setTextColor(160, 160, 160);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(String(i + 1), margin, y);
      doc.setTextColor(20, 20, 20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(player.name, margin + 10, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(50, 50, 50);
      doc.text(player.role, margin + 90, y);
      doc.text(player.battingType === 'Right-Hand Bat' ? 'RHB' : 'LHB', margin + 130, y);
      if (player.isWicketKeeper) {
        doc.setTextColor(...accent);
        doc.setFontSize(7);
        doc.text('WK', margin + 148, y);
      }
      y += 5;
      if (player.bowlingType !== 'N/A') {
        doc.setTextColor(140, 140, 140);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.5);
        doc.text(player.bowlingType, margin + 10, y);
        y += 4;
      }
      doc.setDrawColor(240, 240, 240);
      doc.line(margin, y, pageW - margin, y);
      y += 4;
    });

    const pageCount = doc.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setTextColor(180, 180, 180);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(`Page ${p} of ${pageCount}`, pageW - margin, 290, { align: 'right' });
    }
    doc.save(`${data.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_roster.pdf`);
  }

  // ── Toggle public ──────────────────────────────────────────────────────────
  async function handleTogglePublic() {
    if (!data) return;
    setTogglingPublic(true);
    try {
      const res = await fetch(`/api/leagues/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: !data.isPublic }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setData(prev => prev ? { ...prev, isPublic: updated.isPublic, joinCode: updated.joinCode } : prev);
      toast.success(updated.isPublic ? `League is now public · Code: ${updated.joinCode}` : 'League set to private');
    } catch { toast.error('Failed to update visibility'); }
    finally { setTogglingPublic(false); }
  }

  async function handleToggleRegistration() {
    if (!data) return;
    setTogglingRegistration(true);
    const next = !(data.registrationClosed ?? false);
    try {
      const res = await fetch(`/api/leagues/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationClosed: next }),
      });
      if (!res.ok) throw new Error();
      setData(prev => prev ? { ...prev, registrationClosed: next } : prev);
      toast.success(next ? 'Registration closed — new players can no longer join' : 'Registration reopened');
    } catch { toast.error('Failed to update registration'); }
    finally { setTogglingRegistration(false); }
  }

  // ── Squad poster ───────────────────────────────────────────────────────────
  async function handleSquadPoster() {
    if (!data || data.players.length === 0) return;
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = 297, pageH = 210, margin = 12;
    const cols = 4, rows = Math.ceil(data.players.length / cols);
    const cellW = (pageW - margin * 2) / cols;
    const cellH = Math.min(40, (pageH - margin * 2 - 24) / rows);

    // Header
    const accent = [34, 197, 94] as const;
    doc.setFillColor(...accent);
    doc.rect(0, 0, pageW, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(data.name, margin, 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`${data.players.length} players · ${data.conductedBy}`, pageW - margin, 12, { align: 'right' });

    // Player grid
    data.players.forEach((player, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = margin + col * cellW, y = 22 + row * cellH;
      // Cell bg
      doc.setFillColor(248, 250, 248);
      doc.roundedRect(x + 1, y + 1, cellW - 2, cellH - 2, 2, 2, 'F');
      // Name
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(player.name, x + 4, y + 8);
      // Role
      doc.setFillColor(...accent);
      doc.setTextColor(...accent);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(player.role, x + 4, y + 14);
      // Details
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(6.5);
      doc.text(player.battingType === 'Right-Hand Bat' ? 'RHB' : 'LHB', x + 4, y + 19);
      if (player.bowlingType !== 'N/A') doc.text(player.bowlingType, x + 4, y + 23);
      if (player.isWicketKeeper) { doc.setTextColor(...accent); doc.text('WK', x + cellW - 10, y + 19); }
      // Stats if present
      if (player.statsRuns != null || player.statsWickets != null) {
        doc.setTextColor(71, 85, 105);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        const parts: string[] = [];
        if (player.statsRuns != null) parts.push(`${player.statsRuns}R`);
        if (player.statsWickets != null) parts.push(`${player.statsWickets}W`);
        doc.text(parts.join(' · '), x + 4, y + cellH - 5);
      }
      // Number
      doc.setTextColor(200, 210, 200);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(22);
      doc.text(String(i + 1), x + cellW - 8, y + cellH - 4);
    });

    doc.save(`${data.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_squad_poster.pdf`);
    toast.success('Squad poster downloaded!');
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="h-8 w-64 bg-muted rounded-lg mb-2 shimmer" />
        <div className="h-4 w-40 bg-muted rounded-lg mb-8 shimmer" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-72 rounded-2xl bg-muted shimmer" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const q = debouncedQuery.toLowerCase();
  const filteredPlayers = q
    ? data.players.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.role.toLowerCase().includes(q) ||
      p.battingType.toLowerCase().includes(q) ||
      p.bowlingType.toLowerCase().includes(q)
    )
    : data.players;

  const registrationClosed = data.registrationClosed ?? false;
  // Creator or co-organizer — either can manage this league
  const canManage = data.canManage;
  // Non-organizers can only join via a register link while registration is open
  const canJoin = isOpen && !registrationClosed;
  const showAddCard = canManage || canJoin;
  // Auction has results to clear when a non-icon player is on a team or marked unsold
  const hasAuctionData = data.players.some(p => (p.teamId && !p.isIcon) || p.isUnsold);
  // The auction is complete once every player is resolved (sold/icon or unsold) and real results exist
  const allResolved = data.players.length > 0 && data.players.every(p => p.teamId || p.isUnsold);
  const auctionCompleted = data.teams.length > 0 && hasAuctionData && allResolved;
  // Hide the card grid behind the "completed" banner until the viewer asks to see it
  const playersHidden = auctionCompleted && !showPlayers;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const fillPct = data.totalPlayers > 0
    ? Math.min(100, Math.round((data.players.length / data.totalPlayers) * 100))
    : 0;

  return (
    <div className="clay max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      {/* relative z-30: lift the whole header (and its Share & Export dropdown)
          above the player-card grid. The cards' animate-fade-in-up leaves a
          persistent transform, so each card wrapper is its own stacking context;
          without this the dropdown would render beneath them. */}
      <div className="relative z-30 mb-6 animate-fade-in-up">
        <button
          onClick={() => router.push('/')}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          All Leagues
        </button>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          {/* Title + capacity */}
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gradient-green">{data.name}</h1>
              <span className={`clay-pill inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${data.isPublic
                ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                : 'bg-muted text-muted-foreground'
                }`}>
                {data.isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                {data.isPublic ? 'Public' : 'Private'}
              </span>
              {/* Registration flag. Organizers can toggle it open/closed with the
                  button on its left; everyone else only sees the flag when they
                  arrived via a register link (?open=true). */}
              {canManage ? (
                <span className="inline-flex items-center gap-1.5">
                  <button
                    onClick={handleToggleRegistration}
                    disabled={togglingRegistration}
                    title={registrationClosed ? 'Reopen registration so players can join' : 'Close registration to stop new players joining'}
                    aria-label={registrationClosed ? 'Reopen registration' : 'Close registration'}
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {togglingRegistration
                      ? <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                      : registrationClosed ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  </button>
                  <span className={`clay-pill inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${registrationClosed
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    }`}>
                    {registrationClosed ? 'Registration closed' : 'Open for registration'}
                  </span>
                </span>
              ) : isOpen && (
                <span className={`clay-pill inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${registrationClosed
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                  }`}>
                  {registrationClosed ? 'Registration closed' : 'Open for registration'}
                </span>
              )}
            </div>
            <p className="text-muted-foreground mt-1 text-sm">Conducted by {data.conductedBy}</p>

            {/* Everyone helping run this league besides the creator */}
            {data.coOrganizers.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {data.coOrganizers.map((co) => (
                  <span key={co.userId} className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full border border-violet-500/25 bg-violet-500/10 text-xs">
                    {co.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={co.photo} alt="" className="w-4.5 h-4.5 rounded-full object-cover" />
                    ) : (
                      <span className="w-4.5 h-4.5 rounded-full bg-muted inline-flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                        {(co.name || '?').slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="font-medium text-foreground/80">{co.name || 'Organizer'}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">Co-organizer</span>
                  </span>
                ))}
              </div>
            )}

            <div className="mt-3.5 max-w-xs">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3 h-3" />
                  {data.players.length} of {data.totalPlayers} slots filled
                </span>
                <span className="font-semibold text-foreground tabular-nums">{fillPct}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${fillPct}%` }} />
              </div>
            </div>
          </div>

          {/* Primary actions */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {showAddCard && (
              hasJoined ? (
                <span className="clay-pill inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-green-500/10 text-green-600 dark:text-green-400">
                  Joined ✓
                </span>
              ) : profile ? (
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  className="btn-premium inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {joining && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {joining ? 'Joining…' : 'Join League'}
                </button>
              ) : sessionStatus === 'unauthenticated' ? (
                <button
                  onClick={() => signIn('google', { callbackUrl: leagueRedirectUrl })}
                  className="btn-premium inline-flex items-center px-5 py-2.5 rounded-xl text-sm font-semibold"
                >
                  Sign in to Join
                </button>
              ) : sessionStatus === 'authenticated' ? (
                <button
                  onClick={() => router.push(`/profile?redirect=${encodeURIComponent(leagueRedirectUrl)}`)}
                  className="btn-premium inline-flex items-center px-5 py-2.5 rounded-xl text-sm font-semibold"
                >
                  Complete Profile to Join
                </button>
              ) : null
            )}
            {canManage && data.players.length > 0 && (
              <button
                onClick={() => router.push(`/leagues/${id}/auction`)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-linear-to-br from-indigo-600 via-violet-600 to-indigo-600 hover:from-indigo-500 hover:via-violet-500 hover:to-indigo-500 transition-all duration-200 shadow-[0_0_24px_rgba(99,102,241,0.3)] hover:shadow-[0_0_36px_rgba(124,58,237,0.45)] hover:-translate-y-0.5 active:translate-y-0"
              >
                <Gavel className="w-4 h-4" />
                Start Auction
              </button>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mt-6">
          {canManage && (
            <>
              <button onClick={() => router.push(`/leagues/${id}/players/new`)} className="toolbar-btn">
                <UserPlus className="w-3.5 h-3.5" />Add Player
              </button>
              <button onClick={() => router.push(`/leagues/${id}/teams`)} className="toolbar-btn">
                <Users className="w-3.5 h-3.5" />Teams
              </button>
              <button onClick={() => router.push(`/leagues/${id}/matches`)} className="toolbar-btn">
                <BarChart2 className="w-3.5 h-3.5" />Matches
              </button>
              <button onClick={() => router.push(`/leagues/${id}/analytics`)} className="toolbar-btn">
                <Activity className="w-3.5 h-3.5" />Analytics
              </button>
              <button onClick={() => router.push(`/leagues/${id}/leaderboard`)} className="toolbar-btn">
                <Trophy className="w-3.5 h-3.5" />Leaderboard
              </button>
              <button onClick={() => router.push(`/leagues/${id}/sponsors/manage`)} className="toolbar-btn">
                <Handshake className="w-3.5 h-3.5" />Sponsors
              </button>
              {/* Only the creator manages who co-organizes */}
              {data.isCreator && (
                <button onClick={() => setCoOrgOpen(true)} className="toolbar-btn" title="Invite trusted people to help run this league">
                  <ShieldCheck className="w-3.5 h-3.5" />Co-Organizers
                </button>
              )}
              <button onClick={() => setTemplatePanelOpen((v) => !v)} className="toolbar-btn" aria-expanded={templatePanelOpen}>
                <Palette className="w-3.5 h-3.5" />
                {templatePanelOpen ? 'Hide Templates' : 'Template'}
              </button>
              <button onClick={handleTogglePublic} disabled={togglingPublic} className="toolbar-btn">
                {data.isPublic
                  ? <><Lock className="w-3.5 h-3.5" />Make Private</>
                  : <><Globe className="w-3.5 h-3.5" />Make Public</>}
              </button>
              <button onClick={() => router.push(`/leagues/${id}/clone`)} className="toolbar-btn" title="Create a copy of this league">
                <CopyPlus className="w-3.5 h-3.5" />Clone
              </button>
              {hasAuctionData && (
                <button onClick={handleResetAuction} disabled={resettingAuction} className="toolbar-btn hover:text-destructive hover:border-destructive/40" title="Clear all sold players and unsold flags">
                  {resettingAuction
                    ? <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                    : <RotateCcw className="w-3.5 h-3.5" />}
                  Reset Auction
                </button>
              )}
            </>
          )}
          {/* Public leagues are open for anyone to explore the squads & standings */}
          {!canManage && data.isPublic && (
            <>
              <button onClick={() => router.push(`/leagues/${id}/teams`)} className="toolbar-btn">
                <Users className="w-3.5 h-3.5" />Teams
              </button>
              <button onClick={() => router.push(`/leagues/${id}/analytics`)} className="toolbar-btn">
                <Activity className="w-3.5 h-3.5" />Analytics
              </button>
              <button onClick={() => router.push(`/leagues/${id}/leaderboard`)} className="toolbar-btn">
                <Trophy className="w-3.5 h-3.5" />Leaderboard
              </button>
              <button onClick={() => router.push(`/leagues/${id}/sponsors`)} className="toolbar-btn">
                <Handshake className="w-3.5 h-3.5" />Sponsors
              </button>
            </>
          )}
          {data.isPublic && data.joinCode && (
            <button
              onClick={() => copyLink(`${origin}/leagues/discover`, 'Discover link')}
              className="clay-pill inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-xs font-mono font-semibold tracking-widest bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/15 transition-colors"
              title="Join code — click to copy the discover page link"
            >
              <Globe className="w-3 h-3" />{data.joinCode}
            </button>
          )}

          {/* Share & Export menu */}
          {/* `static` on mobile is deliberate: it hands the menu's containing
              block to the `relative z-30` header wrapper, so the panel spans the
              header width instead of hanging off this button. The toolbar is
              `flex-wrap`, so the button's own x-position depends on how the
              pills happen to wrap — anchoring a fixed-width panel to it pushed
              the panel off the left edge of the viewport on phones. From `sm`
              up there's room, so it goes back to being button-anchored. */}
          <div className="static sm:relative" ref={shareRef}>
            <button onClick={() => setShareOpen((v) => !v)} className="toolbar-btn" aria-expanded={shareOpen} aria-haspopup="menu">
              <Share2 className="w-3.5 h-3.5" />
              Share & Export
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${shareOpen ? 'rotate-180' : ''}`} />
            </button>
            {shareOpen && (
              <div
                className="menu-panel absolute top-full mt-2 right-0 left-0 w-auto sm:left-auto sm:w-64 max-h-[70vh] overflow-y-auto p-1.5 z-50"
                role="menu"
              >
                <p className="px-3 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Share</p>
                <button className="menu-item" onClick={() => { copyLink(`${origin}/leagues/${id}`, 'View link'); setShareOpen(false); }}>
                  <Link2 className="w-3.5 h-3.5 text-muted-foreground" />Copy View Link
                </button>
                {canManage && (
                  <button className="menu-item" onClick={() => { copyLink(`${origin}/leagues/${id}?open=true`, 'Register link'); setShareOpen(false); }}>
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />Copy Register Link
                  </button>
                )}
                {data.players.length > 0 && (
                  <>
                    <div className="my-1.5 h-px bg-border/70" />
                    <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Export</p>
                    <button className="menu-item" onClick={() => { handleDownloadRoster(); setShareOpen(false); }}>
                      <FileText className="w-3.5 h-3.5 text-muted-foreground" />Roster PDF
                    </button>
                    {canManage && (
                      <>
                        <button className="menu-item" onClick={() => { handleSquadPoster(); setShareOpen(false); }}>
                          <ImageDown className="w-3.5 h-3.5 text-muted-foreground" />Squad Poster
                        </button>
                        <DownloadPDFButton
                          players={data.players}
                          leagueName={data.name}
                          conductedBy={data.conductedBy}
                          templateId={activeTemplateId}
                          logoUrl={data.logoUrl}
                          className="menu-item"
                        />
                      </>
                    )}
                    {canManage && data.teams.length > 0 && (
                      <>
                        <div className="my-1.5 h-px bg-border/70" />
                        <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Teams</p>
                        <button className="menu-item" disabled={!!teamExporting} onClick={() => handleTeamExport('roster')}>
                          {teamExporting === 'roster'
                            ? <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                            : <UsersRound className="w-3.5 h-3.5 text-muted-foreground" />}
                          Team-wise Roster PDF
                        </button>
                        <button className="menu-item" disabled={!!teamExporting} onClick={() => handleTeamExport('posters')}>
                          {teamExporting === 'posters'
                            ? <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                            : <Images className="w-3.5 h-3.5 text-muted-foreground" />}
                          Squad Posters (photos)
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex-1" />

          {data.isCreator && (
            <button
              onClick={handleDeleteLeague}
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/5 transition-all duration-200"
              title="Delete league"
              aria-label="Delete league"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Template panel */}
      {canManage && templatePanelOpen && (
        <div className="mb-6 rounded-2xl border border-border bg-card/70 backdrop-blur-xl p-5 animate-scale-in">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-gradient-green">Card Template</p>
            {savingTemplate && <span className="text-xs text-muted-foreground animate-pulse">Saving...</span>}
          </div>
          <TemplateSelector value={activeTemplateId} onChange={handleTemplateChange} />
        </div>
      )}

      <Separator className="mb-6" />

      {/* Search */}
      {data.players.length > 0 && !playersHidden && (
        <div className="mb-6 flex items-center gap-3">
          <div className="relative flex-1 max-w-3xl mx-auto">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search players…"
              className="w-full h-10 pl-9 pr-9 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Clear search">
                <X size={14} />
              </button>
            )}
          </div>
          {debouncedQuery && (
            <span className="text-sm text-muted-foreground shrink-0">
              {filteredPlayers.length} of {data.players.length}
            </span>
          )}
        </div>
      )}

      {/* Player grid */}
      {data.players.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-5 animate-fade-in-up">
          <div className="relative">
            <div className="absolute inset-0 bg-green-400/15 rounded-full blur-3xl scale-[2.5]" aria-hidden="true" />
            <span className="relative text-6xl animate-float select-none">🏏</span>
          </div>
          <div className="text-center space-y-1.5">
            <h2 className="text-lg font-bold">No player cards yet</h2>
            <p className="text-muted-foreground text-sm text-center max-w-xs leading-relaxed">
              {canManage
                ? 'Add players yourself, or share the register link so they can join on their own.'
                : showAddCard
                  ? 'Be the first to add your cricket player card to this league!'
                  : 'The creator has not opened this league for registration yet.'}
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => router.push(`/leagues/${id}/players/new`)}
              className="btn-premium inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold"
            >
              <UserPlus className="w-4 h-4" />
              Add Player
            </button>
          )}
          {showAddCard && (
            hasJoined ? (
              <span className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
                Joined ✓
              </span>
            ) : profile ? (
              <button
                onClick={handleJoin}
                disabled={joining}
                className="btn-premium inline-flex items-center px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {joining ? 'Joining…' : 'Join League'}
              </button>
            ) : sessionStatus === 'unauthenticated' ? (
              <button
                onClick={() => signIn('google', { callbackUrl: leagueRedirectUrl })}
                className="btn-premium inline-flex items-center px-6 py-2.5 rounded-xl text-sm font-semibold"
              >
                Sign in to Join
              </button>
            ) : sessionStatus === 'authenticated' ? (
              <button
                onClick={() => router.push(`/profile?redirect=${encodeURIComponent(leagueRedirectUrl)}`)}
                className="btn-premium inline-flex items-center px-6 py-2.5 rounded-xl text-sm font-semibold"
              >
                Complete Profile to Join
              </button>
            ) : null
          )}
        </div>
      ) : playersHidden ? (
        <div className="flex flex-col items-center justify-center py-20 gap-6 animate-fade-in-up text-center">
          <div className="relative">
            <div className="absolute inset-0 bg-amber-400/15 rounded-full blur-3xl scale-[2.5]" aria-hidden="true" />
            <span className="relative text-6xl select-none">🏆</span>
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-black text-gradient-gold">Auction Completed</h2>
            <p className="text-muted-foreground text-sm max-w-sm leading-relaxed mx-auto">
              All {data.players.length} players have been auctioned. Browse the final squads, or view the player cards below.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button onClick={() => router.push(`/leagues/${id}/wrapped`)} className="toolbar-btn text-amber-600 dark:text-amber-400">
              <Sparkles className="w-3.5 h-3.5" />Auction Wrapped
            </button>
            {(canManage || data.isPublic) && (
              <>
                <button onClick={() => router.push(`/leagues/${id}/teams`)} className="toolbar-btn">
                  <Users className="w-3.5 h-3.5" />View Squads
                </button>
                <button onClick={() => router.push(`/leagues/${id}/leaderboard`)} className="toolbar-btn">
                  <Trophy className="w-3.5 h-3.5" />Leaderboard
                </button>
              </>
            )}
          </div>
          <button
            onClick={() => setShowPlayers(true)}
            className="btn-premium inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold"
          >
            <Images className="w-4 h-4" />View Player Cards
          </button>
        </div>
      ) : filteredPlayers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 animate-fade-in-up">
          <Search size={36} className="text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">No players match &ldquo;{debouncedQuery}&rdquo;</p>
          <button onClick={() => setSearchQuery('')} className="text-sm text-primary hover:underline underline-offset-2 transition-colors">Clear search</button>
        </div>
      ) : (
        <>
          {auctionCompleted && (
            <div className="flex justify-center mb-6 animate-fade-in-up">
              <button onClick={() => setShowPlayers(false)} className="toolbar-btn">
                <ArrowUp className="w-3.5 h-3.5" />Hide Player Cards
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 justify-items-center">
          {filteredPlayers.map((player, i) => (
            <div
              key={player.id}
              className="animate-fade-in-up cursor-pointer"
              style={{ animationDelay: `${i * 0.06}s` }}
              // Open the full view on click, but let the card's own buttons
              // (edit, delete, icon badge) act normally
              onClick={(e) => { if (!(e.target as HTMLElement).closest('button')) setViewPlayer(player); }}
            >
              <PlayerCard
                player={player}
                templateId={activeTemplateId}
                leagueName={data.name}
                conductedBy={data.conductedBy}
                logoUrl={data.logoUrl}
                showEdit={canEditPlayer(player.creatorToken, player.id)}
                onEdit={() => router.push(`/leagues/${id}/players/${player.id}/edit`)}
                onDelete={() => handleDeletePlayer(player.id)}
              />
            </div>
          ))}
          </div>
        </>
      )}

      {/* Co-organizer management (creator only) */}
      {coOrgOpen && (
        <CoOrganizersModal
          leagueId={id}
          onClose={(changed) => { setCoOrgOpen(false); if (changed) fetchLeague(); }}
        />
      )}

      {/* Full player view */}
      <Dialog open={!!viewPlayer} onOpenChange={(open) => { if (!open) setViewPlayer(null); }}>
        <DialogContent className="sm:max-w-2xl p-0 max-h-[92vh] overflow-y-auto bg-transparent ring-0 shadow-none">
          <DialogTitle className="sr-only">{viewPlayer?.name ?? 'Player'} details</DialogTitle>
          {viewPlayer && (() => {
            const team = viewPlayer.teamId ? data.teams.find((t) => t.id === viewPlayer.teamId) : null;
            const teamMeta = team
              ? { name: team.name, colorHex: team.colorHex }
              : viewPlayer.iconOfTeam
                ? { name: viewPlayer.iconOfTeam.name, colorHex: viewPlayer.iconOfTeam.colorHex }
                : null;
            return (
              <PlayerFullView
                player={viewPlayer}
                team={teamMeta}
                leagueName={data.name}
                conductedBy={data.conductedBy}
              />
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Scroll buttons */}
      {(showScrollTop || showScrollBottom) && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 animate-scale-in">
          {showScrollTop && (
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center justify-center w-11 h-11 rounded-full bg-background/90 backdrop-blur border border-border/70 shadow-xl text-muted-foreground hover:text-foreground hover:bg-background hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-200"
              aria-label="Scroll to top"
            >
              <ArrowUp size={18} />
            </button>
          )}
          {showScrollBottom && (
            <button
              onClick={() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })}
              className="flex items-center justify-center w-11 h-11 rounded-full bg-background/90 backdrop-blur border border-border/70 shadow-xl text-muted-foreground hover:text-foreground hover:bg-background hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-200"
              aria-label="Scroll to bottom"
            >
              <ArrowDown size={18} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function LeaguePage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-10 text-muted-foreground animate-pulse">Loading…</div>}>
      <LeaguePageInner />
    </Suspense>
  );
}
