/**
 * Structured data (JSON-LD) — one safe serializer and a set of schema builders,
 * so no page hand-writes a <script type="application/ld+json"> block.
 *
 * Why this file exists: `JSON.stringify` does not escape `<`, so a value that
 * contains `</script>` closes the tag early and everything after it is parsed
 * as HTML. League names, organizer names and team names are all user-supplied,
 * which makes every league page a potential injection point. `<JsonLd>` escapes
 * the three characters that matter before the payload reaches the DOM.
 *
 * Only schemas that describe content actually rendered on the page belong here.
 * There are deliberately no rating/review builders: Pickbid collects neither,
 * and marking up ratings it doesn't have would be exactly the kind of false
 * structured data that earns a manual action.
 */
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION } from './seo';

/**
 * Escapes the characters that can break out of a <script> element. `<` covers
 * `</script>` and `<!--`; the two line separators are valid JSON but invalid
 * JavaScript string literals, which trips some older parsers.
 */
function safeSerialize(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Renders one JSON-LD block. Pass a single schema object or an array — an array
 * is emitted as a `@graph`, which is how you attach several linked entities to
 * one page without repeating the `@context`.
 */
export function JsonLd({ data }: { data: object | object[] }) {
  const payload = Array.isArray(data)
    ? { '@context': 'https://schema.org', '@graph': data }
    : data;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeSerialize(payload) }}
    />
  );
}

// ── Site-level entities ───────────────────────────────────────────────────────
// Stable @ids so entities on other pages can reference these by URL rather than
// redeclaring them (`publisher: { '@id': ORGANIZATION_ID }`).

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

export function organizationSchema() {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon` },
  };
}

export function websiteSchema() {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: SITE_URL,
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    publisher: { '@id': ORGANIZATION_ID },
    inLanguage: 'en',
  };
}

export function softwareApplicationSchema(featureList: string[]) {
  return {
    '@type': 'SoftwareApplication',
    '@id': `${SITE_URL}/#app`,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    applicationCategory: 'SportsApplication',
    operatingSystem: 'Web',
    browserRequirements: 'Requires JavaScript. Works in any modern browser.',
    // Genuinely free — there is no paid tier to misrepresent here.
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList,
  };
}

// ── Page-level entities ───────────────────────────────────────────────────────

/** A content page: the marketing/landing/resource pages. */
export function webPageSchema({
  path,
  name,
  description,
}: {
  path: string;
  name: string;
  description: string;
}) {
  const url = `${SITE_URL}${path}`;
  return {
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name,
    description,
    isPartOf: { '@id': WEBSITE_ID },
    publisher: { '@id': ORGANIZATION_ID },
    inLanguage: 'en',
  };
}

/**
 * Breadcrumb trail. `items` are ordered root-first; each `path` is
 * root-relative and is turned into the absolute URL Google expects.
 */
export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

/**
 * FAQ markup. Only call this with the *same* questions and answers the page
 * renders visibly — FAQ structured data that isn't on the page is a policy
 * violation, and the `<FaqSection>` component pairs the two for that reason.
 */
export function faqSchema(faqs: { question: string; answer: string }[]) {
  return {
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
}

/** An ordered list of links, e.g. the public league directory. */
export function itemListSchema({
  name,
  items,
}: {
  name: string;
  items: { name: string; path: string }[];
}) {
  return {
    '@type': 'ItemList',
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      url: `${SITE_URL}${item.path}`,
    })),
  };
}

/**
 * A cricket league as a SportsEvent. Only used for leagues the organizer marked
 * public, and only with fields backed by real rows: the league name, who runs
 * it, when it was created and the teams that exist. No dates are invented — a
 * league without fixtures gets no `endDate`, and `eventStatus` is omitted
 * rather than guessed.
 */
export function sportsEventSchema({
  name,
  description,
  path,
  startDate,
  endDate,
  logoUrl,
  organizerName,
  teamNames,
}: {
  name: string;
  description: string;
  path: string;
  startDate: string;
  endDate?: string | null;
  logoUrl?: string | null;
  organizerName?: string | null;
  teamNames: string[];
}) {
  const url = `${SITE_URL}${path}`;
  return {
    '@type': 'SportsEvent',
    '@id': `${url}#event`,
    name,
    description,
    url,
    sport: 'Cricket',
    startDate,
    ...(endDate ? { endDate } : {}),
    ...(logoUrl ? { image: logoUrl } : {}),
    ...(organizerName
      ? { organizer: { '@type': 'Organization', name: organizerName } }
      : {}),
    ...(teamNames.length
      ? {
          competitor: teamNames.map((teamName) => ({
            '@type': 'SportsTeam',
            name: teamName,
            sport: 'Cricket',
          })),
        }
      : {}),
    isAccessibleForFree: true,
    inLanguage: 'en',
  };
}
