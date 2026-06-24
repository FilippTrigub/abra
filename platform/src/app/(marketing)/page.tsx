import { Button } from "@/components/ui/button";
import Link from "next/link";

const triggers = [
  "A client call gives you a line worth posting",
  "A voice note catches a point worth sharing",
  "A workshop moment explains your point of view",
];

const proofPoints = [
  "Starts from real work",
  "Keeps review in your hands",
  "Protects your voice before volume",
];

const sourceMoments = [
  {
    role: "Consultant",
    source: "Client call",
    line: "The line your buyer repeated back to you.",
    tone: "bg-brand-500",
  },
  {
    role: "Founder",
    source: "Voice note",
    line: "A sharp take captured between meetings.",
    tone: "bg-secondary-500",
  },
  {
    role: "Coach",
    source: "Workshop",
    line: "A teaching moment worth turning into a post.",
    tone: "bg-accent-500",
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

        <div className="relative mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.03fr_0.97fr] lg:items-stretch">
          <div className="flex flex-col justify-center border border-shell-border-strong bg-shell-panel px-6 py-7 sm:px-8 sm:py-8 lg:min-h-[30rem] lg:px-10 lg:py-10">
            <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.22em] text-shell-signal sm:text-[13px]">
              For trust-selling experts
            </p>

            <h1 className="mt-5 max-w-4xl text-[3.5rem] leading-[0.96] font-display font-extrabold tracking-[-0.05em] text-white sm:text-[4.25rem] lg:text-[4.6rem]">
              Turn real conversations into posts that still sound like you.
            </h1>

            <p className="mt-6 max-w-xl text-[1.25rem] leading-[1.35] text-zinc-200 sm:text-[1.45rem] lg:text-[1.55rem]">
              Send Abra a call, voice note, or rough idea. It pulls out the useful line, drafts the post,
              and waits for your review.
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
                  className="flex min-h-[4.5rem] items-center border border-shell-border-strong bg-black/20 px-4 py-3 text-[0.95rem] leading-6 text-zinc-100 sm:text-base"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative flex flex-col justify-between overflow-hidden border border-shell-border-strong bg-[color-mix(in_srgb,var(--color-shell-panel)_82%,black)] p-6 sm:p-8 lg:min-h-[30rem] lg:p-10">
            <div
              aria-hidden
              className="absolute right-0 top-0 h-40 w-40 translate-x-1/3 -translate-y-1/3 rounded-full bg-brand-500/20 blur-3xl"
            />
            <div className="relative flex items-center justify-between border-b border-shell-border-strong pb-5">
              <div>
                <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-zinc-400 sm:text-[13px]">
                  Real source moments
                </p>
                <p className="mt-3 max-w-md text-[1.75rem] leading-[1.08] font-display font-bold tracking-[-0.04em] text-white sm:text-[2rem] lg:text-[2.25rem]">
                  Friendly capture. Serious review.
                </p>
              </div>
            </div>

            <div className="relative mt-6 grid gap-3">
              {sourceMoments.map((moment, index) => (
                <div
                  key={moment.role}
                  className="grid gap-4 border border-shell-border-strong bg-black/20 px-4 py-4 sm:grid-cols-[4rem_minmax(0,1fr)] sm:items-center sm:px-5 sm:py-5"
                >
                  <span
                    aria-hidden
                    className={`${moment.tone} relative flex size-14 items-center justify-center overflow-hidden rounded-full border border-white/25 shadow-[0_0_24px_rgb(255_255_255_/_0.08)]`}
                  >
                    <span className="absolute top-3 size-4 rounded-full bg-white/85" />
                    <span className="absolute bottom-1 h-6 w-9 rounded-t-full bg-white/70" />
                    <span className="relative mt-1 font-mono text-[11px] font-bold text-black/70">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </span>
                  <span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-shell-signal sm:text-[13px]">
                        {moment.role}
                      </span>
                      <span className="text-sm text-zinc-400">{moment.source}</span>
                    </span>
                    <span className="mt-2 block text-[1.05rem] leading-7 text-zinc-100 sm:text-[1.15rem] lg:text-[1.2rem]">
                      {moment.line}
                    </span>
                  </span>
                </div>
              ))}
            </div>

            <p className="relative mt-6 border-l border-shell-signal pl-4 text-[1.05rem] leading-7 text-zinc-200">
              Abra feels more like a calm operator sitting beside the expert than a machine publishing over
              their shoulder.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-shell-border-strong px-4 py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2 lg:items-stretch">
          <div className="flex flex-col justify-center border border-shell-border-strong bg-shell-panel px-6 py-8 sm:px-10 sm:py-10">
            <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.22em] text-shell-signal sm:text-[13px]">
              The pain
            </p>
            <h2 className="mt-5 max-w-xl text-[2.75rem] leading-[1.02] font-display font-bold tracking-[-0.04em] text-white sm:text-[3.4rem]">
              The idea is already there. The post is the extra job.
            </h2>
            <p className="mt-6 max-w-lg text-[1.35rem] leading-[1.4] text-zinc-200 sm:text-[1.55rem]">
              Abra lowers the activation energy: no blank prompt, no generic rewrite, no leap from
              private expertise to public post without a review step.
            </p>
          </div>

          <div className="border border-shell-border-strong bg-black/20 px-6 py-8 sm:px-10 sm:py-10">
            <ul className="grid gap-5">
              {triggers.map((trigger) => (
                <li key={trigger} className="grid gap-2 border-b border-shell-border-strong pb-5 last:border-b-0 last:pb-0">
                  <span className="font-mono text-[12px] uppercase tracking-[0.16em] text-zinc-400">
                    Trigger
                  </span>
                  <span className="text-[1.3rem] leading-[1.4] text-zinc-100 sm:text-[1.5rem]">
                    {trigger}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.22em] text-shell-signal sm:text-[13px]">
              How it works
            </p>
            <h2 className="mt-5 text-[2.75rem] leading-[1.02] font-display font-bold tracking-[-0.04em] text-white sm:text-[3.5rem]">
              Three steps. Still your judgment.
            </h2>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {steps.map((step) => (
              <div
                key={step.title}
                className="border border-shell-border-strong bg-shell-panel p-6 sm:p-8"
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
