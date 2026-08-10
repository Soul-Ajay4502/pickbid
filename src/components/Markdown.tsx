'use client';

import type { CSSProperties } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Renders organizer-authored markdown (currently the league ledger).
//
// Safety: react-markdown builds React elements rather than injecting HTML, and
// with no `rehype-raw` in the chain any raw <script>/<iframe>/onerror= in the
// source comes out as literal escaped text. Its default URL transform also drops
// `javascript:` hrefs. Do not add rehype-raw here — this content comes from
// users, and members are the ones who'd get hit.
//
// remark-gfm is what makes pipe tables work, which is how a ledger is actually
// written. Typography lives in `.md-body` in globals.css; the overrides below
// handle what a stylesheet alone can't.

/**
 * GFM column alignment arrives as an inline `text-align` style, not an `align`
 * attribute — and React serializes that style differently on the server
 * (`text-align:right`) than after hydration (`text-align: right`), so a
 * `[style*=…]` selector can't be trusted. Mirroring it onto a class gives the
 * stylesheet something stable to hook: a right-aligned ledger column is
 * essentially always money, and money wants tabular figures.
 */
function alignClass(style?: CSSProperties): string | undefined {
  if (style?.textAlign === 'right')  return 'md-align-right';
  if (style?.textAlign === 'center') return 'md-align-center';
  return undefined;
}

const components: Components = {
  // A ledger table can be wider than a phone. Without this wrapper the whole
  // page scrolls sideways; with it, only the table does.
  table: ({ children }) => (
    <div className="md-table-wrap">
      <table>{children}</table>
    </div>
  ),
  // Alignment is the only prop GFM ever puts on a cell, so taking just `style`
  // (rather than spreading the rest) keeps react-markdown's `node` prop off the
  // DOM element without a throwaway binding.
  th: ({ children, style }) => <th style={style} className={alignClass(style)}>{children}</th>,
  td: ({ children, style }) => <td style={style} className={alignClass(style)}>{children}</td>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow">
      {children}
    </a>
  ),
};

export default function Markdown({ content, className = '' }: { content: string; className?: string }) {
  return (
    <div className={`md-body ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
