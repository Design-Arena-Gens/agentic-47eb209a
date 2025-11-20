import { MetaAutomationDashboard } from "@/components/meta-automation-dashboard";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 py-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 md:px-10">
        <div className="rounded-3xl border border-black/5 bg-white px-8 py-10 shadow-xl ring-1 ring-black/5">
          <div className="mx-auto max-w-5xl">
            <MetaAutomationDashboard />
          </div>
        </div>
        <Footer />
      </div>
    </main>
  );
}

function Footer() {
  return (
    <footer className="mx-auto flex w-full max-w-6xl flex-col justify-between gap-4 rounded-2xl border border-zinc-200 bg-white/70 px-6 py-6 text-sm text-zinc-600 shadow-sm ring-1 ring-black/5 md:flex-row md:items-center">
      <p className="font-medium text-zinc-700">
        Need access tokens? Create them in Meta&apos;s Business Manager with the Marketing API Explorer.
      </p>
      <div className="flex gap-3 text-xs">
        <a
          href="https://developers.facebook.com/docs/graph-api/reference/page/feed#Publishing"
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-zinc-200 px-3 py-1 font-medium text-zinc-700 transition hover:bg-zinc-100"
        >
          Meta publishing docs
        </a>
        <a
          href="https://developers.facebook.com/docs/marketing-api/access"
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-zinc-200 px-3 py-1 font-medium text-zinc-700 transition hover:bg-zinc-100"
        >
          Token setup
        </a>
      </div>
    </footer>
  );
}
