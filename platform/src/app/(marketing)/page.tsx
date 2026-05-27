import { Button } from "@/components/ui/button";

const triggers = [
  "A client call lands a sharp point",
  "A voice note catches an idea",
  "A rough draft needs a finish",
];

const steps = [
  {
    label: "01 ingest",
    title: "Drop it in",
    body: "Call, note, recording, or draft.",
  },
  {
    label: "02 extract",
    title: "Abra drafts",
    body: "It turns your words into posts that sound like you.",
  },
  {
    label: "03 review",
    title: "You review",
    body: "Edit, approve, and schedule what stays.",
  },
];

export default function MarketingPage() {
  return (
    <div className="overflow-hidden bg-[#05070b] text-white">
      <section className="relative border-b border-white/10 px-4 py-24 sm:py-32 md:py-36">
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

        <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:items-stretch">
          <div className="flex flex-col justify-center border border-white/10 bg-white/[0.02] px-6 py-8 sm:px-10 sm:py-12 lg:min-h-[32rem]">
            <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.22em] text-[#7CFFB2] sm:text-[13px]">
              For independent experts
            </p>

            <h1 className="mt-6 max-w-4xl text-[4.25rem] leading-[0.96] font-display font-extrabold tracking-[-0.05em] text-white sm:text-[5rem]">
              Turn raw expertise into ready-to-post content.
            </h1>

            <p className="mt-8 max-w-xl text-[1.45rem] leading-[1.35] text-zinc-200 sm:text-[1.7rem]">
              Drop in a call, note, or recording. Get drafts back to review.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                href="/sign-in"
                size="lg"
                className="rounded-sm border border-white bg-white px-7 text-black shadow-none hover:bg-zinc-200"
              >
                Create my first content batch
              </Button>
              <a
                href="#how-it-works"
                className="inline-flex min-h-11 items-center justify-center rounded-sm border border-white/12 bg-transparent px-5 py-3 font-mono text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-100 transition-colors duration-150 hover:border-white/25 hover:bg-white/6 hover:text-white focus-ring-brand sm:text-[13px]"
              >
                See how it works
              </a>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-2">
              {[
                "Starts from real source material",
                "Review before anything publishes",
              ].map((item) => (
                <span
                  key={item}
                  className="border border-white/10 bg-white/[0.03] px-4 py-3 text-base leading-7 text-zinc-100"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative flex min-h-[32rem] flex-col justify-center border border-white/10 bg-white/[0.02] p-6 sm:p-10">
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <div>
                <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-zinc-400 sm:text-[13px]">
                  Capture to post
                </p>
                <p className="mt-4 max-w-md text-[2rem] leading-[1.08] font-display font-bold tracking-[-0.04em] text-white sm:text-[2.5rem]">
                  One useful moment becomes a small batch of drafts.
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-4">
              {[
                ["Input", "Call, note, recording, or draft"],
                ["Output", "Post drafts in your voice"],
                ["Control", "Review before anything publishes"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="grid gap-2 border border-white/10 bg-black/10 px-5 py-5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center"
                >
                  <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-zinc-400 sm:text-[13px]">
                    {label}
                  </span>
                  <span className="text-lg leading-8 text-zinc-100 sm:text-[1.25rem]">{value}</span>
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
              The problem
            </p>
            <h2 className="mt-5 max-w-xl text-[2.75rem] leading-[1.02] font-display font-bold tracking-[-0.04em] text-white sm:text-[3.4rem]">
              The useful part already happened.
            </h2>
            <p className="mt-6 max-w-lg text-[1.35rem] leading-[1.4] text-zinc-200 sm:text-[1.55rem]">
              The hard part is not thinking. It is turning real work into a post.
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
              Three steps. No blank page.
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
