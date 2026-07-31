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
    albumPreviewFileName: "12 Reckoning.wav",
    description:
      "Reckoning is the flagship upcoming Solo Beats release, featuring twenty tracks of aggressive electronic energy, explosive bass and cinematic power.",
    tracks: [
      { title: "Never Broken", fileName: "1 Never Broken.wav" },
      { title: "Cold Resolve", fileName: "2 Cold Resolve.wav" },
      { title: "Last Warning", fileName: "3 Last Warning.wav" },
      { title: "Relentless", fileName: "4 Relentless.wav" },
      { title: "Silent War", fileName: "5 Silent War.wav" },
      { title: "Wake Up", fileName: "6 Wake Up.wav" },
      { title: "Born to Win", fileName: "7 Born to Win.wav" },
      { title: "World on Fire", fileName: "8 World on Fire.wav" },
      { title: "Superhuman", fileName: "9 Superhuman.wav" },
      { title: "Last Breath", fileName: "10 Last Breath.wav" },
      { title: "Defiance", fileName: "11 Defiance.wav" },
      { title: "Reckoning", fileName: "12 Reckoning.wav" },
      { title: "Dark Rainbow", fileName: "13 Dark Rainbow.wav" },
      { title: "Dangerous", fileName: "14 Dangerous.wav" },
      { title: "Ghosts Don't Sleep", fileName: "15 Ghosts Don't Sleep.wav" },
      { title: "Before I Fade", fileName: "16 Before I Fade.wav" },
      { title: "Red Moon", fileName: "17 Red Moon.wav" },
      { title: "Swords Play", fileName: "18 Swords Play.wav" },
      { title: "Last Flame", fileName: "19 Last Flame.wav" },
      { title: "Thunder Rise", fileName: "20 Thunder Rise.wav" },
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
    albumPreviewFileName: "16 Full Speed .wav",
    description:
      "Experience Full Speed, a twenty-track Solo Beats album driven by relentless electro-house energy, heavy rhythms, sharp synths and high-speed momentum.",
    tracks: [
      { title: "Drop Fever", fileName: "1 Drop Fever.wav" },
      { title: "Heavy Aura", fileName: "2 Heavy Aura.wav" },
      { title: "Red Night", fileName: "3 Red Night.wav" },
      { title: "Floor Shake", fileName: "4 Floor Shake.wav" },
      { title: "Motion Blur", fileName: "5 Motion Blur.wav" },
      { title: "Cut Access", fileName: "6 Cut Access.wav" },
      { title: "Locked Out", fileName: "7 Locked Out.wav" },
      { title: "Dead Line", fileName: "8 Dead Line.wav" },
      { title: "Still Standing", fileName: "9 Still Standing.wav" },
      { title: "Stay Cold", fileName: "10 Stay Cold.wav" },
      { title: "Chain Cut", fileName: "11 Chain Cut.wav" },
      { title: "Halt", fileName: "12 Halt.wav" },
      { title: "Lock Trigger", fileName: "13 Lock Trigger.wav" },
      { title: "Hard Sever", fileName: "14 Hard Sever.wav" },
      { title: "Exile", fileName: "15 Exile.wav" },
      { title: "Full Speed", fileName: "16 Full Speed .wav" },
      { title: "Stay Winning", fileName: "17 Stay Winning.wav" },
      { title: "Moon Shift", fileName: "18 Moon Shift .wav" },
      { title: "Calm Fire", fileName: "19 Calm Fire.wav" },
      { title: "Light It Up", fileName: "20 Light It Up.wav" },
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
    albumPreviewFileName: "19 Night Terror.wav",
    description:
      "Experience Night Terror, a nineteen-track Solo Beats album filled with cinematic electronic atmosphere, emotional melodies, dark energy and powerful futuristic sound.",
    tracks: [
      { title: "Vagabond Tune", fileName: "1 Vagabond Tune.wav" },
      { title: "Paper Bloom", fileName: "2 Paper Bloom.wav" },
      { title: "Solar Kiss", fileName: "3 Solar Kiss.wav" },
      { title: "Cloud Bloom", fileName: "4 Cloud Bloom.wav" },
      { title: "First Frost", fileName: "5 First Frost.wav" },
      { title: "Glowstream", fileName: "6 Glowstream.wav" },
      { title: "Stillpoint", fileName: "7 Stillpoint.wav" },
      { title: "Deepdrift", fileName: "8 Deepdrift.wav" },
      { title: "Cloudsong", fileName: "9 Cloudsong.wav" },
      { title: "Everdark", fileName: "10 Everdark.wav" },
      { title: "Ghostveil", fileName: "11 Ghostveil.wav" },
      { title: "Dreamshard", fileName: "12 Dreamshard.wav" },
      { title: "Raindrop Soul", fileName: "13 Raindrop Soul.wav" },
      { title: "Glass Sea", fileName: "14 Glass Sea.wav" },
      { title: "Silent Core", fileName: "15 Silent Core.wav" },
      { title: "Starfall", fileName: "16 Starfall.wav" },
      { title: "Wild Scars", fileName: "17 Wild Scars.wav" },
      { title: "Fear Strike", fileName: "18 Fear Strike.wav" },
      { title: "Night Terror", fileName: "19 Night Terror.wav" },
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
    albumPreviewFileName: "6 Reboot.wav",
    description:
      "Experience Reboot, a twenty-track Solo Beats album packed with powerful electronic energy, heavy bass, bold melodies and relentless momentum.",
    tracks: [
      { title: "Volt Rush", fileName: "1 Volt Rush.wav" },
      { title: "No Hero", fileName: "2 No Hero.wav" },
      { title: "Hot Bullet", fileName: "3 Hot Bullet.wav" },
      { title: "Break the Floor", fileName: "4 Break the Floor (1).wav" },
      { title: "Lonely Beat", fileName: "5 Lonely Beat.wav" },
      { title: "Reboot", fileName: "6 Reboot .wav" },
      { title: "Pure Love", fileName: "7 Pure Love.wav" },
      { title: "Hook Machine", fileName: "8 Hook Machine.wav" },
      { title: "No Explanation", fileName: "9 No Explanation.wav" },
      { title: "Enough", fileName: "10 Enough.wav" },
      { title: "Not Yet", fileName: "11 Not Yet.wav" },
      { title: "Without Pause", fileName: "12 Without Pause.wav" },
      { title: "Golden Sound", fileName: "13 Golden Sound.wav" },
      { title: "Victory", fileName: "14 Victory.wav" },
      { title: "Ground Bass", fileName: "15 Ground Bass.wav" },
      { title: "Mass", fileName: "16 Mass.wav" },
      { title: "State Motion", fileName: "17 State Motion.wav" },
      { title: "Titan", fileName: "18 Titan.wav" },
      { title: "Wrath of Giants", fileName: "19 Wrath of Giants.wav" },
      { title: "First Beast", fileName: "20 First Beast.wav" },
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
    albumPreviewFileName: "strangefeeling.wav",
    description:
      "Experience Strange Feeling, a powerful twenty-track Solo Beats album packed with electronic energy, atmospheric melodies and unforgettable sound.",
    tracks: [
      { title: "Steel Venom", fileName: "01-steel-venom.wav" },
      { title: "Meltdown", fileName: "02-meltdown.wav" },
      { title: "Nickel Tempest", fileName: "03-nickel-tempest.wav" },
      { title: "Blade Runner", fileName: "04-blade-runner.wav" },
      { title: "Wrong Turn", fileName: "05-wrong-turn.wav" },
      { title: "Cold Exit", fileName: "06-cold-exit.wav" },
      { title: "Empty Throne", fileName: "07-empty-throne.wav" },
      { title: "Grey Ticket", fileName: "08-grey-ticket.wav" },
      { title: "Silent Empire", fileName: "09-silent-empire.wav" },
      { title: "Bad Intentions", fileName: "10-bad-intentions.wav" },
      { title: "Maximum Damage", fileName: "11-maximum-damage.wav" },
      { title: "Nothing to Lose", fileName: "12-nothing-to-lose.wav" },
      { title: "Too Late", fileName: "13-too-late.wav" },
      { title: "Out of Time", fileName: "14-out-of-time.wav" },
      { title: "Not Today", fileName: "15-not-today.wav" },
      { title: "Bad Memory", fileName: "16-bad-memory.wav" },
      { title: "Last Mistake", fileName: "17-last-mistake.wav" },
      { title: "Into the Dark", fileName: "18-into-the-dark.wav" },
      { title: "Between Worlds", fileName: "19-between-worlds.wav" },
      { title: "Strange Feeling", fileName: "20-strange-feeling.wav" },
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
    albumPreviewFileName: "Neon Lights-10.wav",
    description:
      "Experience Neon Lights, a ten-track Solo Beats album filled with energetic electronic rhythms, bright melodies and late-night atmosphere.",
    tracks: [
      { title: "Sexy Desert", fileName: "Sexy Desert-1.wav" },
      { title: "Right Now", fileName: "Right Now-2.wav" },
      { title: "Near Smile", fileName: "Near Smile-3.wav" },
      { title: "No Shop Loop", fileName: "No Shop Loop-4.wav" },
      { title: "Hot Wave", fileName: "Hot Wave-5.wav" },
      { title: "Late Time", fileName: "Late Time-6.wav" },
      { title: "Latino Theory", fileName: "Latino Theory-7.wav" },
      { title: "Dancing Mess", fileName: "Dancing Mess-8.wav" },
      { title: "Cold Train", fileName: "Cold Train-9.wav" },
      { title: "Neon Lights", fileName: "Neon Lights-10.wav" },
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
    albumPreviewFileName: "Mystery 4.wav",
    description:
      "Experience Mystery, a ten-track Solo Beats album filled with dark electronic melodies, cinematic atmosphere and powerful energy.",
    tracks: [
      { title: "Cool Destiny", fileName: "Cool Destiny 1.wav" },
      { title: "Feel Again", fileName: "Feel Again 2.wav" },
      { title: "Bad Option", fileName: "Bad Option 3.wav" },
      { title: "Mystery", fileName: "Mystery 4.wav" },
      { title: "Dark Night", fileName: "Dark Night 5.wav" },
      { title: "Pure Energy", fileName: "Pure Energy 6.wav" },
      { title: "Glowing", fileName: "Glowing 7.wav" },
      { title: "This Power", fileName: "This Power 8.wav" },
      { title: "Smiling Juice", fileName: "Smilling Juice 9.wav" },
      { title: "Find Ends", fileName: "Find Ends 10.wav" },
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
    albumPreviewFileName: "Ambient Winter.wav",
    description:
      "Experience Echoes of Power, a twenty-track Solo Beats album filled with powerful electronic energy, cinematic melodies and unforgettable atmosphere.",
    tracks: [
      { title: "Ambient Winter", fileName: "Ambient Winter.wav" },
      { title: "Chaos Power", fileName: "Chaos Power.wav" },
      { title: "Courage Of Joy", fileName: "Courage Of Joy.wav" },
      { title: "Crystal Code", fileName: "Crystal Code.wav" },
      { title: "Dark's Fire", fileName: "Dark's Fire.wav" },
      { title: "Defender Of Power", fileName: "Defender Of Power.wav" },
      { title: "Grace Of Beasts", fileName: "Grace Of Beasts.wav" },
      { title: "Home Of Hope", fileName: "Home Of Hope.wav" },
      { title: "Memory of Solitude", fileName: "Memory of Solitude.wav" },
      { title: "River Sage", fileName: "River Sage.wav" },
      { title: "Sea of Peace", fileName: "Sea of Peace.wav" },
      { title: "Silent Armies", fileName: "Silent Armies.wav" },
      { title: "Soul Smoke", fileName: "Soul Smoke .wav" },
      { title: "Summer's Bite", fileName: "Summer's Bite.wav" },
      { title: "The invisible", fileName: "The invisible.wav" },
      { title: "The Little Tune", fileName: "The Little Tune.wav" },
      { title: "Thunder's Fire", fileName: "Thunder's Fire.wav" },
      { title: "Tunnel Illusion", fileName: "Tunnel Illusion.wav" },
      { title: "Voyage of Desire", fileName: "Voyage of Desire.wav" },
      { title: "Wild People", fileName: "Wild People.wav" },
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
    albumPreviewFileName: "Neon Overdrive8.wav",
    description:
      "Experience Neon Overdrive, a ten-track Solo Beats album packed with futuristic complextro energy, cyber-powered bass, bright synths and high-speed electronic rhythms.",
    tracks: [
      { title: "Pulse Invaders", fileName: "Pulse Invaders1.wav" },
      { title: "Pixel Riot", fileName: "Pixel Riot2.wav" },
      { title: "Rhythm Nexus", fileName: "Rhythm Nexus3.wav" },
      { title: "Voltage Arena", fileName: "Voltage Arena4.wav" },
      { title: "Level Up", fileName: "Level Up5.wav" },
      { title: "Dance Protocol", fileName: "Dance Protocol6.wav" },
      { title: "Nightshift Energy", fileName: "Nightshift Energy7.wav" },
      { title: "Neon Overdrive", fileName: "Neon Overdrive8.wav" },
      { title: "Bass Crusaders", fileName: "Bass Crusaders9.wav" },
      { title: "Cyber Groove", fileName: "Cyber Groove10.wav" },
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
    albumPreviewFileName: "Unchained Energy.wav",
    description:
      "Experience Unchained Energy, a ten-track Solo Beats album filled with powerful electronic rhythms, cinematic atmosphere, explosive melodies and unstoppable energy.",
    tracks: [
      { title: "Break the Silence", fileName: "Break the Silence.wav" },
      { title: "Broken Frequency", fileName: "Broken Frequency.wav" },
      { title: "Chasing Shadows", fileName: "Chasing Shadows.wav" },
      { title: "Crashing Lights", fileName: "Crashing Lights.wav" },
      { title: "Fallen Sparks", fileName: "Fallen Sparks.wav" },
      { title: "Into the Fire", fileName: "Into the Fire.wav" },
      { title: "Rise of Motion", fileName: "Rise of Motion.wav" },
      { title: "Static Reflection", fileName: "Static Reflection.wav" },
      { title: "Storm of Echoes", fileName: "Storm of Echoes.wav" },
      { title: "Unchained Energy", fileName: "Unchained Energy.wav" },
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
    albumPreviewFileName: "Novafx5.wav",
    description:
      "Experience Novafx, a twelve-track Solo Beats album powered by futuristic complextro energy, glitch-driven synths, explosive bass and high-impact electronic rhythms.",
    tracks: [
      { title: "Glitch Spark", fileName: "Glitch Spark 1.wav" },
      { title: "Vyntriq", fileName: "Vyntriq2.wav" },
      { title: "Aerosync", fileName: "Aerosync3.wav" },
      { title: "Fractalord", fileName: "Fractalord4.wav" },
      { title: "Novafx", fileName: "Novafx5.wav" },
      { title: "Hyperstrata", fileName: "Hyperstrata 6.wav" },
      { title: "Zynkrush", fileName: "Zynkrush7.wav" },
      { title: "Pulse Reactor", fileName: "Pulse Reactor 8.wav" },
      { title: "Ecl1pz", fileName: "Ecl1pz9.wav" },
      { title: "Luxtron1c", fileName: "Luxtron1c 10.wav" },
      { title: "Hot Vibes", fileName: "Hot Vibes 11.wav" },
      { title: "Pump It Up", fileName: "Pump It Up.wav" },
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
    albumPreviewFileName: "Golden Love 10.wav",
    description:
      "Experience More Touch, a ten-track Solo Beats album filled with energetic electronic rhythms, bright melodies, arcade-inspired movement and uplifting atmosphere.",
    tracks: [
      { title: "Tea Desert", fileName: "Tea Desert 1.wav" },
      { title: "Cold Motion", fileName: "Cold Motion 2.wav" },
      { title: "Wild Out Here", fileName: "Wild Out Here 3.wav" },
      { title: "Royal Hall", fileName: "Royal Hall 4.wav" },
      { title: "Energetic Light", fileName: "Energetic Light 5.wav" },
      { title: "Break Flow", fileName: "Break Flow 6.wav" },
      { title: "Shuffle", fileName: "Shuffle 7.wav" },
      { title: "Funny Wish", fileName: "Funny Wish 8.wav" },
      { title: "Is This Arcade", fileName: "Is This Arcade 9.wav" },
      { title: "Golden Love", fileName: "Golden Love 10.wav" },
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
    albumPreviewFileName: "Summer Blast 1.wav",
    description:
      "Experience Summer Blast, a ten-track Solo Beats album filled with warm electronic energy, uplifting rhythms, bright melodies and vibrant summer atmosphere.",
    tracks: [
      { title: "Summer Blast", fileName: "Summer Blast 1.wav" },
      { title: "Troubles", fileName: "Troubles-2.wav" },
      { title: "Upbeat Heroes", fileName: "Upbeat Heroes-3.wav" },
      { title: "No Flavors", fileName: "No Flavors-4.wav" },
      { title: "Safe Tears", fileName: "Safe Tears-5.wav" },
      { title: "Last Heaven", fileName: "Last Heaven-6.wav" },
      { title: "Romantic Pride", fileName: "Romantic Pride-7.wav" },
      { title: "Babe Midnight", fileName: "Babe Midnight-8.wav" },
      { title: "Night Solo", fileName: "Night Solo-9.wav" },
      { title: "Long Gem", fileName: "Long Gem-10.wav" },
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
    albumPreviewFileName: "Courageous Time 1.wav",
    description:
      "Experience Invincible, a ten-track Solo Beats album driven by bold electronic rhythms, confident melodies, powerful energy and a futuristic atmosphere.",
    tracks: [
      { title: "Courageous Time", fileName: "Courageous Time 1.wav" },
      { title: "Free Hugs", fileName: "Free Hugs2.wav" },
      { title: "No Mercy", fileName: "No Mercy3.wav" },
      { title: "Bad Option", fileName: "Bad Option 4.wav" },
      { title: "Open Light", fileName: "Open Light5.wav" },
      { title: "Powerful Swag", fileName: "Powerful Swag6.wav" },
      { title: "Time Of Power", fileName: "Time Of Power7.wav" },
      { title: "Green Feelings", fileName: "Green Feelings8.wav" },
      { title: "Silver Madness", fileName: "Silver Madness9.wav" },
      { title: "Attractive Touch", fileName: "Attractive Touch 10.wav" },
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
    albumPreviewFileName: "Better Lies.wav",
    description:
      "Experience Tasty Smile, a ten-track Solo Beats album filled with emotional electronic melodies, reflective atmosphere, warm energy and memorable rhythms.",
    tracks: [
      { title: "Better Lies", fileName: "Better Lies.wav" },
      { title: "Cold Memories", fileName: "Cold Memories.wav" },
      { title: "Next Scars", fileName: "Next Scars.wav" },
      { title: "No Darkness", fileName: "No Darkness.wav" },
      { title: "Not Up", fileName: "Not Up.wav" },
      { title: "Old Piano", fileName: "Old Piano.wav" },
      { title: "Only Mercy", fileName: "Only Mercy.wav" },
      { title: "Pure Jam", fileName: "Pure Jam.wav" },
      { title: "Soft Hugs", fileName: "Soft Hugs.wav" },
      { title: "Tough Chance", fileName: "Tough Chance.wav" },
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
    albumPreviewFileName: "Breaking Time.wav",
    description:
      "Experience Beaming Dance, a ten-track Solo Beats album filled with vibrant electronic rhythms, colorful melodies, uplifting movement and energetic dance atmosphere.",
    tracks: [
      { title: "Breaking Time", fileName: "Breaking Time.wav" },
      { title: "Cold Angel", fileName: "Cold Angel.wav" },
      { title: "Deep Skies", fileName: "Deep Skies.wav" },
      { title: "Easy Light", fileName: "Easy Light.wav" },
      { title: "Epic Cue", fileName: "Epic Cue.wav" },
      { title: "Hot Heroes", fileName: "Hot Heroes (2).wav" },
      { title: "Hot Whoop", fileName: "Hot Whoop.wav" },
      { title: "My Happy Time", fileName: "My Happy Time.wav" },
      { title: "Sad Vibrations", fileName: "Sad Vibrations.wav" },
      { title: "Ten Energy", fileName: "Ten Energy.wav" },
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
    albumPreviewFileName: "Inspiration-wav.wav",
    description:
      "Experience Cygnus X, a twenty-track Solo Beats album filled with futuristic electronic sound, cosmic atmosphere, powerful rhythms and evolving cinematic energy.",
    tracks: [
      { title: "Inspiration", fileName: "Inspiration-wav.wav" },
      { title: "Particle Storm", fileName: "particle Storm-wav.wav" },
      { title: "Memory Leak", fileName: "Memory Leak-wav.wav" },
      { title: "Disruptor", fileName: "Disruptor-wav.wav" },
      { title: "Parallax", fileName: "Parallax-wav.wav" },
      { title: "Viral Decay", fileName: "Viral Decay-wav.wav" },
      { title: "Reboot", fileName: "Reboot-wav.wav" },
      { title: "Nexus", fileName: "Nexus-wav.wav" },
      { title: "Aurora Ignite", fileName: "Aurora Ignite-wav.wav" },
      { title: "Quasar Flux", fileName: "Quasar Flux-wav.wav" },
      { title: "Axiom", fileName: "Axiom-.wav" },
      { title: "Displace", fileName: "Displace-wav.wav" },
      { title: "Dark Force", fileName: "Dark Force-wav.wav" },
      { title: "Turbulence", fileName: "Turbulence-wav.wav" },
      { title: "Sunder", fileName: "Sunder-wav.wav" },
      { title: "Jolt", fileName: "Jolt-wav.wav" },
      { title: "Neptune", fileName: "Neptune-wav.wav" },
      { title: "Party Cheer", fileName: "Party Cheer-wav.wav" },
      { title: "Pentakill", fileName: "Pentakill-wav.wav" },
      { title: "Catalyst", fileName: "Catalyst-wav.wav" },
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
