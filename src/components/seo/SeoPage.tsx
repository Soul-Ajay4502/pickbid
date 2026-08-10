/**
 * Shared shell for the keyword landing pages and resource articles.
 *
 * Only the *layout* is shared — every page supplies its own headings, prose and
 * FAQs. That split is deliberate: it keeps the markup, breadcrumbs and schema
 * consistent without letting the pages become near-duplicates of each other,
 * which is what gets a set of landing pages treated as doorway pages.
 *
 * The FAQ block renders every question and answer visibly and derives the
 * `FAQPage` schema from that same array, so the markup can never describe
 * content a visitor cannot see.
 */
import Link from 'next/link';
import { buildPageMetadata } from '@/lib/seo';
import {
  JsonLd,
  webPageSchema,
  breadcrumbSchema,
  faqSchema,
} from '@/lib/jsonLd';

export type SeoSection = {
  heading: string;
  /** One string per paragraph. */
  body: string[];
  /** Optional definition list rendered under the paragraphs. */
  points?: { term: string; description: string }[];
};

export type SeoFaq = { question: string; answer: string };

export type SeoLink = { href: string; label: string; description?: string };

export type SeoPageContent = {
  /** Canonical root-relative path, no trailing slash. */
  path: string;
  /** <title> (the shell appends the brand suffix). */
  title: string;
  metaDescription: string;
  /** Short label for the breadcrumb trail. */
  breadcrumb: string;
  /** The single H1. */
  h1: string;
  /** Small eyebrow line above the H1. */
  kicker: string;
  /** Lead paragraphs under the H1. */
  intro: string[];
  sections: SeoSection[];
  faqs: SeoFaq[];
  /** Descriptive internal links — never "click here". */
  related: SeoLink[];
  cta: { heading: string; body: string; href: string; label: string };
};

/** Metadata for a landing page, derived from the same content object. */
export function seoPageMetadata(content: SeoPageContent) {
  return buildPageMetadata({
    title: content.title,
    description: content.metaDescription,
    path: content.path,
  });
}

export default function SeoPage({ content }: { content: SeoPageContent }) {
  const {
    path,
    title,
    metaDescription,
    breadcrumb,
    h1,
    kicker,
    intro,
    sections,
    faqs,
    related,
    cta,
  } = content;

  const schemas = [
    webPageSchema({ path, name: title, description: metaDescription }),
    breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: breadcrumb, path },
    ]),
    // Only emitted when the page actually renders an FAQ section below.
    ...(faqs.length ? [faqSchema(faqs)] : []),
  ];

  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 py-12 animate-fade-in-up">
      <JsonLd data={schemas} />

      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex items-center gap-2 text-xs text-muted-foreground">
          <li>
            <Link href="/" className="hover:text-foreground transition-colors duration-200">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-foreground/80">{breadcrumb}</li>
        </ol>
      </nav>

      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-3">
          {kicker}
        </p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gradient-green mb-5">
          {h1}
        </h1>
        <div className="space-y-4">
          {intro.map((paragraph) => (
            <p key={paragraph} className="text-sm text-muted-foreground leading-relaxed">
              {paragraph}
            </p>
          ))}
        </div>
      </header>

      <div className="mt-12 space-y-12">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-lg font-bold text-foreground mb-3">{section.heading}</h2>
            <div className="space-y-3">
              {section.body.map((paragraph) => (
                <p key={paragraph} className="text-sm text-muted-foreground leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
            {section.points?.length ? (
              <dl className="mt-5 space-y-4 border-l border-border/60 pl-5">
                {section.points.map((point) => (
                  <div key={point.term}>
                    <dt className="text-sm font-semibold text-foreground">{point.term}</dt>
                    <dd className="mt-1 text-sm text-muted-foreground leading-relaxed">
                      {point.description}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </section>
        ))}
      </div>

      {faqs.length ? (
        <section className="mt-14 pt-10 border-t border-border/50">
          <h2 className="text-lg font-bold text-foreground mb-6">
            Frequently asked questions
          </h2>
          <dl className="space-y-6">
            {faqs.map((faq) => (
              <div key={faq.question}>
                <dt className="text-sm font-semibold text-foreground">{faq.question}</dt>
                <dd className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                  {faq.answer}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section className="mt-14 pt-10 border-t border-border/50">
        <h2 className="text-lg font-bold text-foreground mb-2">{cta.heading}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-5">{cta.body}</p>
        <Link
          href={cta.href}
          className="btn-premium inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
        >
          {cta.label}
        </Link>
      </section>

      {related.length ? (
        <section className="mt-14 pt-10 border-t border-border/50">
          <h2 className="text-lg font-bold text-foreground mb-5">Keep reading</h2>
          <ul className="space-y-4">
            {related.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm font-semibold text-primary hover:underline underline-offset-2"
                >
                  {link.label}
                </Link>
                {link.description ? (
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {link.description}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
