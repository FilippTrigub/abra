import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";

const repoUrl = "https://github.com/FilippTrigub/abra";

const workflowStages = [
  {
    label: "Capture",
    title: "Add real work",
    body: "Calls, notes, or workshops go in.",
  },
  {
    label: "Draft",
    title: "Get drafts",
    body: "Abra turns the source into reviewable posts.",
  },
  {
    label: "Approve",
    title: "Make the call",
    body: "The expert approves before anything goes out.",
  },
];

const runModes = [
  {
    id: "self-host",
    label: "Self-host",
    title: "Run Abra yourself",
    body: "Inspect the source, run it on your stack, and keep control of providers and storage.",
    cta: "View the repo",
    href: repoUrl,
  },
  {
    id: "managed",
    label: "Managed",
    title: "Use managed hosting",
    body: "Use the hosted path when you want Abra operated for you.",
    cta: "Try managed hosting",
    href: "/sign-in",
  },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.22em] text-shell-signal sm:text-[13px]">
      {children}
    </p>
  );
}

export default function MarketingPage() {
  return (
    <div className="overflow-hidden bg-shell-canvas text-shell-text-strong">
      <section className="relative flex min-h-[calc(100dvh-4.5rem)] items-center border-b border-shell-border-strong px-4 py-8 sm:py-10 md:py-12">
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

        <div className="relative mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-stretch">
          <div className="marketing-reveal flex flex-col justify-center border border-shell-border-strong bg-shell-panel px-6 py-7 sm:px-8 sm:py-8 lg:min-h-[33rem] lg:px-10 lg:py-10">
            <SectionLabel>Self-hostable studio</SectionLabel>

            <h1 className="mt-5 max-w-4xl text-[3.1rem] leading-[0.98] font-display font-extrabold tracking-[-0.05em] text-white sm:text-[4rem] lg:text-[4.35rem]">
              Turn conversations into posts.
            </h1>

            <p className="mt-6 max-w-xl text-[1.2rem] leading-[1.38] text-zinc-200 sm:text-[1.35rem] lg:text-[1.45rem]">
              Calls, notes, and workshops become reviewable drafts. The expert approves. Self-host or use managed hosting.
            </p>

            <div className="mt-8 grid gap-3 sm:max-w-[34rem] sm:grid-cols-2">
              <Button
                href={repoUrl}
                size="lg"
                className="w-full px-7 text-center"
              >
                View the repo
              </Button>
              <Button
                href="/sign-in"
                size="lg"
                variant="ghost"
                className="w-full px-7 text-center"
              >
                Try managed hosting
              </Button>
            </div>
          </div>

          <div className="marketing-reveal marketing-reveal-delay-1 relative min-h-[33rem] overflow-hidden border border-shell-border-strong bg-[color-mix(in_srgb,var(--color-shell-panel)_82%,black)]">
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
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(5_7_11_/_0.08),rgb(5_7_11_/_0.2)_42%,rgb(5_7_11_/_0.7))]" />
            <div className="absolute inset-x-0 bottom-0 z-10 border-t border-white/15 bg-[linear-gradient(180deg,transparent,rgb(5_7_11_/_0.94))] p-5 sm:p-7">
              <SectionLabel>Human approval</SectionLabel>
              <p className="mt-3 max-w-md text-[1.55rem] leading-[1.08] font-display font-bold tracking-[-0.04em] text-white sm:text-[2rem]">
                Abra drafts. You decide.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="border-b border-shell-border-strong px-4 py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.82fr_1.18fr] lg:items-stretch">
          <div className="marketing-reveal flex flex-col justify-center border border-shell-border-strong bg-shell-panel px-6 py-8 sm:px-10 sm:py-10">
            <SectionLabel>What it does</SectionLabel>
            <h2 className="mt-5 max-w-xl text-[2.65rem] leading-[1.02] font-display font-bold tracking-[-0.04em] text-white sm:text-[3.35rem]">
              Three steps. No content factory.
            </h2>
            <p className="mt-5 max-w-md text-[1.16rem] leading-[1.45] text-zinc-200 sm:text-[1.3rem]">
              Abra keeps the expert in the loop from source to approval.
            </p>
          </div>

          <div className="marketing-reveal marketing-reveal-delay-1 overflow-hidden border border-shell-border-strong bg-black/20">
            <div className="relative min-h-[30rem]">
              <Image
                src="/marketing/abra-founder-work-moment-1.png"
                alt="A founder reviewing notes before turning them into drafts"
                fill
                sizes="(max-width: 1024px) 100vw, 60vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(5_7_11_/_0.05),rgb(5_7_11_/_0.82))]" />
              <div className="absolute inset-x-0 bottom-0 border-t border-white/15 p-5 sm:p-7">
                <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.16em] text-shell-signal sm:text-[13px]">
                  Capture / Draft / Approve
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {workflowStages.map((stage) => (
                    <div
                      key={stage.title}
                      className="border border-white/12 bg-black/30 px-3 py-3"
                    >
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-shell-signal">
                        {stage.label}
                      </p>
                      <p className="mt-2 text-[0.95rem] leading-6 text-zinc-100">
                        {stage.title}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="run-mode" className="border-b border-shell-border-strong px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="marketing-reveal max-w-3xl">
            <SectionLabel>Run mode</SectionLabel>
            <h2 className="mt-5 text-[2.65rem] leading-[1.02] font-display font-bold tracking-[-0.04em] text-white sm:text-[3.45rem]">
              One choice: control or convenience.
            </h2>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            {runModes.map((mode, index) => (
              <article
                key={mode.id}
                className={`marketing-reveal ${index === 1 ? "marketing-reveal-delay-1" : ""} border border-shell-border-strong bg-shell-panel p-6 sm:p-8`}
              >
                <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-shell-signal sm:text-[13px]">
                  {mode.label}
                </p>
                <h3 className="mt-6 max-w-lg text-[2rem] leading-[1.05] font-display font-bold tracking-[-0.04em] text-white sm:text-[2.55rem]">
                  {mode.title}
                </h3>
                <p className="mt-5 max-w-xl text-[1.08rem] leading-8 text-zinc-200">
                  {mode.body}
                </p>
                <Link
                  href={mode.href}
                  className="mt-8 inline-flex min-h-11 items-center justify-center rounded-sm border border-white/12 bg-white/[0.04] px-5 py-3 font-mono text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-100 transition-colors duration-150 hover:border-white/25 hover:bg-white/[0.08] hover:text-white focus-ring-brand sm:text-[13px]"
                >
                  {mode.cta}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:py-20">
        <div className="marketing-reveal mx-auto grid max-w-6xl overflow-hidden border border-shell-border-strong bg-[color-mix(in_srgb,var(--color-shell-panel)_82%,black)] lg:grid-cols-2">
          <div className="relative min-h-[22rem] bg-black/20">
            <Image
              src="/marketing/abra-woman-expert-review-1.png"
              alt="An expert reviewing content before starting from existing work"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover object-top"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(5_7_11_/_0.02),rgb(5_7_11_/_0.58))]" />
          </div>
          <div className="flex flex-col justify-center px-6 py-8 sm:px-10 sm:py-10">
            <SectionLabel>Start</SectionLabel>
            <h2 className="mt-5 max-w-3xl text-[2.65rem] leading-[1.02] font-display font-bold tracking-[-0.04em] text-white sm:text-[3.45rem]">
              Start with work you already have.
            </h2>
            <div className="mt-8 grid gap-3 sm:max-w-[22rem]">
              <Button href={repoUrl} size="lg" className="w-full px-7 text-center">
                View the repo
              </Button>
              <Button
                href="/sign-in"
                size="lg"
                variant="ghost"
                className="w-full px-7 text-center"
              >
                Try managed hosting
              </Button>
            </div>
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
