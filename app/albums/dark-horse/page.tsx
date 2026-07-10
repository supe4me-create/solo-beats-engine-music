export default function DarkHorsePage() {
  return (
    <main className="min-h-screen bg-black text-white p-8">
      <a href="/albums" className="text-fuchsia-400 hover:text-fuchsia-300">
        ← Back to Albums
      </a>

      <div className="max-w-5xl mx-auto mt-8 grid md:grid-cols-2 gap-10">
        <img
          src="/covers/darkhorse.png"
          alt="Dark Horse"
          className="w-full rounded-2xl shadow-2xl shadow-fuchsia-500/40"
        />

        <div>
          <h1 className="text-5xl font-bold">Dark Horse</h1>
          <p className="text-gray-400 mt-2">Solo Beats • 2026 • 20 Tracks</p>

          <p className="mt-6 text-gray-300 leading-8">
            Dark Horse is a high-energy complextro album packed with aggressive
            bass design, cinematic melodies, and futuristic sound design.
          </p>

          <audio
            controls
            className="w-full mt-8"
            src="/previews/darkhorse.wav"
          />

          <a
            href="https://www.paypal.com/ncp/payment/R734NCX6XEV92"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-8 bg-fuchsia-600 hover:bg-fuchsia-700 px-8 py-3 rounded-xl font-bold"
          >
            Buy Album - $20
          </a>
        </div>
      </div>
    </main>
  );
}