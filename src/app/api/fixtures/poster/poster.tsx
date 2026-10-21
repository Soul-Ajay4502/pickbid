// The fixture poster, rendered server-side with satori via ImageResponse — the
// same reasoning as the Auction Wrapped poster: a server render is identical
// on every phone, where html2canvas would pick up each device's own fonts.
//
// Every round header and match row is drawn at the exact heights in
// POSTER_LAYOUT, because `paginatePoster` decided what goes on this page from
// those numbers without rendering anything.

import { ImageResponse } from 'next/og';
import { SITE_HOST } from '@/lib/seo';
import {
  BODY_FONT,
  POSTER_FORMATS,
  POSTER_LAYOUT,
  getPosterTemplate,
  posterContentHeight,
  type FixturePosterInput,
  type PosterBlock,
  type PosterPage,
  type PosterTemplate,
} from '@/lib/fixtures';

type FontEntry = { name: string; data: ArrayBuffer; weight: 400 | 500 | 600 | 700 | 800 | 900; style: 'normal' };

// Whole TrueType files from Google Fonts, cached for the life of the instance
// so only the first poster pays for them. A failed fetch isn't cached, and the
// poster then falls back to the bundled face rather than failing.
const fontCache = new Map<string, Promise<ArrayBuffer | null>>();

function loadFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  const key = `${family}:${weight}`;
  let pending = fontCache.get(key);
  if (!pending) {
    pending = (async () => {
      try {
        // A plain server fetch is served TrueType, which satori reads (it can't read woff2).
        const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`;
        const css = await (await fetch(cssUrl, { signal: AbortSignal.timeout(4000) })).text();
        const src = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
        if (!src) return null;
        const res = await fetch(src, { signal: AbortSignal.timeout(6000) });
        return res.ok ? await res.arrayBuffer() : null;
      } catch {
        return null;
      }
    })();
    fontCache.set(key, pending);
    void pending.then((data) => { if (!data) fontCache.delete(key); });
  }
  return pending;
}

async function fontsFor(t: PosterTemplate): Promise<{ fonts: FontEntry[]; display: string; body: string; charWidth: number; condensed: boolean }> {
  const wanted: [string, FontEntry['weight']][] = [
    [BODY_FONT, 500], [BODY_FONT, 700], [BODY_FONT, 800],
    [t.display.family, t.display.weight],
  ];
  const loaded = await Promise.all(wanted.map(([family, weight]) => loadFont(family, weight)));
  const fonts: FontEntry[] = [];
  wanted.forEach(([name, weight], i) => {
    const data = loaded[i];
    if (data) fonts.push({ name, data, weight, style: 'normal' });
  });
  const has = (family: string) => fonts.some((f) => f.name === family);
  // If the display face didn't load, the title falls back to the body face,
  // which is neither condensed nor as wide as some display faces.
  const ownDisplay = has(t.display.family);
  return {
    fonts,
    body: has(BODY_FONT) ? BODY_FONT : 'sans-serif',
    display: ownDisplay ? t.display.family : has(BODY_FONT) ? BODY_FONT : 'sans-serif',
    charWidth: ownDisplay ? t.display.charWidth : 0.6,
    condensed: ownDisplay && t.display.charWidth <= 0.5,
  };
}

/** "SUN 1 NOV" for a round; "1 NOV" / "8 NOV 2026" for the header's date range. */
function day(date: string, style: 'round' | 'span' | 'spanEnd'): string {
  return new Date(`${date}T00:00:00Z`)
    .toLocaleDateString('en-GB', {
      weekday: style === 'round' ? 'short' : undefined,
      day: 'numeric',
      month: 'short',
      year: style === 'spanEnd' ? 'numeric' : undefined,
      timeZone: 'UTC',
    })
    .replace(/,/g, '')
    .toUpperCase();
}

/**
 * Biggest title size whose wrapped lines fit the header's title budget. Satori
 * can't measure text, so this estimates from the face's average glyph width,
 * leaving a margin: an underestimate would wrap a line more than planned and
 * the overflow would clip it.
 */
function titleSize(title: string, charWidth: number, budget: number, width: number): number {
  for (const size of [110, 96, 84, 72, 62, 54, 48]) {
    const perLine = Math.max(1, Math.floor((width * 0.92) / (size * charWidth)));
    const lines = Math.ceil(title.length / perLine);
    if (lines * size * 1.05 <= budget) return size;
  }
  return 44;
}

function Ornaments({ t, w, h }: { t: PosterTemplate; w: number; h: number }) {
  const fill = { position: 'absolute' as const, display: 'flex' };
  switch (t.id) {
    case 'royal':
      return (
        <>
          <div style={{ ...fill, top: 26, left: 26, width: w - 52, height: h - 52, border: '2px solid rgba(212,175,55,0.5)', borderRadius: 10 }} />
          <div style={{ ...fill, top: 38, left: 38, width: w - 76, height: h - 76, border: '1px solid rgba(212,175,55,0.22)', borderRadius: 6 }} />
        </>
      );
    case 'ivory':
      return (
        <>
          <div style={{ ...fill, top: 0, left: 0, width: w, height: 18, backgroundColor: t.accent }} />
          <div style={{ ...fill, top: 24, left: 0, width: w, height: 3, backgroundColor: t.accent2 }} />
          <div style={{ ...fill, bottom: 0, left: 0, width: w, height: 18, backgroundColor: t.accent }} />
          <div style={{ ...fill, bottom: 24, left: 0, width: w, height: 3, backgroundColor: t.accent2 }} />
        </>
      );
    case 'electric':
      return (
        <>
          <div style={{ ...fill, top: -200, right: -200, width: 560, height: 560, borderRadius: 9999, border: '2px solid rgba(255,255,255,0.14)' }} />
          <div style={{ ...fill, top: -120, right: -120, width: 400, height: 400, borderRadius: 9999, border: '2px solid rgba(255,255,255,0.08)' }} />
          <div style={{ ...fill, bottom: -160, left: -140, width: 420, height: 420, borderRadius: 9999, border: '2px solid rgba(255,255,255,0.1)' }} />
        </>
      );
    case 'crimson':
      return (
        <>
          <div style={{ ...fill, top: 70, right: -260, width: 900, height: 64, transform: 'rotate(-32deg)', backgroundImage: `linear-gradient(90deg, transparent, ${t.accent})`, opacity: 0.55 }} />
          <div style={{ ...fill, top: 170, right: -300, width: 900, height: 22, transform: 'rotate(-32deg)', backgroundImage: `linear-gradient(90deg, transparent, ${t.accent2})`, opacity: 0.5 }} />
        </>
      );
    case 'midnight': {
      // Synthwave floor: lines bunch towards the horizon and fan out below it.
      const gh = Math.round(h * 0.34);
      return (
        <div style={{ ...fill, bottom: 0, left: 0, width: w, height: gh }}>
          <svg width={w} height={gh} viewBox={`0 0 ${w} ${gh}`} fill="none">
            <line x1={0} y1={1} x2={w} y2={1} stroke="rgba(34,211,238,0.45)" strokeWidth={2} />
            {Array.from({ length: 9 }, (_, i) => {
              const y = gh * Math.pow((i + 1) / 9, 1.8);
              return <line key={`h${i}`} x1={0} y1={y} x2={w} y2={y} stroke="rgba(244,114,182,0.22)" strokeWidth={2} />;
            })}
            {Array.from({ length: 17 }, (_, i) => {
              const k = i - 8;
              return <line key={`v${i}`} x1={w / 2 + k * 36} y1={0} x2={w / 2 + k * 250} y2={gh} stroke="rgba(244,114,182,0.2)" strokeWidth={2} />;
            })}
          </svg>
        </div>
      );
    }
    case 'platinum':
      return (
        <>
          {[-260, 260, 760].map((left, i) => (
            <div key={i} style={{ ...fill, top: -h * 0.2, left, width: 140 + i * 50, height: h * 1.4, transform: 'rotate(28deg)', backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.055), transparent)' }} />
          ))}
          <div style={{ ...fill, top: 0, left: 0, width: w, height: 3, backgroundImage: 'linear-gradient(90deg, transparent, #e4e4e7, transparent)' }} />
        </>
      );
    case 'heritage': {
      // A red ball's seam, stitched across the top and bottom edges.
      const seam = (top: number, flip: boolean) => (
        <div style={{ ...fill, top, left: 0, width: w, height: 44 }}>
          <svg width={w} height={44} viewBox={`0 0 ${w} 44`} fill="none">
            <path d={flip ? `M0 30 Q ${w / 2} 6 ${w} 30` : `M0 14 Q ${w / 2} 38 ${w} 14`} stroke="#b91c1c" strokeWidth={2.5} strokeDasharray="12 9" strokeLinecap="round" />
            <path d={flip ? `M0 38 Q ${w / 2} 14 ${w} 38` : `M0 6 Q ${w / 2} 30 ${w} 6`} stroke="rgba(185,28,28,0.35)" strokeWidth={1.5} />
          </svg>
        </div>
      );
      return <>{seam(0, false)}{seam(h - 44, true)}</>;
    }
    case 'cleansheet':
      return (
        <>
          <div style={{ ...fill, top: 0, left: 0, width: w, height: 14, backgroundColor: '#0a0a0a' }} />
          <div style={{ ...fill, top: 14, left: 0, width: 10, height: h - 14, backgroundColor: t.accent2 }} />
        </>
      );
    case 'monsoon':
      return (
        <>
          {[780, 580, 380].map((s, i) => (
            <div key={i} style={{ ...fill, bottom: -s / 2, left: -s / 2, width: s, height: s, borderRadius: 9999, border: `2px solid rgba(153,246,228,${0.08 + i * 0.03})` }} />
          ))}
          {[440, 280].map((s, i) => (
            <div key={`t${i}`} style={{ ...fill, top: -s / 2, right: -s / 2, width: s, height: s, borderRadius: 9999, border: '2px solid rgba(253,230,138,0.14)' }} />
          ))}
        </>
      );
    case 'sunset': {
      // A retro sun setting behind the footer, striped like a festival banner.
      const d = 620;
      return (
        <div style={{ ...fill, bottom: -d * 0.62, left: (w - d) / 2, width: d, height: d, borderRadius: 9999, overflow: 'hidden', opacity: 0.32, flexDirection: 'column', backgroundImage: 'linear-gradient(180deg, #fde047 0%, #f97316 60%)' }}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} style={{ display: 'flex', width: d, height: 6 + i * 3, marginTop: i === 0 ? 70 : 16, backgroundColor: 'rgba(59,7,100,0.85)' }} />
          ))}
        </div>
      );
    }
    case 'pitch':
      return (
        <>
          {Array.from({ length: 8 }, (_, i) => (i % 2 === 1 ? (
            <div key={i} style={{ ...fill, top: 0, left: (w / 8) * i, width: w / 8, height: h, backgroundColor: 'rgba(255,255,255,0.045)' }} />
          ) : null))}
          <div style={{ ...fill, top: 22, left: 22, width: w - 44, height: h - 44, borderRadius: 44, border: '2px solid rgba(255,255,255,0.24)' }} />
        </>
      );
    case 'jersey':
      return (
        <>
          {/* Side trims, like a kit's piping, and a V collar */}
          <div style={{ ...fill, top: 0, left: 20, width: 10, height: h, backgroundColor: t.accent, opacity: 0.85 }} />
          <div style={{ ...fill, top: 0, left: 36, width: 4, height: h, backgroundColor: t.accent2, opacity: 0.6 }} />
          <div style={{ ...fill, top: 0, right: 20, width: 10, height: h, backgroundColor: t.accent, opacity: 0.85 }} />
          <div style={{ ...fill, top: 0, right: 36, width: 4, height: h, backgroundColor: t.accent2, opacity: 0.6 }} />
          <div style={{ ...fill, top: 0, left: w / 2 - 100, width: 200, height: 80 }}>
            <svg width={200} height={80} viewBox="0 0 200 80" fill="none">
              <path d="M8 0 L100 66 L192 0" stroke={t.accent} strokeWidth={10} strokeLinejoin="round" />
              <path d="M30 0 L100 48 L170 0" stroke="rgba(253,230,138,0.5)" strokeWidth={3} />
            </svg>
          </div>
        </>
      );
    default: // floodlight: a slim lit strip across the top
      return <div style={{ ...fill, top: 0, left: 0, width: w, height: 8, backgroundImage: `linear-gradient(90deg, transparent, ${t.accent}, ${t.accent2}, transparent)` }} />;
  }
}

/**
 * The PICKBID watermark: the wordmark in faint diagonal rows across the whole
 * poster, alternate rows offset like brickwork. Spaced with margins — satori
 * doesn't apply `gap` between text boxes reliably, and run-together words read
 * as noise rather than a mark.
 */
function Watermark({ t, w, h }: { t: PosterTemplate; w: number; h: number }) {
  const rows = Math.ceil((h * 1.7) / 240);
  return (
    <div style={{ position: 'absolute', top: -h * 0.35, left: -w * 0.7, width: w * 2.4, height: h * 1.7, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transform: 'rotate(-24deg)' }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ display: 'flex', marginLeft: i % 2 ? 330 : 0 }}>
          {Array.from({ length: 5 }, (_, j) => (
            <div key={j} style={{ display: 'flex', marginRight: 200, fontSize: 76, fontWeight: 800, letterSpacing: 18, color: t.watermark, whiteSpace: 'nowrap' }}>PICKBID</div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Gavel({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m14.5 12.5-8 8a2.119 2.119 0 1 1-3-3l8-8" />
      <path d="m16 16 6-6" />
      <path d="m8 8 6-6" />
      <path d="m9 7 8 8" />
      <path d="m21 11-8-8" />
    </svg>
  );
}

function Dot({ color, t, size }: { color: string; t: PosterTemplate; size: number }) {
  return (
    <div style={{ display: 'flex', width: size, height: size, borderRadius: 9999, backgroundColor: color, border: `2px solid ${t.dark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.14)'}`, flexShrink: 0 }} />
  );
}

function Block({ block, input, t, narrow, display, condensed, columnWidth }: {
  block: PosterBlock; input: FixturePosterInput; t: PosterTemplate; narrow: boolean; display: string; condensed: boolean; columnWidth: number;
}) {
  const { roundHeader, row } = POSTER_LAYOUT;
  const ellipsis = { whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' as const };
  const nameStyle = { display: 'block', fontSize: 27, fontWeight: 700, color: t.text, maxWidth: 320, ...ellipsis };
  const team = (i: number) => input.teams[i];
  const dotColor = (i: number) => team(i).color ?? t.accent;
  const rowBox = {
    height: row - 8, marginBottom: 8, display: 'flex', alignItems: 'center',
    borderRadius: 16, backgroundColor: t.row, border: `1px solid ${t.rowBorder}`,
  };
  const vsPill = (width: number, height: number, fontSize: number) => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', width, height, borderRadius: 9999,
      backgroundImage: t.vsBg, color: t.vsText, fontSize, fontWeight: 800, letterSpacing: 2, flexShrink: 0,
    }}>VS</div>
  );
  // Two to a page, a row has half the width: the sides stack, one team per
  // line, which gives each name the whole row instead of a third of it.
  const stackedName = { display: 'block', fontSize: 19, fontWeight: 700, color: t.text, lineHeight: 1.15, maxWidth: columnWidth - 140, ...ellipsis };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: roundHeader, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 10 }}>
        <div style={{ height: 32, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', fontFamily: display, fontSize: condensed ? 30 : t.display.charWidth > 0.7 ? 19 : 22, fontWeight: 800, letterSpacing: condensed ? 3 : 4, color: t.accent, lineHeight: 1 }}>
            {`ROUND ${block.round}${block.continued ? ' · CONT.' : ''}`}
          </div>
          <div style={{ display: 'flex', flex: 1, height: 1, backgroundColor: t.rowBorder }} />
          {block.date && (
            <div style={{ display: 'flex', fontSize: narrow ? 15 : 18, fontWeight: 700, letterSpacing: 3, color: t.muted, lineHeight: 1 }}>{day(block.date, 'round')}</div>
          )}
        </div>
      </div>
      {block.matches.map(({ match, number }) =>
        narrow ? (
          <div key={number} style={{ ...rowBox, padding: '0 16px 0 14px' }}>
            <div style={{ display: 'flex', width: 34, fontSize: 15, fontWeight: 700, color: t.muted, flexShrink: 0 }}>
              {String(number).padStart(2, '0')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 2 }}>
              {[match.a, match.b].map((i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Dot color={dotColor(i)} t={t} size={10} />
                  <div style={stackedName}>{team(i).name}</div>
                </div>
              ))}
            </div>
            {vsPill(46, 28, 13)}
          </div>
        ) : (
          <div key={number} style={{ ...rowBox, padding: '0 22px' }}>
            <div style={{ display: 'flex', width: 54, fontSize: 17, fontWeight: 700, color: t.muted }}>
              {String(number).padStart(2, '0')}
            </div>
            <div style={{ display: 'flex', flex: 1, justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
              <div style={nameStyle}>{team(match.a).name}</div>
              <Dot color={dotColor(match.a)} t={t} size={14} />
            </div>
            <div style={{ display: 'flex', margin: '0 18px' }}>{vsPill(62, 34, 16)}</div>
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 12 }}>
              <Dot color={dotColor(match.b)} t={t} size={14} />
              <div style={nameStyle}>{team(match.b).name}</div>
            </div>
            <div style={{ display: 'flex', width: 54 }} />
          </div>
        ),
      )}
    </div>
  );
}

export async function renderFixturePoster(input: FixturePosterInput, pages: PosterPage[]): Promise<ImageResponse> {
  const t = getPosterTemplate(input.template);
  const { width: w, height: h } = POSTER_FORMATS[input.format];
  const { padX, top, header, footer, columnGap } = POSTER_LAYOUT;
  const page = pages[input.page - 1];
  const { fonts, display, body, charWidth, condensed } = await fontsFor(t);

  const innerWidth = w - padX * 2;
  const rounds = new Set(input.matches.map((m) => m.round)).size;
  const dates = input.matches.map((m) => m.date).filter((d): d is string => !!d).sort();
  const span = dates.length
    ? dates[0] === dates[dates.length - 1] ? day(dates[0], 'spanEnd') : `${day(dates[0], 'span')} – ${day(dates[dates.length - 1], 'spanEnd')}`
    : null;
  const title = t.upperTitle ? input.title.toUpperCase() : input.title;
  const titleBudget = input.subtitle ? 112 : 150;
  const size = titleSize(title, charWidth, titleBudget, innerWidth);
  const narrow = page.twoColumn;
  const columnWidth = narrow ? (innerWidth - columnGap) / 2 : innerWidth;

  const chips = [
    `${input.teams.length} TEAMS`,
    `${input.matches.length} ${input.matches.length === 1 ? 'MATCH' : 'MATCHES'}`,
    `${rounds} ${rounds === 1 ? 'ROUND' : 'ROUNDS'}`,
  ];

  return new ImageResponse(
    (
      <div style={{ width: w, height: h, display: 'flex', position: 'relative', backgroundImage: t.background, color: t.text, fontFamily: body }}>
        {t.glows.map((g, i) => (
          <div key={i} style={{ position: 'absolute', top: 0, left: 0, width: w, height: h, display: 'flex', backgroundImage: g }} />
        ))}
        <Ornaments t={t} w={w} h={h} />
        <Watermark t={t} w={w} h={h} />

        <div style={{ position: 'absolute', top: 0, left: 0, width: w, height: h, display: 'flex', flexDirection: 'column', padding: `${top}px ${padX}px 0` }}>
          {/* Header */}
          <div style={{ height: header, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 20px', borderRadius: 9999,
                backgroundColor: t.chip, border: `1px solid ${t.rowBorder}`, color: t.accent,
                fontSize: 18, fontWeight: 800, letterSpacing: 6,
              }}>
                <div style={{ display: 'flex', width: 8, height: 8, borderRadius: 9999, backgroundColor: t.accent }} />
                FIXTURES
              </div>
              {span && <div style={{ display: 'flex', fontSize: 19, fontWeight: 700, letterSpacing: 4, color: t.muted }}>{span}</div>}
            </div>
            <div style={{
              display: 'flex', marginTop: 24, maxHeight: titleBudget, overflow: 'hidden',
              fontFamily: display, fontSize: size, fontWeight: t.display.weight, lineHeight: 1.04,
              letterSpacing: condensed ? 2 : charWidth > 0.7 ? 0 : -1, color: t.text,
            }}>
              {title}
            </div>
            <div style={{ display: 'flex', marginTop: 14, width: 132, height: 6, borderRadius: 9999, backgroundImage: `linear-gradient(90deg, ${t.accent}, ${t.accent2})` }} />
            {input.subtitle && (
              <div style={{ display: 'flex', marginTop: 14, fontSize: 25, fontWeight: 500, color: t.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: innerWidth }}>
                {input.subtitle}
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, marginTop: 'auto', paddingBottom: 18 }}>
              {chips.map((c) => (
                <div key={c} style={{ display: 'flex', padding: '8px 16px', borderRadius: 10, backgroundColor: t.chip, border: `1px solid ${t.rowBorder}`, fontSize: 16, fontWeight: 800, letterSpacing: 3, color: t.text }}>
                  {c}
                </div>
              ))}
            </div>
          </div>

          {/* Matches */}
          <div style={{ height: posterContentHeight(input.format), display: 'flex', gap: columnGap }}>
            {page.columns.map((column, i) => (
              <div key={i} style={{ width: columnWidth, display: 'flex', flexDirection: 'column' }}>
                {column.map((block, j) => (
                  <Block key={j} block={block} input={input} t={t} narrow={narrow} display={display} condensed={condensed} columnWidth={columnWidth} />
                ))}
              </div>
            ))}
          </div>

          {/* Footer — the PICKBID mark */}
          <div style={{ height: footer, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${t.rowBorder}`, paddingBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 54, height: 54, borderRadius: 14, backgroundImage: 'linear-gradient(135deg, #16a34a 0%, #059669 55%, #0d9488 100%)' }}>
                <Gavel size={30} color="#ffffff" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, letterSpacing: 10, color: t.text, lineHeight: 1.1 }}>PICKBID</div>
                <div style={{ display: 'flex', fontSize: 16, fontWeight: 500, letterSpacing: 1, color: t.muted }}>{SITE_HOST}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              {pages.length > 1 && (
                <div style={{ display: 'flex', fontSize: 18, fontWeight: 800, letterSpacing: 4, color: t.accent }}>{`PAGE ${input.page} / ${pages.length}`}</div>
              )}
              <div style={{ display: 'flex', fontSize: 16, fontWeight: 500, color: t.muted }}>Fixtures made with Pickbid</div>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: w, height: h, fonts, headers: { 'Cache-Control': 'no-store' } },
  );
}
