import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";

const proofPoints = [
  "Real work in",
  "Drafts back",
  "You approve",
];

const humanMoments = [
  {
    title: "Founder notes",
    caption: "A sharp take between meetings.",
    src: "/marketing/abra-founder-work-moment-1.png",
    alt: "A founder reviewing notes on a laptop in a dark workspace",
    className: "rotate-[-2deg]",
  },
  {
    title: "Expert review",
    caption: "The draft waits for judgment.",
    src: "/marketing/abra-woman-expert-review-1.png",
    alt: "A professional expert reviewing notes in a warm dark office",
    className: "rotate-[2deg] lg:mt-14",
  },
];

const steps = [
  {
    label: "01 ingest",
    title: "Drop it in",
    body: "Call, note, or draft.",
  },
  {
    label: "02 extract",
    title: "Abra drafts",
    body: "Drafts in your voice.",
  },
  {
    label: "03 review",
    title: "You review",
    body: "Keep, edit, schedule.",
  },
];

export default function MarketingPage() {
  return (
    <div className="overflow-hidden bg-shell-canvas text-shell-text-strong">
      <section className="relative flex min-h-[calc(100svh-4.5rem)] items-center border-b border-shell-border-strong px-4 py-8 sm:py-10 md:py-12">
        <div
          aria-hidden
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(circle at center, black 42%, transparent 86%)",
          }}
        />

        <div className="relative mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-stretch">
          <div className="marketing-reveal flex flex-col justify-center border border-shell-border-strong bg-shell-panel px-6 py-7 sm:px-8 sm:py-8 lg:min-h-[31rem] lg:px-10 lg:py-10">
            <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.22em] text-shell-signal sm:text-[13px]">
              For trust-selling experts
            </p>

            <h1 className="mt-5 max-w-4xl text-[3.5rem] leading-[0.96] font-display font-extrabold tracking-[-0.05em] text-white sm:text-[4.25rem] lg:text-[4.6rem]">
              Turn real conversations into posts that still sound like you.
            </h1>

            <p className="mt-6 max-w-xl text-[1.25rem] leading-[1.35] text-zinc-200 sm:text-[1.45rem] lg:text-[1.55rem]">
              Send a call, note, or rough idea. Abra turns it into a reviewable draft.
            </p>

            <div className="mt-8 grid gap-3 sm:max-w-[30rem] sm:grid-cols-2">
              <Button
                href="/sign-in"
                size="lg"
                className="w-full px-7 text-center"
              >
                Start with one note
              </Button>
              <a
                href="#how-it-works"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-sm border border-white/12 bg-transparent px-5 py-3 text-center font-mono text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-100 transition-colors duration-150 hover:border-white/25 hover:bg-white/6 hover:text-white focus-ring-brand sm:text-[13px]"
              >
                See the review flow
              </a>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {proofPoints.map((item) => (
                <span
                  key={item}
                  className="flex min-h-[4.25rem] items-center border border-shell-border-strong bg-black/20 px-4 py-3 text-[0.95rem] leading-6 text-zinc-100 sm:text-base"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="marketing-reveal marketing-reveal-delay-1 relative min-h-[31rem] overflow-hidden border border-shell-border-strong bg-[color-mix(in_srgb,var(--color-shell-panel)_82%,black)]">
            <div
              aria-hidden
              className="absolute right-0 top-0 z-10 h-40 w-40 translate-x-1/3 -translate-y-1/3 rounded-full bg-brand-500/25 blur-3xl"
            />
            <Image
              src="/marketing/abra-workshop-experts-upscaled-2x.png"
              alt="Experts reviewing workshop notes together in a dark professional room"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 52vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(5_7_11_/_0.08),rgb(5_7_11_/_0.18)_42%,rgb(5_7_11_/_0.62))]" />
            <div className="absolute inset-x-0 bottom-0 z-10 border-t border-white/15 bg-[linear-gradient(180deg,transparent,rgb(5_7_11_/_0.92))] p-5 sm:p-7">
              <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.2em] text-shell-signal">
                Human review stays visible
              </p>
              <p className="mt-3 max-w-md text-[1.55rem] leading-[1.08] font-display font-bold tracking-[-0.04em] text-white sm:text-[2rem]">
                Expertise first. Automation second.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-shell-border-strong px-4 py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.84fr_1.16fr] lg:items-stretch">
          <div className="marketing-reveal flex flex-col justify-center border border-shell-border-strong bg-shell-panel px-6 py-8 sm:px-10 sm:py-10">
            <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.22em] text-shell-signal sm:text-[13px]">
              The shift
            </p>
            <h2 className="mt-5 max-w-xl text-[2.75rem] leading-[1.02] font-display font-bold tracking-[-0.04em] text-white sm:text-[3.4rem]">
              The idea is already there.
            </h2>
            <p className="mt-5 max-w-md text-[1.2rem] leading-[1.4] text-zinc-200 sm:text-[1.35rem]">
              Calls, notes, and workshops become drafts. Nothing publishes until you say so.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {humanMoments.map((moment, index) => (
              <figure
                key={moment.title}
                className={`marketing-reveal ${index === 1 ? "marketing-reveal-delay-2" : "marketing-reveal-delay-1"} ${moment.className} group relative min-h-[26rem] overflow-hidden border border-shell-border-strong bg-black/20 shadow-[0_24px_80px_rgb(0_0_0_/_0.24)] transition duration-500 hover:-translate-y-1 hover:border-white/20`}
              >
                <Image
                  src={moment.src}
                  alt={moment.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 32vw"
                  className="object-cover transition duration-700 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,rgb(5_7_11_/_0.88))]" />
                <figcaption className="absolute inset-x-0 bottom-0 p-5">
                  <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-shell-signal">
                    {moment.title}
                  </p>
                  <p className="mt-2 text-[1.25rem] leading-tight font-display font-bold tracking-[-0.03em] text-white">
                    {moment.caption}
                  </p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="marketing-reveal mx-auto max-w-3xl text-center">
            <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.22em] text-shell-signal sm:text-[13px]">
              How it works
            </p>
            <h2 className="mt-5 text-[2.75rem] leading-[1.02] font-display font-bold tracking-[-0.04em] text-white sm:text-[3.5rem]">
              Three steps. Still your judgment.
            </h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {steps.map((step) => (
              <div
                key={step.title}
                className="marketing-reveal border border-shell-border-strong bg-shell-panel p-6 sm:p-8"
              >
                <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-shell-signal sm:text-[13px]">
                  {step.label}
                </p>
                <h3 className="mt-6 text-[1.75rem] leading-[1.08] font-display font-bold tracking-[-0.03em] text-white sm:text-[2rem]">
                  {step.title}
                </h3>
                <p className="mt-5 text-[1.15rem] leading-8 text-zinc-200 sm:text-[1.25rem]">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-shell-border-strong px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Trigub Technologies OÜ · Abra</p>
          <nav aria-label="Legal links" className="flex flex-wrap gap-4">
            <Link className="hover:text-white" href="/privacy">
              Privacy note
            </Link>
            <Link className="hover:text-white" href="/legal">
              Legal statement
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
