import Link from "next/link";

export default function ConnectMonetizePage() {
  return (
    <main className="min-h-screen px-4 pb-28 pt-12 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <section className="rounded-[2rem] border border-emerald-400/20 bg-gradient-to-br from-emerald-500/15 via-black to-violet-500/15 p-7 sm:p-10">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-300">
            SOLO CONNECT
          </p>

          <h1 className="mt-3 text-4xl font-black sm:text-6xl">
            MONETIZATION
          </h1>

          <p className="mt-4 max-w-2xl text-white/60">
            Promote content, receive creator support and manage your SOLO CONNECT earnings.
          </p>

          <Link
            href="/connect"
            className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 font-black text-black"
          >
            BACK TO CONNECT
          </Link>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-2">
          <article className="rounded-3xl border border-fuchsia-400/20 bg-fuchsia-400/[0.06] p-7">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-fuchsia-300">
              PROMOTED POSTS
            </p>

            <h2 className="mt-3 text-3xl font-black">
              Boost your posts
            </h2>

            <p className="mt-3 leading-7 text-white/55">
              Promote your SOLO CONNECT posts into Discovery.
            </p>

            <Link
              href="/connect"
              className="mt-6 inline-flex rounded-xl bg-fuchsia-300 px-5 py-3 font-black text-black"
            >
              CHOOSE A POST
            </Link>
          </article>

          <article className="rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.06] p-7">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-300">
              CREATOR EARNINGS
            </p>

            <h2 className="mt-3 text-3xl font-black">
              Support & payouts
            </h2>

            <p className="mt-3 leading-7 text-white/55">
              See creator support you have received, pending payouts and completed payouts.
            </p>

            <Link
              href="/connect/earnings"
              className="mt-6 inline-flex rounded-xl bg-emerald-300 px-5 py-3 font-black text-black"
            >
              VIEW EARNINGS
            </Link>
          </article>

          <article className="rounded-3xl border border-cyan-400/20 bg-cyan-400/[0.06] p-7">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-300">
              ARTIST MEMBERSHIP
            </p>

            <h2 className="mt-3 text-3xl font-black">
              Grow as an artist
            </h2>

            <Link
              href="/artist-membership"
              className="mt-6 inline-flex rounded-xl bg-cyan-300 px-5 py-3 font-black text-black"
            >
              ARTIST MEMBERSHIP
            </Link>
          </article>

          <article className="rounded-3xl border border-violet-400/20 bg-violet-400/[0.06] p-7">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-violet-300">
              ARTIST PROMOTION
            </p>

            <h2 className="mt-3 text-3xl font-black">
              Full campaigns
            </h2>

            <Link
              href="/artist-promotion"
              className="mt-6 inline-flex rounded-xl bg-violet-300 px-5 py-3 font-black text-black"
            >
              ARTIST PROMOTION
            </Link>
          </article>

          <article className="rounded-3xl border border-amber-400/20 bg-amber-400/[0.06] p-7 md:col-span-2">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-amber-300">
              OWNER PAYOUT CONTROL
            </p>

            <h2 className="mt-3 text-3xl font-black">
              Creator payout ledger
            </h2>

            <p className="mt-3 leading-7 text-white/55">
              Owner-only payout tracking is available from the Developer area.
            </p>

            <Link
              href="/developer/connect-payouts"
              className="mt-6 inline-flex rounded-xl bg-amber-300 px-5 py-3 font-black text-black"
            >
              CREATOR PAYOUTS
            </Link>
          </article>
        </section>
      </div>
    </main>
  );
}