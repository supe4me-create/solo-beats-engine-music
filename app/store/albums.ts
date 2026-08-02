export type Track = {
  id: string;
  number: number;
  title: string;
  preview: string;
  price: number;
};

export type Album = {
  id: string;
  title: string;
  artist: string;
  year: number;
  genre: string;
  status: "released" | "upcoming";
  cover: string;
  albumPreview: string;
  albumPrice: number;
  trackPrice: number;
  pageLink: string;
  description: string;
  tracks: Track[];
};

type TrackInput = {
  title: string;
  fileName: string;
};

type AlbumInput = {
  id: string;
  title: string;
  artist: string;
  year: number;
  genre: string;
  status: "released" | "upcoming";
  cover: string;
  albumPreviewFileName: string;
  description: string;
  tracks: TrackInput[];
};

function createAlbum(input: AlbumInput): Album {
  const tracks: Track[] = input.tracks.map((track, index) => ({
    id: `${input.id}-${String(index + 1).padStart(2, "0")}`,
    number: index + 1,
    title: track.title,
    preview: `/previews/${input.id}/${track.fileName}`,
    price: 1,
  }));

  return {
    id: input.id,
    title: input.title,
    artist: input.artist,
    year: input.year,
    genre: input.genre,
    status: input.status,
    cover: input.cover,
    albumPreview: `/previews/${input.id}/${input.albumPreviewFileName}`,
    albumPrice: tracks.length,
    trackPrice: 1,
    pageLink: `/albums/${input.id}`,
    description: input.description,
    tracks,
  };
}

const albumCatalog: Album[] = [
  createAlbum({
    id: "reckoning",
    title: "Reckoning",
    artist: "Solo Beats",
    year: 2026,
    genre: "Electronic",
    status: "upcoming",
    cover: "/covers/reckoning.png",
    albumPreviewFileName: "12 Reckoning.mp3",
    description:
      "Reckoning is the flagship upcoming Solo Beats release, featuring twenty tracks of aggressive electronic energy, explosive bass and cinematic power.",
    tracks: [
      { title: "Never Broken", fileName: "1 Never Broken.mp3" },
      { title: "Cold Resolve", fileName: "2 Cold Resolve.mp3" },
      { title: "Last Warning", fileName: "3 Last Warning.mp3" },
      { title: "Relentless", fileName: "4 Relentless.mp3" },
      { title: "Silent War", fileName: "5 Silent War.mp3" },
      { title: "Wake Up", fileName: "6 Wake Up.mp3" },
      { title: "Born to Win", fileName: "7 Born to Win.mp3" },
      { title: "World on Fire", fileName: "8 World on Fire.mp3" },
      { title: "Superhuman", fileName: "9 Superhuman.mp3" },
      { title: "Last Breath", fileName: "10 Last Breath.mp3" },
      { title: "Defiance", fileName: "11 Defiance.mp3" },
      { title: "Reckoning", fileName: "12 Reckoning.mp3" },
      { title: "Dark Rainbow", fileName: "13 Dark Rainbow.mp3" },
      { title: "Dangerous", fileName: "14 Dangerous.mp3" },
      { title: "Ghosts Don't Sleep", fileName: "15 Ghosts Don't Sleep.mp3" },
      { title: "Before I Fade", fileName: "16 Before I Fade.mp3" },
      { title: "Red Moon", fileName: "17 Red Moon.mp3" },
      { title: "Swords Play", fileName: "18 Swords Play.mp3" },
      { title: "Last Flame", fileName: "19 Last Flame.mp3" },
      { title: "Thunder Rise", fileName: "20 Thunder Rise.mp3" },
    ],
  }),

  createAlbum({
    id: "blur",
    title: "Blur",
    artist: "Solo Beats",
    year: 2026,
    genre: "Electronic",
    status: "released",
    cover: "/covers/blur.png",
    albumPreviewFileName: "Bunny Hops.mp3",
    description:
      "Experience Blur, an eighteen-track Solo Beats album filled with colorful electronic textures, rhythmic movement, atmospheric melodies and futuristic energy.",
    tracks: [
      { title: "Bunny Hops", fileName: "Bunny Hops.mp3" },
      { title: "Classic Cadence", fileName: "Classic Cadence.mp3" },
      { title: "Cryptic Chords", fileName: "Cryptic Chords.mp3" },
      { title: "Drop It Tonight", fileName: "Drop It Tonight.mp3" },
      { title: "Dynamic Duets", fileName: "Dynamic Duets.mp3" },
      { title: "Glacial Grooves", fileName: "Glacial Grooves.mp3" },
      { title: "Laughter Lines", fileName: "Laughter Lines.mp3" },
      { title: "Limelight", fileName: "Limelight.mp3" },
      { title: "Mind Games", fileName: "Mind Games.mp3" },
      { title: "Mystic Paradox", fileName: "Mystic Paradox.mp3" },
      { title: "Pixel Dust Tunes", fileName: "Pixel Dust Tunes.mp3" },
      { title: "Riff Riders", fileName: "Riff Riders.mp3" },
      { title: "Shadow Of Silence", fileName: "Shadow Of Silence.mp3" },
      { title: "Silly Moon", fileName: "Silly Moon.mp3" },
      { title: "Smooth Synth", fileName: "Smooth Synth.mp3" },
      { title: "Velvet Nocturne", fileName: "Velvet Nocturne.mp3" },
      { title: "Visionary Vibes", fileName: "Visionary Vibes.mp3" },
      { title: "Witty Waves", fileName: "Witty Waves.mp3" },
    ],
  }),

  createAlbum({
    id: "full-speed",
    title: "Full Speed",
    artist: "Solo Beats",
    year: 2026,
    genre: "Electro House",
    status: "released",
    cover: "/covers/fullspeed.jpg",
    albumPreviewFileName: "16 Full Speed .mp3",
    description:
      "Experience Full Speed, a twenty-track Solo Beats album driven by relentless electro-house energy, heavy rhythms, sharp synths and high-speed momentum.",
    tracks: [
      { title: "Drop Fever", fileName: "1 Drop Fever.mp3" },
      { title: "Heavy Aura", fileName: "2 Heavy Aura.mp3" },
      { title: "Red Night", fileName: "3 Red Night.mp3" },
      { title: "Floor Shake", fileName: "4 Floor Shake.mp3" },
      { title: "Motion Blur", fileName: "5 Motion Blur.mp3" },
      { title: "Cut Access", fileName: "6 Cut Access.mp3" },
      { title: "Locked Out", fileName: "7 Locked Out.mp3" },
      { title: "Dead Line", fileName: "8 Dead Line.mp3" },
      { title: "Still Standing", fileName: "9 Still Standing.mp3" },
      { title: "Stay Cold", fileName: "10 Stay Cold.mp3" },
      { title: "Chain Cut", fileName: "11 Chain Cut.mp3" },
      { title: "Halt", fileName: "12 Halt.mp3" },
      { title: "Lock Trigger", fileName: "13 Lock Trigger.mp3" },
      { title: "Hard Sever", fileName: "14 Hard Sever.mp3" },
      { title: "Exile", fileName: "15 Exile.mp3" },
      { title: "Full Speed", fileName: "16 Full Speed .mp3" },
      { title: "Stay Winning", fileName: "17 Stay Winning.mp3" },
      { title: "Moon Shift", fileName: "18 Moon Shift .mp3" },
      { title: "Calm Fire", fileName: "19 Calm Fire.mp3" },
      { title: "Light It Up", fileName: "20 Light It Up.mp3" },
    ],
  }),

  createAlbum({
    id: "night-terror",
    title: "Night Terror",
    artist: "Solo Beats",
    year: 2026,
    genre: "Electronic",
    status: "released",
    cover: "/covers/night-terror.jpg",
    albumPreviewFileName: "19 Night Terror.mp3",
    description:
      "Experience Night Terror, a nineteen-track Solo Beats album filled with cinematic electronic atmosphere, emotional melodies, dark energy and powerful futuristic sound.",
    tracks: [
      { title: "Vagabond Tune", fileName: "1 Vagabond Tune.mp3" },
      { title: "Paper Bloom", fileName: "2 Paper Bloom.mp3" },
      { title: "Solar Kiss", fileName: "3 Solar Kiss.mp3" },
      { title: "Cloud Bloom", fileName: "4 Cloud Bloom.mp3" },
      { title: "First Frost", fileName: "5 First Frost.mp3" },
      { title: "Glowstream", fileName: "6 Glowstream.mp3" },
      { title: "Stillpoint", fileName: "7 Stillpoint.mp3" },
      { title: "Deepdrift", fileName: "8 Deepdrift.mp3" },
      { title: "Cloudsong", fileName: "9 Cloudsong.mp3" },
      { title: "Everdark", fileName: "10 Everdark.mp3" },
      { title: "Ghostveil", fileName: "11 Ghostveil.mp3" },
      { title: "Dreamshard", fileName: "12 Dreamshard.mp3" },
      { title: "Raindrop Soul", fileName: "13 Raindrop Soul.mp3" },
      { title: "Glass Sea", fileName: "14 Glass Sea.mp3" },
      { title: "Silent Core", fileName: "15 Silent Core.mp3" },
      { title: "Starfall", fileName: "16 Starfall.mp3" },
      { title: "Wild Scars", fileName: "17 Wild Scars.mp3" },
      { title: "Fear Strike", fileName: "18 Fear Strike.mp3" },
      { title: "Night Terror", fileName: "19 Night Terror.mp3" },
    ],
  }),


  createAlbum({
    id: "reboot",
    title: "Reboot",
    artist: "Solo Beats",
    year: 2026,
    genre: "Electronic",
    status: "released",
    cover: "/covers/reboot.jpg",
    albumPreviewFileName: "6 Reboot.mp3",
    description:
      "Experience Reboot, a twenty-track Solo Beats album packed with powerful electronic energy, heavy bass, bold melodies and relentless momentum.",
    tracks: [
      { title: "Volt Rush", fileName: "1 Volt Rush.mp3" },
      { title: "No Hero", fileName: "2 No Hero.mp3" },
      { title: "Hot Bullet", fileName: "3 Hot Bullet.mp3" },
      { title: "Break the Floor", fileName: "4 Break the Floor (1).wav" },
      { title: "Lonely Beat", fileName: "5 Lonely Beat.mp3" },
      { title: "Reboot", fileName: "6 Reboot .wav" },
      { title: "Pure Love", fileName: "7 Pure Love.mp3" },
      { title: "Hook Machine", fileName: "8 Hook Machine.mp3" },
      { title: "No Explanation", fileName: "9 No Explanation.mp3" },
      { title: "Enough", fileName: "10 Enough.mp3" },
      { title: "Not Yet", fileName: "11 Not Yet.mp3" },
      { title: "Without Pause", fileName: "12 Without Pause.mp3" },
      { title: "Golden Sound", fileName: "13 Golden Sound.mp3" },
      { title: "Victory", fileName: "14 Victory.mp3" },
      { title: "Ground Bass", fileName: "15 Ground Bass.mp3" },
      { title: "Mass", fileName: "16 Mass.mp3" },
      { title: "State Motion", fileName: "17 State Motion.wav" },
      { title: "Titan", fileName: "18 Titan.mp3" },
      { title: "Wrath of Giants", fileName: "19 Wrath of Giants.mp3" },
      { title: "First Beast", fileName: "20 First Beast.mp3" },
    ],
  }),

  createAlbum({
    id: "strange-feeling",
    title: "Strange Feeling",
    artist: "Solo Beats",
    year: 2026,
    genre: "Electronic",
    status: "released",
    cover: "/covers/strangefeeling.png",
    albumPreviewFileName: "20-strange-feeling.mp3",
    description:
      "Experience Strange Feeling, a powerful twenty-track Solo Beats album packed with electronic energy, atmospheric melodies and unforgettable sound.",
    tracks: [
      { title: "Steel Venom", fileName: "01-steel-venom.mp3" },
      { title: "Meltdown", fileName: "02-meltdown.mp3" },
      { title: "Nickel Tempest", fileName: "03-nickel-tempest.mp3" },
      { title: "Blade Runner", fileName: "04-blade-runner.mp3" },
      { title: "Wrong Turn", fileName: "05-wrong-turn.mp3" },
      { title: "Cold Exit", fileName: "06-cold-exit.mp3" },
      { title: "Empty Throne", fileName: "07-empty-throne.mp3" },
      { title: "Grey Ticket", fileName: "08-grey-ticket.mp3" },
      { title: "Silent Empire", fileName: "09-silent-empire.mp3" },
      { title: "Bad Intentions", fileName: "10-bad-intentions.mp3" },
      { title: "Maximum Damage", fileName: "11-maximum-damage.mp3" },
      { title: "Nothing to Lose", fileName: "12-nothing-to-lose.mp3" },
      { title: "Too Late", fileName: "13-too-late.mp3" },
      { title: "Out of Time", fileName: "14-out-of-time.mp3" },
      { title: "Not Today", fileName: "15-not-today.mp3" },
      { title: "Bad Memory", fileName: "16-bad-memory.mp3" },
      { title: "Last Mistake", fileName: "17-last-mistake.mp3" },
      { title: "Into the Dark", fileName: "18-into-the-dark.mp3" },
      { title: "Between Worlds", fileName: "19-between-worlds.mp3" },
      { title: "Strange Feeling", fileName: "20-strange-feeling.mp3" },
    ],
  }),

  createAlbum({
    id: "neon-lights",
    title: "Neon Lights",
    artist: "Solo Beats",
    year: 2026,
    genre: "Electronic",
    status: "released",
    cover: "/covers/neonlights.png",
    albumPreviewFileName: "Neon Lights-10.mp3",
    description:
      "Experience Neon Lights, a ten-track Solo Beats album filled with energetic electronic rhythms, bright melodies and late-night atmosphere.",
    tracks: [
      { title: "Sexy Desert", fileName: "Sexy Desert-1.mp3" },
      { title: "Right Now", fileName: "Right Now-2.mp3" },
      { title: "Near Smile", fileName: "Near Smile-3.mp3" },
      { title: "No Shop Loop", fileName: "No Shop Loop-4.mp3" },
      { title: "Hot Wave", fileName: "Hot Wave-5.mp3" },
      { title: "Late Time", fileName: "Late Time-6.mp3" },
      { title: "Latino Theory", fileName: "Latino Theory-7.mp3" },
      { title: "Dancing Mess", fileName: "Dancing Mess-8.mp3" },
      { title: "Cold Train", fileName: "Cold Train-9.mp3" },
      { title: "Neon Lights", fileName: "Neon Lights-10.mp3" },
    ],
  }),

  createAlbum({
    id: "mystery",
    title: "Mystery",
    artist: "Solo Beats",
    year: 2026,
    genre: "Electronic",
    status: "released",
    cover: "/covers/mystery.jpg",
    albumPreviewFileName: "Mystery 4.mp3",
    description:
      "Experience Mystery, a ten-track Solo Beats album filled with dark electronic melodies, cinematic atmosphere and powerful energy.",
    tracks: [
      { title: "Cool Destiny", fileName: "Cool Destiny 1.mp3" },
      { title: "Feel Again", fileName: "Feel Again 2.mp3" },
      { title: "Bad Option", fileName: "Bad Option 3.mp3" },
      { title: "Mystery", fileName: "Mystery 4.mp3" },
      { title: "Dark Night", fileName: "Dark Night 5.mp3" },
      { title: "Pure Energy", fileName: "Pure Energy 6.mp3" },
      { title: "Glowing", fileName: "Glowing 7.mp3" },
      { title: "This Power", fileName: "This Power 8.mp3" },
      { title: "Smiling Juice", fileName: "Smilling Juice 9.mp3" },
      { title: "Find Ends", fileName: "Find Ends 10.mp3" },
    ],
  }),

  createAlbum({
    id: "echoes-of-power",
    title: "Echoes of Power",
    artist: "Solo Beats",
    year: 2026,
    genre: "Electronic",
    status: "released",
    cover: "/covers/echoes-of-power.jpg",
    albumPreviewFileName: "Ambient Winter.mp3",
    description:
      "Experience Echoes of Power, a twenty-track Solo Beats album filled with powerful electronic energy, cinematic melodies and unforgettable atmosphere.",
    tracks: [
      { title: "Ambient Winter", fileName: "Ambient Winter.mp3" },
      { title: "Chaos Power", fileName: "Chaos Power.mp3" },
      { title: "Courage Of Joy", fileName: "Courage Of Joy.mp3" },
      { title: "Crystal Code", fileName: "Crystal Code.mp3" },
      { title: "Dark's Fire", fileName: "Dark's Fire.mp3" },
      { title: "Defender Of Power", fileName: "Defender Of Power.mp3" },
      { title: "Grace Of Beasts", fileName: "Grace Of Beasts.mp3" },
      { title: "Home Of Hope", fileName: "Home Of Hope.mp3" },
      { title: "Memory of Solitude", fileName: "Memory of Solitude.mp3" },
      { title: "River Sage", fileName: "River Sage.mp3" },
      { title: "Sea of Peace", fileName: "Sea of Peace.mp3" },
      { title: "Silent Armies", fileName: "Silent Armies.mp3" },
      { title: "Soul Smoke", fileName: "Soul Smoke .mp3" },
      { title: "Summer's Bite", fileName: "Summer's Bite.mp3" },
      { title: "The invisible", fileName: "The invisible.mp3" },
      { title: "The Little Tune", fileName: "The Little Tune.mp3" },
      { title: "Thunder's Fire", fileName: "Thunder's Fire.mp3" },
      { title: "Tunnel Illusion", fileName: "Tunnel Illusion.mp3" },
      { title: "Voyage of Desire", fileName: "Voyage of Desire.mp3" },
      { title: "Wild People", fileName: "Wild People.mp3" },
    ],
  }),

  createAlbum({
    id: "neon-overdrive",
    title: "Neon Overdrive",
    artist: "Solo Beats",
    year: 2026,
    genre: "Complextro",
    status: "released",
    cover: "/covers/neon-overdrive.jpg",
    albumPreviewFileName: "Neon Overdrive8.mp3",
    description:
      "Experience Neon Overdrive, a ten-track Solo Beats album packed with futuristic complextro energy, cyber-powered bass, bright synths and high-speed electronic rhythms.",
    tracks: [
      { title: "Pulse Invaders", fileName: "Pulse Invaders1.mp3" },
      { title: "Pixel Riot", fileName: "Pixel Riot2.mp3" },
      { title: "Rhythm Nexus", fileName: "Rhythm Nexus3.mp3" },
      { title: "Voltage Arena", fileName: "Voltage Arena4.mp3" },
      { title: "Level Up", fileName: "Level Up5.mp3" },
      { title: "Dance Protocol", fileName: "Dance Protocol6.mp3" },
      { title: "Nightshift Energy", fileName: "Nightshift Energy7.mp3" },
      { title: "Neon Overdrive", fileName: "Neon Overdrive8.mp3" },
      { title: "Bass Crusaders", fileName: "Bass Crusaders9.mp3" },
      { title: "Cyber Groove", fileName: "Cyber Groove10.mp3" },
    ],
  }),

  createAlbum({
    id: "unchained-energy",
    title: "Unchained Energy",
    artist: "Solo Beats",
    year: 2026,
    genre: "Electronic",
    status: "released",
    cover: "/covers/unchained-energy.png",
    albumPreviewFileName: "Unchained Energy.mp3",
    description:
      "Experience Unchained Energy, a ten-track Solo Beats album filled with powerful electronic rhythms, cinematic atmosphere, explosive melodies and unstoppable energy.",
    tracks: [
      { title: "Break the Silence", fileName: "Break the Silence.mp3" },
      { title: "Broken Frequency", fileName: "Broken Frequency.mp3" },
      { title: "Chasing Shadows", fileName: "Chasing Shadows.mp3" },
      { title: "Crashing Lights", fileName: "Crashing Lights.mp3" },
      { title: "Fallen Sparks", fileName: "Fallen Sparks.mp3" },
      { title: "Into the Fire", fileName: "Into the Fire.mp3" },
      { title: "Rise of Motion", fileName: "Rise of Motion.mp3" },
      { title: "Static Reflection", fileName: "Static Reflection.mp3" },
      { title: "Storm of Echoes", fileName: "Storm of Echoes.mp3" },
      { title: "Unchained Energy", fileName: "Unchained Energy.mp3" },
    ],
  }),

  createAlbum({
    id: "novafx",
    title: "Novafx",
    artist: "Solo Beats",
    year: 2026,
    genre: "Complextro",
    status: "released",
    cover: "/covers/novafx.jpg",
    albumPreviewFileName: "Novafx5.mp3",
    description:
      "Experience Novafx, a twelve-track Solo Beats album powered by futuristic complextro energy, glitch-driven synths, explosive bass and high-impact electronic rhythms.",
    tracks: [
      { title: "Glitch Spark", fileName: "Glitch Spark 1.mp3" },
      { title: "Vyntriq", fileName: "Vyntriq2.mp3" },
      { title: "Aerosync", fileName: "Aerosync3.mp3" },
      { title: "Fractalord", fileName: "Fractalord4.mp3" },
      { title: "Novafx", fileName: "Novafx5.mp3" },
      { title: "Hyperstrata", fileName: "Hyperstrata 6.mp3" },
      { title: "Zynkrush", fileName: "Zynkrush7.mp3" },
      { title: "Pulse Reactor", fileName: "Pulse Reactor 8.mp3" },
      { title: "Ecl1pz", fileName: "Ecl1pz9.mp3" },
      { title: "Luxtron1c", fileName: "Luxtron1c 10.mp3" },
      { title: "Hot Vibes", fileName: "Hot Vibes 11.mp3" },
      { title: "Pump It Up", fileName: "Pump It Up.mp3" },
    ],
  }),

  createAlbum({
    id: "more-touch",
    title: "More Touch",
    artist: "Solo Beats",
    year: 2026,
    genre: "Electronic",
    status: "released",
    cover: "/covers/more-touch.jpg",
    albumPreviewFileName: "Golden Love 10.mp3",
    description:
      "Experience More Touch, a ten-track Solo Beats album filled with energetic electronic rhythms, bright melodies, arcade-inspired movement and uplifting atmosphere.",
    tracks: [
      { title: "Tea Desert", fileName: "Tea Desert 1.mp3" },
      { title: "Cold Motion", fileName: "Cold Motion 2.mp3" },
      { title: "Wild Out Here", fileName: "Wild Out Here 3.mp3" },
      { title: "Royal Hall", fileName: "Royal Hall 4.mp3" },
      { title: "Energetic Light", fileName: "Energetic Light 5.mp3" },
      { title: "Break Flow", fileName: "Break Flow 6.mp3" },
      { title: "Shuffle", fileName: "Shuffle 7.mp3" },
      { title: "Funny Wish", fileName: "Funny Wish 8.mp3" },
      { title: "Is This Arcade", fileName: "Is This Arcade 9.mp3" },
      { title: "Golden Love", fileName: "Golden Love 10.mp3" },
    ],
  }),

  createAlbum({
    id: "summer-blast",
    title: "Summer Blast",
    artist: "Solo Beats",
    year: 2026,
    genre: "Electronic",
    status: "released",
    cover: "/covers/summer-blast.jpg",
    albumPreviewFileName: "Summer Blast 1.mp3",
    description:
      "Experience Summer Blast, a ten-track Solo Beats album filled with warm electronic energy, uplifting rhythms, bright melodies and vibrant summer atmosphere.",
    tracks: [
      { title: "Summer Blast", fileName: "Summer Blast 1.mp3" },
      { title: "Troubles", fileName: "Troubles-2.mp3" },
      { title: "Upbeat Heroes", fileName: "Upbeat Heroes-3.mp3" },
      { title: "No Flavors", fileName: "No Flavors-4.mp3" },
      { title: "Safe Tears", fileName: "Safe Tears-5.mp3" },
      { title: "Last Heaven", fileName: "Last Heaven-6.mp3" },
      { title: "Romantic Pride", fileName: "Romantic Pride-7.mp3" },
      { title: "Babe Midnight", fileName: "Babe Midnight-8.mp3" },
      { title: "Night Solo", fileName: "Night Solo-9.mp3" },
      { title: "Long Gem", fileName: "Long Gem-10.mp3" },
    ],
  }),

  createAlbum({
    id: "invincible",
    title: "Invincible",
    artist: "Solo Beats",
    year: 2026,
    genre: "Electronic",
    status: "released",
    cover: "/covers/Invincible-cover.jpg",
    albumPreviewFileName: "Courageous Time 1.mp3",
    description:
      "Experience Invincible, a ten-track Solo Beats album driven by bold electronic rhythms, confident melodies, powerful energy and a futuristic atmosphere.",
    tracks: [
      { title: "Courageous Time", fileName: "Courageous Time 1.mp3" },
      { title: "Free Hugs", fileName: "Free Hugs2.mp3" },
      { title: "No Mercy", fileName: "No Mercy3.mp3" },
      { title: "Bad Option", fileName: "Bad Option 4.mp3" },
      { title: "Open Light", fileName: "Open Light5.mp3" },
      { title: "Powerful Swag", fileName: "Powerful Swag6.mp3" },
      { title: "Time Of Power", fileName: "Time Of Power7.mp3" },
      { title: "Green Feelings", fileName: "Green Feelings8.mp3" },
      { title: "Silver Madness", fileName: "Silver Madness9.mp3" },
      { title: "Attractive Touch", fileName: "Attractive Touch 10.mp3" },
    ],
  }),

  createAlbum({
    id: "tasty-smile",
    title: "Tasty Smile",
    artist: "Solo Beats",
    year: 2026,
    genre: "Electronic",
    status: "released",
    cover: "/covers/tasty-smile.jpg",
    albumPreviewFileName: "Better Lies.mp3",
    description:
      "Experience Tasty Smile, a ten-track Solo Beats album filled with emotional electronic melodies, reflective atmosphere, warm energy and memorable rhythms.",
    tracks: [
      { title: "Better Lies", fileName: "Better Lies.mp3" },
      { title: "Cold Memories", fileName: "Cold Memories.mp3" },
      { title: "Next Scars", fileName: "Next Scars.mp3" },
      { title: "No Darkness", fileName: "No Darkness.mp3" },
      { title: "Not Up", fileName: "Not Up.mp3" },
      { title: "Old Piano", fileName: "Old Piano.mp3" },
      { title: "Only Mercy", fileName: "Only Mercy.mp3" },
      { title: "Pure Jam", fileName: "Pure Jam.mp3" },
      { title: "Soft Hugs", fileName: "Soft Hugs.mp3" },
      { title: "Tough Chance", fileName: "Tough Chance.mp3" },
    ],
  }),

  createAlbum({
    id: "beaming-dance",
    title: "Beaming Dance",
    artist: "Solo Beats",
    year: 2026,
    genre: "Electronic",
    status: "released",
    cover: "/covers/beaming-dance.jpg",
    albumPreviewFileName: "Breaking Time.mp3",
    description:
      "Experience Beaming Dance, a ten-track Solo Beats album filled with vibrant electronic rhythms, colorful melodies, uplifting movement and energetic dance atmosphere.",
    tracks: [
      { title: "Breaking Time", fileName: "Breaking Time.mp3" },
      { title: "Cold Angel", fileName: "Cold Angel.mp3" },
      { title: "Deep Skies", fileName: "Deep Skies.mp3" },
      { title: "Easy Light", fileName: "Easy Light.mp3" },
      { title: "Epic Cue", fileName: "Epic Cue.mp3" },
      { title: "Hot Heroes", fileName: "Hot Heroes (2).mp3" },
      { title: "Hot Whoop", fileName: "Hot Whoop.mp3" },
      { title: "My Happy Time", fileName: "My Happy Time.mp3" },
      { title: "Sad Vibrations", fileName: "Sad Vibrations.mp3" },
      { title: "Ten Energy", fileName: "Ten Energy.mp3" },
    ],
  }),

  createAlbum({
    id: "cant-miss-it",
    title: "Can't Miss It",
    artist: "Solo Beats",
    year: 2026,
    genre: "Electronic",
    status: "released",
    cover: "/covers/cant-miss-it.jpg",
    albumPreviewFileName: "Bad wolf-9.mp3",
    description:
      "Experience Can't Miss It, a ten-track Solo Beats album packed with energetic electronic rhythms, bold melodies, futuristic movement and powerful atmosphere.",
    tracks: [
      { title: "Bad Wolf", fileName: "Bad wolf-9.mp3" },
      { title: "Bullet Bites", fileName: "Bullet bites1.mp3" },
      { title: "Death of Roses", fileName: "Death of roses3.mp3" },
      { title: "Double Trouble", fileName: "Double trouble8.mp3" },
      { title: "Dream Big", fileName: "Dream big4.mp3" },
      { title: "Evolution", fileName: "Evolution 10.mp3" },
      { title: "Fight and Flight", fileName: "Fight and flight5 (2).mp3" },
      { title: "Fluke", fileName: "Fluke7 (1).mp3" },
      { title: "Focus", fileName: "Focus2.mp3" },
      { title: "No Basis", fileName: "No basis6 (3).mp3" },
    ],
  }),

  createAlbum({
    id: "cygnus-x",
    title: "Cygnus X",
    artist: "Solo Beats",
    year: 2024,
    genre: "Electronic",
    status: "released",
    cover: "/covers/cygnus-x.jpg",
    albumPreviewFileName: "Inspiration-wav.mp3",
    description:
      "Experience Cygnus X, a twenty-track Solo Beats album filled with futuristic electronic sound, cosmic atmosphere, powerful rhythms and evolving cinematic energy.",
    tracks: [
      { title: "Inspiration", fileName: "Inspiration-wav.mp3" },
      { title: "Particle Storm", fileName: "particle Storm-wav.mp3" },
      { title: "Memory Leak", fileName: "Memory Leak-wav.mp3" },
      { title: "Disruptor", fileName: "Disruptor-wav.mp3" },
      { title: "Parallax", fileName: "Parallax-wav.mp3" },
      { title: "Viral Decay", fileName: "Viral Decay-wav.mp3" },
      { title: "Reboot", fileName: "Reboot-wav.mp3" },
      { title: "Nexus", fileName: "Nexus-wav.mp3" },
      { title: "Aurora Ignite", fileName: "Aurora Ignite-wav.mp3" },
      { title: "Quasar Flux", fileName: "Quasar Flux-wav.mp3" },
      { title: "Axiom", fileName: "Axiom-.mp3" },
      { title: "Displace", fileName: "Displace-wav.mp3" },
      { title: "Dark Force", fileName: "Dark Force-wav.mp3" },
      { title: "Turbulence", fileName: "Turbulence-wav.mp3" },
      { title: "Sunder", fileName: "Sunder-wav.mp3" },
      { title: "Jolt", fileName: "Jolt-wav.mp3" },
      { title: "Neptune", fileName: "Neptune-wav.mp3" },
      { title: "Party Cheer", fileName: "Party Cheer-wav.mp3" },
      { title: "Pentakill", fileName: "Pentakill-wav.mp3" },
      { title: "Catalyst", fileName: "Catalyst-wav.mp3" },
    ],
  }),
];

export const albums: Album[] = albumCatalog.map((album) => ({
  ...album,
  albumPrice: Number(
    album.tracks
      .reduce((total, track) => total + track.price, 0)
      .toFixed(2)
  ),
}));

export function getAlbumById(id: string) {
  return albums.find((album) => album.id === id);
}

export function getTrackById(trackId: string) {
  for (const album of albums) {
    const track = album.tracks.find((item) => item.id === trackId);

    if (track) {
      return {
        album,
        track,
      };
    }
  }

  return undefined;
}


