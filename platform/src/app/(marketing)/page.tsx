import { Button } from "@/components/ui/button";

const triggers = [
  "A client call gives you a line worth posting",
  "A voice note catches a point worth sharing",
  "A rough draft sits unfinished",
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
    <div className="overflow-hidden bg-[#05070b] text-white">
      <section className="relative flex min-h-[calc(100svh-4.5rem)] items-center border-b border-white/10 px-4 py-8 sm:py-10 md:py-12">
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

        <div className="relative mx-auto grid max-w-6xl gap-6 lg:grid-cols-2 lg:items-stretch">
          <div className="flex flex-col justify-center border border-white/10 bg-white/[0.02] px-6 py-7 sm:px-8 sm:py-8 lg:min-h-[26rem] lg:px-10 lg:py-10">
            <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.22em] text-[#7CFFB2] sm:text-[13px]">
              For busy experts
            </p>

            <h1 className="mt-5 max-w-4xl text-[3.5rem] leading-[0.96] font-display font-extrabold tracking-[-0.05em] text-white sm:text-[4.25rem] lg:text-[4.6rem]">
              Stay visible without finding time to post.
            </h1>

            <p className="mt-6 max-w-xl text-[1.25rem] leading-[1.35] text-zinc-200 sm:text-[1.45rem] lg:text-[1.55rem]">
              Drop in a call or note. Abra drafts the post.
            </p>

            <div className="mt-8 grid gap-3 sm:max-w-[30rem] sm:grid-cols-2">
              <Button
                href="/sign-in"
                size="lg"
                className="w-full rounded-sm border border-white bg-white px-7 text-center text-black shadow-none hover:bg-zinc-200"
              >
                Create my draft
              </Button>
              <a
                href="#how-it-works"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-sm border border-white/12 bg-transparent px-5 py-3 text-center font-mono text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-100 transition-colors duration-150 hover:border-white/25 hover:bg-white/6 hover:text-white focus-ring-brand sm:text-[13px]"
              >
                See the flow
              </a>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {[
                "Built from real work",
                "You review first",
              ].map((item) => (
                <span
                  key={item}
                  className="flex min-h-[4rem] items-center border border-white/10 bg-white/[0.03] px-4 py-3 text-[0.95rem] leading-6 text-zinc-100 sm:text-base"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative flex flex-col justify-center border border-white/10 bg-white/[0.02] p-6 sm:p-8 lg:min-h-[26rem] lg:p-10">
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <div>
                <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-zinc-400 sm:text-[13px]">
                  From work to post
                </p>
                <p className="mt-3 max-w-md text-[1.75rem] leading-[1.08] font-display font-bold tracking-[-0.04em] text-white sm:text-[2rem] lg:text-[2.25rem]">
                  Work in. Drafts out.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              {[
                ["Input", "Call, note, or recording"],
                ["Output", "A small batch of drafts"],
                ["Control", "You review before it goes live"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="grid gap-2 border border-white/10 bg-black/10 px-4 py-4 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:items-center sm:px-5 sm:py-5"
                >
                  <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-zinc-400 sm:text-[13px]">
                    {label}
                  </span>
                  <span className="text-[1.05rem] leading-7 text-zinc-100 sm:text-[1.15rem] lg:text-[1.2rem]">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 px-4 py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2 lg:items-stretch">
          <div className="flex flex-col justify-center border border-white/10 bg-white/[0.02] px-6 py-8 sm:px-10 sm:py-10">
            <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.22em] text-[#7CFFB2] sm:text-[13px]">
              The pain
            </p>
            <h2 className="mt-5 max-w-xl text-[2.75rem] leading-[1.02] font-display font-bold tracking-[-0.04em] text-white sm:text-[3.4rem]">
              You know you should post. You do not have time.
            </h2>
            <p className="mt-6 max-w-lg text-[1.35rem] leading-[1.4] text-zinc-200 sm:text-[1.55rem]">
              The idea happens in the work. Posting still feels like another job.
            </p>
          </div>

          <div className="border border-white/10 bg-black/10 px-6 py-8 sm:px-10 sm:py-10">
            <ul className="grid gap-5">
              {triggers.map((trigger) => (
                <li key={trigger} className="grid gap-2 border-b border-white/10 pb-5 last:border-b-0 last:pb-0">
                  <span className="font-mono text-[12px] uppercase tracking-[0.16em] text-zinc-500">
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
            <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.22em] text-[#7CFFB2] sm:text-[13px]">
              How it works
            </p>
            <h2 className="mt-5 text-[2.75rem] leading-[1.02] font-display font-bold tracking-[-0.04em] text-white sm:text-[3.5rem]">
              Three steps. Still your voice.
            </h2>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {steps.map((step) => (
              <div
                key={step.title}
                className="border border-white/10 bg-white/[0.02] p-6 sm:p-8"
              >
                <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-[#7CFFB2] sm:text-[13px]">
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
    </div>
  );
}
