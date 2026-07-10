export default function AWorldBuiltOnSoundPage() {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="max-w-2xl text-center">

        <a
          href="/albums"
          className="inline-block mb-6 text-fuchsia-500 hover:text-fuchsia-300"
        >
          ← Back to Albums
        </a>

        <img
          src="/covers/aworldbuiltonsound.png"
          alt="A World Built on Sound"
          className="w-80 mx-auto rounded-2xl shadow-2xl"
        />

        <h1 className="text-5xl font-bold mt-8">
          A World Built on Sound
        </h1>

        <p className="text-gray-400 mt-4">
          2026 • 20 Tracks
        </p>

        <audio controls className="w-full mt-8">
          <source
            src="/previews/aworldbuiltonsound.wav"
            type="audio/wav"
          />
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