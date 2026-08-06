import Link from "next/link";

export default function BusinessAdvertisingSuccessPage() {
  return (
    <main className="min-h-screen bg-[#05050d] px-6 py-20 text-white">
      <section className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl md:p-12">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 text-4xl text-emerald-400">
          &#10003;
        </div>

        <p className="mb-3 text-sm font-black uppercase tracking-[0.25em] text-emerald-400">
          Payment successful
        </p>

        <h1 className="text-3xl font-black md:text-5xl">
          Your advertising payment was completed
        </h1>

        <p className="mt-6 text-base leading-7 text-white/70 md:text-lg">
          Your business advertising submission has been received and is now
          awaiting review and scheduling by SOLO BEATS ENGINE MUSIC.
        </p>

        <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-5 text-left">
          <p className="font-bold text-white">What happens next</p>

          <p className="mt-2 text-sm leading-6 text-white/65">
            We will review your campaign information, confirm your advertising
            placement, and prepare it for the approved campaign schedule.
          </p>
        </div>

        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          <Link
            href="/"
            className="rounded-xl bg-white px-7 py-4 font-black text-black transition hover:bg-white/90"
          >
            Return Home
          </Link>

          <Link
            href="/business-advertising"
            className="rounded-xl border border-white/20 px-7 py-4 font-black text-white transition hover:bg-white/10"
          >
            Business Advertising
          </Link>
        </div>
      </section>
    </main>
  );
}