'use client';

import { useEffect, useState } from 'react';
import PlayerCard, { CARD_W, CARD_H } from '@/components/PlayerCard';
import type { Player, LivePurse } from '@/lib/types';

const player: Player = {
  id: '1', leagueId: 'preview', name: 'Virat Sharma', photo: '',
  battingType: 'Right-Hand Bat', bowlingType: 'Right-Arm Medium',
  role: 'All-Rounder', isWicketKeeper: false, creatorToken: '',
  createdAt: '2024-01-01T00:00:00.000Z',
  statsMatches: 42, statsRuns: 1280, statsWickets: 18, statsAverage: 34.5, statsSR: 128,
};

const purses: LivePurse[] = [
  { id: 'a', name: 'Chennai Strikers', color: '#facc15', budget: 100000, spent: 42000, count: 4, maxPlayers: 11 },
  { id: 'b', name: 'Mumbai Titans', color: '#3b82f6', budget: 100000, spent: 61000, count: 6, maxPlayers: 11 },
  { id: 'c', name: 'Delhi Royals', color: '#ef4444', budget: 100000, spent: 23000, count: 3, maxPlayers: 11 },
];

function fmt(n: number): string {
  if (!n) return '₹0';
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
}

export default function ReproWatch() {
  const [scale, setScale] = useState(1.2);
  const [dbg, setDbg] = useState('');
  useEffect(() => {
    function upd() {
      const h = window.innerHeight - 280, w = window.innerWidth - 64;
      setScale(Math.max(0.5, Math.min(h / CARD_H, w / CARD_W, 2.6)));
    }
    upd();
    window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, []);
  useEffect(() => {
    const id = setTimeout(() => {
      const cardEl = document.querySelector('[data-card-root]') as HTMLElement | null;
      const r = cardEl?.getBoundingClientRect();
      setDbg(`vw=${window.innerWidth} docScrollW=${document.documentElement.scrollWidth} bodyScrollW=${document.body.scrollWidth} cardL=${r?.left.toFixed(1)} cardR=${r?.right.toFixed(1)} cardW=${r ? (r.right - r.left).toFixed(1) : '?'} cardCenter=${r ? ((r.left + r.right) / 2).toFixed(1) : '?'} vpCenter=${window.innerWidth / 2}`);
    }, 300);
    return () => clearTimeout(id);
  }, [scale]);

  return (
    <div className="h-screen flex flex-col bg-[oklch(0.085_0.014_260)] text-white overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-5 sm:px-7 py-3.5 border-b border-white/8 bg-white/3 backdrop-blur-xl shrink-0">
        <div className="min-w-0">
          <h1 className="text-base sm:text-xl font-black truncate">Demo Premier League</h1>
          <p className="text-[11px] sm:text-xs text-white/40 truncate">Conducted by Demo Org</p>
        </div>
        <div className="flex items-center gap-3 sm:gap-5 text-sm font-semibold shrink-0">
          <span className="text-green-400 tabular-nums hidden sm:inline">13 Sold</span>
          <span className="text-white/40 tabular-nums hidden sm:inline">47 Left</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[11px] font-bold uppercase tracking-wider">
            <span className="relative flex h-2 w-2"><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" /></span>
            Live
          </span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center relative overflow-hidden px-4">
        <div className="relative z-10 flex flex-col items-center gap-5">
          <div className="relative" style={{ width: Math.round(CARD_W * scale), height: Math.round(CARD_H * scale), outline: '2px dashed lime' }}>
            <div data-card-root style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
              <PlayerCard player={player} templateId="" leagueName="Demo Premier League" conductedBy="Demo Org" logoUrl="" pdfMode />
            </div>
          </div>
          <div className="relative z-40 flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/8 border border-white/15 backdrop-blur">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: '#3b82f6' }} />
            <span className="text-base sm:text-xl font-bold">Chennai Strikers</span>
            <span className="text-white/30">·</span>
            <span className="text-base sm:text-2xl font-black text-green-400 tabular-nums">₹1,200</span>
          </div>
        </div>
        {/* fixed red center reference line */}
        <div style={{ position: 'fixed', top: 0, bottom: 0, left: '50%', width: 1, background: 'red', zIndex: 999 }} />
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000, background: '#000', color: '#0f0', font: '10px monospace', padding: 3 }}>{dbg}</div>
      </main>

      <div className="flex gap-2.5 px-4 py-3 border-t border-white/8 bg-white/2 overflow-x-auto shrink-0">
        {purses.map(t => (
          <div key={t.id} className="min-w-40 shrink-0 rounded-xl border px-3 py-2 border-white/8 bg-white/4">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: t.color }} />
              <span className="text-xs font-semibold text-white/75 truncate flex-1">{t.name}</span>
              <span className="text-[10px] tabular-nums font-bold text-white/40">{t.count}/{t.maxPlayers}</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px] tabular-nums whitespace-nowrap">
              <span className="text-white/40">Spent <span className="text-white/70 font-semibold">{fmt(t.spent)}</span></span>
              <span className="text-white/40">Bal <span className="text-green-400 font-semibold">{fmt(t.budget! - t.spent)}</span></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
