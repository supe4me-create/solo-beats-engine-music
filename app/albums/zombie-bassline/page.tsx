export default function ZombieBasslinePage() {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="max-w-2xl text-center">
        <img
          src="/covers/zombiebassline.png"
          alt="Zombie Bassline"
          className="w-80 mx-auto rounded-2xl shadow-2xl"
        />

        <h1 className="text-5xl font-bold mt-8">Zombie Bassline</h1>

        <p className="text-gray-400 mt-4">2026 • 20 Tracks</p>

        <audio controls className="w-full mt-8">
          <source src="/previews/zombiebassline.wav" type="audio/wav" />
        </audio>

        <a
          href="#"
          className="inline-block mt-8 bg-fuchsia-600 hover:bg-fuchsia-700 px-8 py-4 rounded-xl text-xl font-bold"
        >
          Buy Album - $20
        </a>
      </div>
    </main>
  );
}