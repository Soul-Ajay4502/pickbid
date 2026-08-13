'use client';

import { useEffect, useState } from 'react';
import { Award } from 'lucide-react';
import CertificateDownloadButtons from './CertificateDownloadButtons';
import type { LeagueCertificate } from '@/lib/types';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function CertificateRow({ cert }: { cert: LeagueCertificate }) {
  const accent = cert.teamColorHex ?? '#22c55e';

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-background/40 p-4 sm:flex-row sm:items-center">
      {/* League crest */}
      {cert.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cert.logoUrl}
          alt=""
          className="h-11 w-11 shrink-0 rounded-lg object-contain"
        />
      ) : (
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-base font-black text-amber-600 dark:text-amber-400">
          {(cert.leagueName.trim()[0] || 'C').toUpperCase()}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-foreground">{cert.leagueName}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
            {cert.role}
          </span>
          {cert.teamName ? ` · ${cert.teamName}` : ''}
          {' · '}Issued {formatDate(cert.releasedAt)}
        </p>
      </div>

      <CertificateDownloadButtons
        leagueId={cert.leagueId}
        playerId={cert.playerId}
        leagueName={cert.leagueName}
        playerName={cert.playerName}
      />
    </div>
  );
}

/**
 * "My Certificates" — every participation certificate this player can download.
 *
 * A league only appears here once its organizers have released certificates, so
 * an empty list is the normal state mid-season rather than an error.
 */
export default function MyCertificates() {
  const [certificates, setCertificates] = useState<LeagueCertificate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/profile/certificates')
      .then((r) => (r.ok ? r.json() : { certificates: [] }))
      .then((d) => setCertificates(Array.isArray(d.certificates) ? d.certificates : []))
      .catch(() => setCertificates([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-foreground">
          <Award className="h-4 w-4 text-amber-500" />
          My Certificates
        </h2>
        {!loading && certificates.length > 0 && (
          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
            {certificates.length}
          </span>
        )}
        <div className="h-px flex-1 bg-border/60" />
      </div>

      {loading ? (
        <div className="h-[76px] rounded-xl bg-muted shimmer" />
      ) : certificates.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-xs text-muted-foreground">
          No certificates yet. When a league you played in finishes, its organizer
          releases participation certificates and they appear here to download.
        </p>
      ) : (
        <div className="space-y-2.5">
          {certificates.map((cert) => (
            <CertificateRow key={`${cert.leagueId}:${cert.playerId}`} cert={cert} />
          ))}
        </div>
      )}
    </section>
  );
}
