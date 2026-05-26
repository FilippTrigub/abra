import { Button } from "@/components/ui/button";

const triggers = [
  "A client call had a strong answer",
  "A voice note captured a fresh idea",
  "A rough draft needs to become a post",
];

const steps = [
  {
    title: "Drop in the raw material",
    body: "Use a call recording, voice note, article, transcript, or rough idea.",
  },
  {
    title: "Abra finds the useful parts",
    body: "It turns your actual words and ideas into post drafts in your voice.",
  },
  {
    title: "Review and schedule",
    body: "Edit what you want, keep what works, and schedule the finished posts.",
  },
];

export default function MarketingPage() {
  return (
    <div className="overflow-hidden bg-surface-default">
      <section className="px-4 py-20 sm:py-28 md:py-32">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-caption font-semibold uppercase tracking-[0.24em] text-brand-600">
              For independent experts
            </p>

            <h1 className="mt-5 max-w-4xl text-display font-display font-extrabold tracking-tight text-strong">
              Turn raw expertise into ready-to-post content.
            </h1>

            <p className="mt-6 max-w-2xl text-xl leading-relaxed text-muted">
              Finish a useful call, voice note, article, or recording. Abra
              finds the good parts and turns them into posts you can review,
              edit, and schedule.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button href="/sign-in" size="lg">
                Create my first content batch
              </Button>
              <a
                href="#how-it-works"
                className="inline-flex min-h-11 items-center justify-center rounded-2xl px-5 py-3 text-caption font-semibold text-muted transition-colors duration-150 hover:text-strong focus-ring-brand"
              >
                See how it works
              </a>
            </div>

            <p className="mt-6 max-w-xl text-body text-muted">
              You already said the useful thing. Abra turns it into the post.
            </p>
          </div>

          <div className="rounded-[2rem] border border-border-subtle bg-surface-100 p-6 shadow-panel sm:p-8">
            <p className="text-caption font-semibold uppercase tracking-[0.18em] text-content-500">
              Use Abra when
            </p>
            <ul className="mt-5 space-y-4">
              {triggers.map((trigger) => (
                <li key={trigger} className="flex gap-3 text-body text-strong">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                  <span>{trigger}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 rounded-3xl bg-surface-default p-5">
              <p className="text-caption font-medium text-muted">Before</p>
              <p className="mt-1 text-body text-strong">
                “That was useful. I should turn it into content later.”
              </p>
              <div className="my-4 h-px bg-border-subtle" />
              <p className="text-caption font-medium text-muted">After</p>
              <p className="mt-1 text-body text-strong">
                “Drop it into Abra. Review the posts. Schedule the good ones.”
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-y border-border-subtle px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-caption font-semibold uppercase tracking-[0.24em] text-brand-600">
              How it works
            </p>
            <h2 className="mt-4 text-h2 font-display font-bold tracking-tight text-strong">
              Three steps. No blank page.
            </h2>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="rounded-[1.5rem] border border-border-subtle bg-surface-100 p-6"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-caption font-bold text-white">
                  {index + 1}
                </div>
                <h3 className="mt-5 text-h5 font-semibold text-strong">
                  {step.title}
                </h3>
                <p className="mt-3 text-body leading-relaxed text-muted">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-caption font-semibold uppercase tracking-[0.24em] text-brand-600">
              Why it works
            </p>
            <h2 className="mt-4 text-h2 font-display font-bold tracking-tight text-strong">
              It starts from what you actually said.
            </h2>
          </div>

          <div className="space-y-5 text-body leading-relaxed text-muted">
            <p>
              Generic AI starts from a prompt. Abra starts from your real calls,
              notes, recordings, and drafts, so the output has your context.
            </p>
            <p>
              Nothing has to publish automatically. Abra prepares the drafts and
              assets; you keep control before anything goes live.
            </p>
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:pb-28">
        <div className="mx-auto max-w-4xl rounded-[2rem] bg-strong px-6 py-12 text-center text-white sm:px-10 sm:py-16">
          <h2 className="text-h2 font-display font-bold tracking-tight">
            Stop losing your best ideas after the call ends.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-body leading-relaxed text-white/75">
            Turn the next useful conversation into posts you can review, edit,
            and schedule.
          </p>
          <div className="mt-8">
            <Button href="/sign-in" size="lg" variant="secondary">
              Create my first content batch
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
