import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Surface } from "@/components/ui/surface";
import { Link as UILink } from "@/components/ui/link";

export default function MarketingPage() {
  return (
    <div className="overflow-hidden">
      <section className="relative px-4 pt-24 pb-16 sm:pt-32 sm:pb-24 md:pt-40 md:pb-32">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
        >
          <div className="absolute -top-32 -left-32 h-[600px] w-[600px] rounded-full bg-brand-100/60 blur-3xl" />
          <div className="absolute -top-16 -right-16 h-[500px] w-[500px] rounded-full bg-secondary-100/50 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[800px] w-[800px] rounded-full bg-accent-50/40 blur-3xl" />
          <div className="absolute inset-0 bg-pattern-dots" style={{ opacity: 0.15 }} />
        </div>

        <div className="mx-auto max-w-6xl relative z-10 text-center">
          <Badge variant="brand" className="mb-6">
            AI-powered brand management
          </Badge>

          <h1 className="mx-auto max-w-4xl text-display font-display font-extrabold tracking-tight text-strong">
            Your brand. Every channel.{" "}
            <span className="bg-gradient-to-r from-brand-500 via-secondary-500 to-accent-400 bg-clip-text text-transparent">
              zero friction.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-xl text-muted">
            Abra is a hosted control plane for personal brand management.
            Upload raw content — articles, photos, voice notes — and let 29
            specialized AI skills transform it into polished, on-brand
            multi-channel posts.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button href="/sign-in" size="lg" className="gap-2">
              <span>Start for free</span>
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </Button>
            <Button variant="ghost" size="lg" href="#workflow">
              <span>Watch demo</span>
            </Button>
          </div>

          <div className="mt-14 flex flex-wrap items-center justify-center gap-3 text-caption">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-100 px-3 py-1.5 text-content-600">
              <svg className="h-4 w-4 text-success-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              29 AI skills
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-100 px-3 py-1.5 text-content-600">
              <svg className="h-4 w-4 text-success-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Instagram · LinkedIn · Twitter
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-100 px-3 py-1.5 text-content-600">
              <svg className="h-4 w-4 text-success-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Zero infrastructure
            </span>
          </div>
        </div>
      </section>

      <section id="workflow" className="relative px-4 py-24 sm:py-32">
        <div className="pointer-events-none absolute inset-0 z-0">
          <div className="gradient-blob-sm absolute left-1/4 top-20 h-[400px] w-[400px]" />
          <div className="gradient-blob absolute right-1/4 bottom-0 h-[500px] w-[500px]" />
        </div>

        <div className="mx-auto max-w-6xl relative z-10">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-4">Platform</Badge>
            <h2 className="text-h2 font-display font-bold tracking-tight text-strong">
              Everything your brand needs. Nothing it doesn&apos;t.
            </h2>
            <p className="mt-4 text-body text-muted">
              A complete content pipeline — from raw input to published post
              — with brand consistency enforced at every step.
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="group">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              </div>
              <h3 className="text-h5 font-semibold text-strong">29 AI Skills</h3>
              <p className="mt-2 text-body text-muted">
                From background removal to animated reels, brand strategy to
                SEO research — specialized models doing exactly one thing,
                exceptionally well.
              </p>
            </Card>

            <Card className="group">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary-100 text-secondary-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                </svg>
              </div>
              <h3 className="text-h5 font-semibold text-strong">Multi-Channel Output</h3>
              <p className="mt-2 text-body text-muted">
                Generate platform-optimized content for Instagram, LinkedIn,
                and Twitter — with branded visuals, tailored captions, and
                smart scheduling.
              </p>
            </Card>

            <Card className="group sm:col-span-2 lg:col-span-1">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-100 text-accent-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
                </svg>
              </div>
              <h3 className="text-h5 font-semibold text-strong">Brand Consistency</h3>
              <p className="mt-2 text-body text-muted">
                Store logos, fonts, tone guidelines, and CTA assets — then
                let brand-manager enforce them across every output. One
                source of truth, everywhere.
              </p>
            </Card>

            <Card className="group">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-h5 font-semibold text-strong">Smart Scheduling</h3>
              <p className="mt-2 text-body text-muted">
                Queue posts for optimal times via Buffer integration —
                local uploads staged to Backblaze B2, global CDN delivery
                to all channels.
              </p>
            </Card>

            <Card className="group">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary-100 text-secondary-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <h3 className="text-h5 font-semibold text-strong">Zero Infrastructure</h3>
              <p className="mt-2 text-body text-muted">
                Hosted by default. No GPU provisioning, no pipeline
                configuration. Drop your content in, and Abra handles the
                rest.
              </p>
            </Card>

            <Card className="group">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-100 text-accent-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.904 5.904 0 0112 12c-2.563 0-4.827.643-6.402 1.79M18 18.72A9.094 9.094 0 003.75 18.72M18 18.72a9.095 9.095 0 01-14.25 0m0 0a6.063 6.063 0 007.81 3.697M3.75 18.72c2.17 0 4.207-.576 5.963-1.584M7.5 21l-3-4.5M21 21l3-4.5m0 0L15 12" />
                </svg>
              </div>
              <h3 className="text-h5 font-semibold text-strong">Modular & Open</h3>
              <p className="mt-2 text-body text-muted">
                29 skills, zero lock-in. Swap models, add custom pipelines,
                or run everything locally via Docker. Your brand, your rules.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4">
        <div className="section-divider" />
      </div>

      <section className="relative px-4 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="success" className="mb-4">Workflow</Badge>
            <h2 className="text-h2 font-display font-bold tracking-tight text-strong">
              From raw content to published post
            </h2>
            <p className="mt-4 text-body text-muted">
              Three steps. No manual hand-offs. Brand consistency enforced
              at every stage.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            <div className="relative">
              <div className="flex flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500 text-2xl font-bold text-white shadow-panel">
                  1
                </div>
                <h3 className="text-h5 font-semibold text-strong">
                  Drop in raw content
                </h3>
                <p className="mt-2 max-w-xs text-body text-muted">
                  Upload photos, voice notes, articles, or video recordings.
                  Abra ingests and indexes everything.
                </p>
              </div>
              <div
                aria-hidden
                className="hidden sm:absolute sm:top-8 sm:left-full sm:z-10 sm:h-0.5 sm:w-full"
              >
                <div className="h-full bg-gradient-to-r from-brand-200 to-transparent" />
              </div>
            </div>

            <div className="relative">
              <div className="flex flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary-500 text-2xl font-bold text-white shadow-panel">
                  2
                </div>
                <h3 className="text-h5 font-semibold text-strong">
                  AI processes & adapts
                </h3>
                <p className="mt-2 max-w-xs text-body text-muted">
                  Skills run in sequence — captioning, resizing,
                  background removal, brand alignment — producing polished
                  outputs.
                </p>
              </div>
              <div
                aria-hidden
                className="hidden sm:absolute sm:top-8 sm:left-full sm:z-10 sm:h-0.5 sm:w-full"
              >
                <div className="h-full bg-gradient-to-r from-secondary-200 to-transparent" />
              </div>
            </div>

            <div className="relative">
              <div className="flex flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-500 text-2xl font-bold text-white shadow-panel">
                  3
                </div>
                <h3 className="text-h5 font-semibold text-strong">
                  Publish & schedule
                </h3>
                <p className="mt-2 max-w-xs text-body text-muted">
                  Posts land on Instagram, LinkedIn, or Twitter — on brand,
                  on time. Schedule once, publish everywhere.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-16 mx-auto max-w-2xl">
            <Surface variant="muted" className="relative overflow-hidden">
              <div
                aria-hidden
                className="pointer-events-none absolute right-0 top-0 h-full w-1/2 shape-abstract-dots opacity-20"
              />

              <div className="grid gap-4 sm:grid-cols-5">
                <div className="sm:col-span-2 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-caption font-medium text-strong">Input</p>
                    <p className="text-caption text-muted">video.mp4</p>
                  </div>
                </div>

                <div className="flex items-center justify-center sm:col-span-1">
                  <svg className="h-5 w-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </div>

                <div className="flex items-center gap-3 sm:col-span-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-100 text-accent-600">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-caption font-medium text-strong">Processed</p>
                    <p className="text-caption text-muted">
                      reel-v2.mp4 · caption.json
                    </p>
                  </div>
                </div>
              </div>

              <div className="section-divider my-4" />

              <div className="grid gap-4 sm:grid-cols-5">
                <div className="sm:col-span-2 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-100 text-success-600">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.154-.042-.3-.117-.432a.75.75 0 00-1.166 0c-.075.133-.117.278-.117.432V18m0 5v.192c0 .154.042.3.117.432.332.467.87.602 1.333.352.18-.102.324-.238.425-.399a.75.75 0 00-.032-1.003M3 18v-5.25c0-.414.336-.75.75-.75h3.75m10.5 0h.008v.008h-.008v-.008zm3 0h.008v.008h-.008v-.008z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-caption font-medium text-strong">Scheduled</p>
                    <p className="text-caption text-muted">
                      Instagram · 2:30 PM
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-center sm:col-span-1">
                  <svg className="h-5 w-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </div>

                <div className="flex items-center gap-3 sm:col-span-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.148 2.25 6.741v6.018z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-caption font-medium text-strong">Live</p>
                    <p className="text-caption text-muted">Published → 248 views</p>
                  </div>
                </div>
              </div>
            </Surface>
          </div>
        </div>
      </section>

      <section className="relative px-4 py-24 sm:py-32">
        <div className="pointer-events-none absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-surface-default via-brand-50 to-surface-default" />
          <div className="gradient-blob-lg absolute left-1/3 top-0 h-[600px] w-[600px]" />
          <div className="gradient-blob absolute right-1/4 bottom-0 h-[400px] w-[400px]" />
        </div>

        <div className="mx-auto max-w-2xl text-center relative z-10">
          <h2 className="text-h2 font-display font-bold tracking-tight text-strong">
            Ready to build your brand at scale?
          </h2>
          <p className="mt-4 text-xl text-muted">
            Join early users who turn raw content into consistent, branded
            multi-channel posts — without the ops overhead.
          </p>
          <div className="mt-10">
            <Button href="/sign-in" size="lg" className="gap-2">
              <span>Get started free</span>
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </Button>
          </div>
          <p className="mt-4 text-caption text-faint">
            No credit card required · Free tier available
          </p>
        </div>
      </section>

      <footer className="border-t border-border-subtle px-4 py-10 sm:py-12">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-2 text-h5 font-bold text-strong">
              <svg
                className="h-6 w-6"
                viewBox="0 0 28 28"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="14" cy="14" r="13" className="fill-brand-500" />
                <path
                  d="M9 14l3.5 3.5L19 11"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="tracking-tight">Abra</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-caption text-muted">
              <UILink href="/docs" variant="muted">Docs</UILink>
              <UILink href="/privacy" variant="muted">Privacy</UILink>
              <UILink href="/terms" variant="muted">Terms</UILink>
              <a
                href="https://github.com/claw-parade"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-muted hover:text-strong transition-colors duration-150"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </a>
            </div>

            <p className="text-caption text-faint">
              &copy; {new Date().getFullYear()} Abra. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
