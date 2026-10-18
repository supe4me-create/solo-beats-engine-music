{/* SOLO_OWNER_TOOLS_HUB_V1 */}
export default function OwnerToolsHub() {
  return (
    <main className="min-h-screen bg-black px-5 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <a
          href="/developer"
          className="text-sm font-semibold text-violet-300 hover:text-white"
        >
          Back to Control Center
        </a>

        <h1 className="mt-8 text-4xl font-black tracking-tight">
          SOLO BEATS OWNER TOOLS
        </h1>

        <p className="mt-4 max-w-3xl text-white/60">
          Central access to existing platform management tools.
          Each tool retains its existing functionality and permissions.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <a
            href="/developer/videos"
            className="rounded-2xl border border-white/15 bg-white/5 p-5 transition hover:border-violet-400 hover:bg-violet-500/10"
          >
            <span className="block text-lg font-bold">Video Management</span>
            <span className="mt-2 block text-sm text-white/50">
              Open management
            </span>
          </a>
          <a
            href="/developer/analytics"
            className="rounded-2xl border border-white/15 bg-white/5 p-5 transition hover:border-violet-400 hover:bg-violet-500/10"
          >
            <span className="block text-lg font-bold">Owner Analytics</span>
            <span className="mt-2 block text-sm text-white/50">
              Open management
            </span>
          </a>
          <a
            href="/developer/homepage"
            className="rounded-2xl border border-white/15 bg-white/5 p-5 transition hover:border-violet-400 hover:bg-violet-500/10"
          >
            <span className="block text-lg font-bold">Homepage Management</span>
            <span className="mt-2 block text-sm text-white/50">
              Open management
            </span>
          </a>
          <a
            href="/developer/ai-video"
            className="rounded-2xl border border-white/15 bg-white/5 p-5 transition hover:border-violet-400 hover:bg-violet-500/10"
          >
            <span className="block text-lg font-bold">AI Video Generator</span>
            <span className="mt-2 block text-sm text-white/50">
              Open management
            </span>
          </a>
          <a
            href="/developer/auto-video-generator"
            className="rounded-2xl border border-white/15 bg-white/5 p-5 transition hover:border-violet-400 hover:bg-violet-500/10"
          >
            <span className="block text-lg font-bold">Auto Video Generator</span>
            <span className="mt-2 block text-sm text-white/50">
              Open management
            </span>
          </a>
          <a
            href="/developer/premium-members"
            className="rounded-2xl border border-white/15 bg-white/5 p-5 transition hover:border-violet-400 hover:bg-violet-500/10"
          >
            <span className="block text-lg font-bold">Premium Members</span>
            <span className="mt-2 block text-sm text-white/50">
              Open management
            </span>
          </a>
          <a
            href="/developer/social-scheduler"
            className="rounded-2xl border border-white/15 bg-white/5 p-5 transition hover:border-violet-400 hover:bg-violet-500/10"
          >
            <span className="block text-lg font-bold">Social Scheduler</span>
            <span className="mt-2 block text-sm text-white/50">
              Open management
            </span>
          </a>
          <a
            href="/developer/business-advertising"
            className="rounded-2xl border border-white/15 bg-white/5 p-5 transition hover:border-violet-400 hover:bg-violet-500/10"
          >
            <span className="block text-lg font-bold">Business Advertising</span>
            <span className="mt-2 block text-sm text-white/50">
              Open management
            </span>
          </a>
          <a
            href="/developer/radio"
            className="rounded-2xl border border-white/15 bg-white/5 p-5 transition hover:border-violet-400 hover:bg-violet-500/10"
          >
            <span className="block text-lg font-bold">Radio Management</span>
            <span className="mt-2 block text-sm text-white/50">
              Open management
            </span>
          </a>
          <a
            href="/developer/daw"
            className="rounded-2xl border border-white/15 bg-white/5 p-5 transition hover:border-violet-400 hover:bg-violet-500/10"
          >
            <span className="block text-lg font-bold">DAW</span>
            <span className="mt-2 block text-sm text-white/50">
              Open management
            </span>
          </a>
        </div>

        <div className="mt-8 rounded-2xl border border-violet-400/20 bg-violet-500/5 p-5">
          <h2 className="text-xl font-bold">
            Creator Approval Center
          </h2>
          <p className="mt-2 text-sm text-white/60">
            Manage creator video approval through the existing Video Management page.
          </p>
          <a
            href="/developer/videos#creator-approval-center"
            className="mt-4 inline-block font-bold text-violet-300 hover:text-white"
          >
            Open Approval Center
          </a>
        </div>
      </div>
    </main>
  );
}