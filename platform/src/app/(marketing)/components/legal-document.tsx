import type { ReactNode } from "react";
import Link from "next/link";

interface LegalLink {
  href: string;
  label: string;
}

interface LegalSection {
  title: string;
  body: ReactNode;
}

interface LegalDocumentProps {
  title: string;
  description: string;
  lastUpdated: string;
  sections: LegalSection[];
  relatedLinks?: LegalLink[];
}

export function LegalDocument({
  title,
  description,
  lastUpdated,
  sections,
  relatedLinks = [],
}: LegalDocumentProps) {
  return (
    <div className="bg-[#05070b] text-white">
      <article className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="border border-white/10 bg-white/[0.02] px-6 py-8 sm:px-8 sm:py-10">
          <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.22em] text-[#7CFFB2] sm:text-[13px]">
            {lastUpdated}
          </p>
          <h1 className="mt-5 text-[3rem] leading-[0.98] font-display font-extrabold tracking-[-0.05em] text-white sm:text-[4rem]">
            {title}
          </h1>
          <p className="mt-6 max-w-3xl text-[1.2rem] leading-8 text-zinc-200 sm:text-[1.35rem]">
            {description}
          </p>
        </div>

        <div className="mt-6 grid gap-4">
          {sections.map((section) => (
            <section
              key={section.title}
              className="border border-white/10 bg-black/10 px-6 py-7 sm:px-8 sm:py-8"
            >
              <h2 className="text-[1.55rem] leading-tight font-display font-bold tracking-[-0.03em] text-white sm:text-[1.9rem]">
                {section.title}
              </h2>
              <div className="mt-5 space-y-4 text-[1rem] leading-7 text-zinc-200 [&_a]:text-[#7CFFB2] [&_a]:underline [&_a]:decoration-[#7CFFB2]/35 [&_a]:underline-offset-4 [&_code]:rounded-sm [&_code]:border [&_code]:border-white/10 [&_code]:bg-white/5 [&_code]:px-1.5 [&_code]:py-0.5 [&_strong]:text-white [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
                {section.body}
              </div>
            </section>
          ))}
        </div>

        {relatedLinks.length > 0 ? (
          <nav
            aria-label="Related legal pages"
            className="mt-6 flex flex-wrap gap-3 border border-white/10 bg-white/[0.02] px-6 py-5 sm:px-8"
          >
            {relatedLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-mono text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-200 underline decoration-white/20 underline-offset-4 transition-colors duration-150 hover:text-white hover:decoration-white/50"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </article>
    </div>
  );
}
