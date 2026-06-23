// WhatsApp notifications via Infobip.
//
// Server-only: imported solely from route handlers. Reads credentials from the
// environment (WHATSAPPAPIKEY, WHATSAPPAPIURL, FROM_NUMBER) plus the template
// config (WHATSAPP_TEMPLATE_NAME, WHATSAPP_TEMPLATE_LANG). Every send is
// best-effort — failures are logged and swallowed so they can never break the
// flow that triggered them (e.g. recording an auction sale).
//
// We send a *template* message (/whatsapp/1/message/template), not free-form
// text: a "player sold" alert is always business-initiated, and WhatsApp only
// delivers business-initiated messages via a pre-approved template (free-form
// text is dropped outside the 24-hour customer-care window).
//
// The template must declare four body placeholders, in this order:
//   {{1}} player name   {{2}} team name   {{3}} team owner   {{4}} winning bid
// All visual styling (*bold*, emojis, line breaks, sign-off) lives in the
// approved template body — see notifyPlayerSold for the suggested wording.

import { v4 as uuidv4 } from 'uuid';

const DEFAULT_TEMPLATE = 'test_whatsapp_template_en';
const DEFAULT_LANGUAGE = 'en';

type SoldNotification = {
  playerName: string;
  contactNumber: string | null;
  teamName: string;
  ownerName?: string | null;
  ownerNumber?: string | null;
  soldPrice: number | null;
  leagueName?: string | null;
  soldDate?: string | null;
};

/** Indian-style short form for an amount in rupees, mirroring the auction UI. */
function formatPrice(n: number | null): string {
  if (n == null) return 'undisclosed';
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

/**
 * Send a WhatsApp template message through Infobip.
 * `placeholders` must match the registered template's body placeholders in count
 * and order, and each must be a non-empty single line (WhatsApp rejects empty
 * params and newlines/tabs inside them). Returns true only on a 2xx; never throws.
 */
export async function sendWhatsAppTemplate(to: string, placeholders: string[]): Promise<boolean> {
  const apiKey = process.env.WHATSAPPAPIKEY;
  const apiUrl = process.env.WHATSAPPAPIURL;
  const from = process.env.FROM_NUMBER;
  if (!apiKey || !apiUrl || !from) {
    console.warn('[whatsapp] missing WHATSAPPAPIKEY/WHATSAPPAPIURL/FROM_NUMBER — skipping send');
    return false;
  }

  // Infobip expects an MSISDN in international format with no '+' or separators.
  // We only strip formatting; numbers must already include a country code.
  const dest = to.replace(/\D/g, '');
  if (!dest) {
    console.warn('[whatsapp] recipient has no usable phone number — skipping send');
    return false;
  }

  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || DEFAULT_TEMPLATE;
  const language = process.env.WHATSAPP_TEMPLATE_LANG || DEFAULT_LANGUAGE;
  const base = apiUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  try {
    const res = await fetch(`https://${base}/whatsapp/1/message/template`, {
      method: 'POST',
      headers: {
        Authorization: `App ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            from,
            to: dest,
            messageId: uuidv4(),
            content: {
              templateName,
              templateData: { body: { placeholders } },
              language,
            },
          },
        ],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`[whatsapp] send failed (${res.status}): ${detail}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[whatsapp] send error:', err);
    return false;
  }
}

/**
 * Notify a player, on their own WhatsApp, that they've been sold — sending the
 * buying team, their team owner's contact and the winning bid as the template's
 * four body placeholders. No-ops (returns false) when the player has no contact
 * number on record.
 *
 * Suggested approved template body (UTILITY category, four placeholders):
 *
 *   🏏 *SOLD!*
 *
 *   Hi *{{1}}* 👋
 *   You've been picked up by *{{2}}* 🎉
 *
 *   👤 *Team Owner:* {{3}}
 *   💰 *Winning Bid:* {{4}}
 *
 *   _See you on the field!_
 */
export async function notifyPlayerSold(d: SoldNotification): Promise<boolean> {
  if (!d.contactNumber) return false;

  // All four placeholders must be non-empty single lines.
  const owner = d.ownerNumber
    ? d.ownerName
      ? `${d.ownerName} — ${d.ownerNumber}`
      : d.ownerNumber
    : 'to be shared';
const leaguePrefix = d.leagueName ? `${d.leagueName} ` : '';
const datePart = d.soldDate ? ` on ${d.soldDate}` : '';
const placeholderText = `${d.playerName} you were Sold To: ${d.teamName.toUpperCase()} contact: ${owner} Price: ${formatPrice(d.soldPrice)}${datePart}-${leaguePrefix}`
  .replace(/[\n\r\t]/g, " ")
  .replace(/\s{2,}/g, " ")
  .trim();
    const placeholders = [
   placeholderText
  ];

  return sendWhatsAppTemplate(d.contactNumber, placeholders);
}
