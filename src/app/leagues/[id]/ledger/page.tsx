'use client';

// The league's income & expense sheet, as published by its organizers.
//
// Optional by design: most leagues have no ledger, so "nothing here" is a
// first-class state rather than an error — organizers see a create prompt,
// members see a plain "not published yet". Access is enforced by the API
// (members only, published only); this page just renders whatever came back.

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Pencil, ReceiptText, EyeOff, Lock, Plus } from 'lucide-react';
import Markdown from '@/components/Markdown';
import type { LeagueWithPlayers, LedgerResponse } from '@/lib/types';

function formatUpdated(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function LedgerPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [league, setLeague] = useState<LeagueWithPlayers | null>(null);
  const [data, setData] = useState<LedgerResponse | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [leagueRes, ledgerRes] = await Promise.all([
      fetch(`/api/leagues/${id}`),
      fetch(`/api/leagues/${id}/ledger`),
    ]);
    if (!leagueRes.ok) { router.push('/'); return; }
    setLeague(await leagueRes.json());

    // 403 = signed in but not part of this league. Worth its own message: the
    // fix is to join the league, not to sign in again.
    if (ledgerRes.status === 403) setForbidden(true);
    else if (ledgerRes.ok) setData(await ledgerRes.json());
    setLoading(false);
  }, [id, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading || !league) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="space-y-3">
          <div className="h-8 w-48 rounded-xl bg-muted shimmer" />
          <div className="h-64 rounded-2xl bg-muted shimmer" />
        </div>
      </div>
    );
  }

  const ledger = data?.ledger ?? null;
  const canManage = data?.canManage ?? false;
  const isDraft = !!ledger && !ledger.published;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 animate-fade-in-up">
      <div className="mb-7">
        <button onClick={() => router.push(`/leagues/${id}`)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Back to League
        </button>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-gradient-green tracking-tight">Income &amp; Expenses</h1>
              {isDraft && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <EyeOff className="w-3 h-3" />Draft
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-sm mt-1">{league.name}</p>
          </div>
          {canManage && (
            <button onClick={() => router.push(`/leagues/${id}/ledger/edit`)} className="toolbar-btn">
              {ledger ? <><Pencil className="w-3.5 h-3.5" />Edit</> : <><Plus className="w-3.5 h-3.5" />Create Ledger</>}
            </button>
          )}
        </div>
      </div>

      {forbidden ? (
        <EmptyState
          icon={<Lock className="w-6 h-6 text-green-600 dark:text-green-400" />}
          title="Members only"
          body="This league's accounts are shared with its players and organizers. Join the league to see them."
        />
      ) : !ledger ? (
        <EmptyState
          icon={<ReceiptText className="w-6 h-6 text-green-600 dark:text-green-400" />}
          title={canManage ? 'No ledger yet' : 'Nothing published yet'}
          body={canManage
            ? 'Record what the league took in and spent — registration fees, sponsorships, ground rent, trophies. Entirely optional, and nothing is shared until you publish it.'
            : 'The organizers haven\'t published this league\'s income and expenses.'}
          action={canManage ? (
            <button onClick={() => router.push(`/leagues/${id}/ledger/edit`)}
              className="btn-premium inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm">
              <Plus className="w-4 h-4" />Create Ledger
            </button>
          ) : undefined}
        />
      ) : (
        <>
          {isDraft && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3">
              <EyeOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                This is a draft — only you and the other organizers can see it.{' '}
                <button onClick={() => router.push(`/leagues/${id}/ledger/edit`)}
                  className="font-semibold text-amber-600 dark:text-amber-400 hover:underline">
                  Publish it
                </button>{' '}
                to share it with the league&apos;s players.
              </p>
            </div>
          )}
          <div>
            <Markdown content={ledger.content} />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Last updated {formatUpdated(ledger.updatedAt)}
            {ledger.updatedByName ? ` by ${ledger.updatedByName}` : ''}
          </p>
        </>
      )}
    </div>
  );
}

function EmptyState({ icon, title, body, action }: {
  icon: React.ReactNode; title: string; body: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center animate-fade-in-up">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/10 rounded-full blur-2xl scale-[2]" aria-hidden="true" />
        <div className="relative w-14 h-14 rounded-2xl bg-linear-to-br from-green-500/15 to-emerald-600/15 border border-green-500/20 flex items-center justify-center animate-float">
          {icon}
        </div>
      </div>
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-muted-foreground text-sm mt-1 max-w-md">{body}</p>
      </div>
      {action}
    </div>
  );
}
