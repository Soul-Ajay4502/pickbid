import { Instrument_Serif } from 'next/font/google';

/**
 * The landing's display face. Loaded here rather than in the root layout so
 * the app screens, which never use it, don't preload it. Exposed as
 * `--font-display` on `.landing-scope`; `.lp-display` in globals.css reads it.
 */
export const displaySerif = Instrument_Serif({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});
