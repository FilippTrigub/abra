import { Button } from "@/components/ui/button";

const triggers = [
  "A client call says something worth posting",
  "A voice note captures a useful idea",
  "A rough draft needs to become a post",
];

const steps = [
  {
    label: "01 ingest",
    title: "Drop in the raw material",
    body: "Use a call, note, article, or rough draft.",
  },
  {
    label: "02 extract",
    title: "Abra finds the signal",
    body: "It turns your real words into post drafts in your voice.",
  },
  {
    label: "03 review",
    title: "Review and schedule",
    body: "You review, edit, and schedule what works.",
  },
];

const differentiators = [
  {
    label: "01",
    title: "Not another scheduler",
    body: "Abra creates the content before it reaches the calendar.",
  },
  {
    label: "02",
    title: "Not a generic AI writer",
    body: "It starts from your source material, not an empty prompt box.",
  },
  {
    label: "03",
    title: "Human review stays in the loop",
    body: "Abra drafts and organizes. You approve what goes live.",
  },
];

export default function MarketingPage() {
  return (
    <div className="overflow-hidden bg-[#05070b] text-white">
      <section className="relative border-b border-white/10 px-4 py-20 sm:py-28 md:py-32">
        <div
          aria-hidden
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(circle at center, black 38%, transparent 85%)",
          }}
        />

        <div className="relative mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7CFFB2]">
              For independent experts
            </p>

            <h1 className="mt-6 max-w-4xl text-display font-display font-extrabold tracking-[-0.04em] text-white">
              Turn raw expertise into ready-to-post content.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300 sm:text-xl">
              Drop in a call, note, or recording. Abra turns it into post
              drafts ready to review.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                href="/sign-in"
                size="lg"
                className="rounded-md border border-white bg-white text-black shadow-none hover:bg-zinc-200"
              >
                Create my first content batch
              </Button>
              <a
                href="#how-it-works"
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/12 bg-white/5 px-5 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-200 transition-colors duration-150 hover:border-white/25 hover:bg-white/10 hover:text-white focus-ring-brand"
              >
                See how it works
              </a>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {[
                "Starts from real source material",
                "Review before anything publishes",
              ].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-300"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/30 sm:p-8">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7CFFB2] to-transparent opacity-70" />
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                  Capture to post
                </p>
                <p className="mt-2 text-h5 font-display font-bold text-white">
                  One useful moment becomes ready-to-review drafts.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {[
                ["Input", "Call, note, recording, or draft"],
                ["Output", "Post drafts in your voice"],
                ["Control", "Review before anything publishes"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                >
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    {label}
                  </span>
                  <span className="text-sm text-zinc-100">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 px-4 py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7CFFB2]">
              The problem
            </p>
            <h2 className="mt-4 max-w-xl text-h2 font-display font-bold tracking-[-0.03em] text-white">
              Your best content already happened on the call.
            </h2>
            <p className="mt-4 max-w-lg text-body leading-8 text-zinc-300">
              The bottleneck is not ideas. It is turning raw material into
              something ready to post.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
              <ul className="grid gap-4">
                {triggers.map((trigger) => (
                  <li key={trigger} className="flex gap-3 text-body text-zinc-300">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7CFFB2]" />
                    <span>{trigger}</span>
                  </li>
                ))}
              </ul>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-b border-white/10 px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7CFFB2]">
              How it works
            </p>
            <h2 className="mt-4 text-h2 font-display font-bold tracking-[-0.03em] text-white">
              Three steps. No blank page.
            </h2>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {steps.map((step) => (
              <div
                key={step.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#7CFFB2]">
                  {step.label}
                </p>
                <h3 className="mt-5 text-h5 font-display font-bold text-white">
                  {step.title}
                </h3>
                <p className="mt-3 text-body leading-relaxed text-zinc-300">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7CFFB2]">
              Why Abra
            </p>
            <h2 className="mt-4 text-h2 font-display font-bold tracking-[-0.03em] text-white">
              Clear input. Useful output. You stay in control.
            </h2>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {differentiators.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/10 bg-black/20 p-5"
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                  {item.label}
                </p>
                <h3 className="mt-4 text-h6 font-display font-bold text-white">
                  {item.title}
                </h3>
                <p className="mt-3 text-body leading-relaxed text-zinc-300">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-5xl rounded-[1.75rem] border border-white/10 bg-white/[0.04] px-6 py-12 sm:px-10 sm:py-16">
          <div className="max-w-3xl">
            <h2 className="mt-4 text-h2 font-display font-bold tracking-[-0.03em] text-white">
              Stop losing your best ideas after the call ends.
            </h2>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              href="/sign-in"
              size="lg"
              className="rounded-md border border-white bg-white text-black shadow-none hover:bg-zinc-200"
            >
              Create my first content batch
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
