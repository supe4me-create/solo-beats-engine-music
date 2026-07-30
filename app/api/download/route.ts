import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import {
  adminBucket,
  adminDb,
  firebaseAdminApp,
} from "../../../lib/firebaseAdmin";

type ItemType = "album" | "track";

type PurchaseItem = {
  itemType?: ItemType | null;
  itemId?: string | null;
  name?: string;
  sku?: string | null;
};

type DownloadFile = {
  storagePath: string;
  downloadName: string;
  title: string;
};

type DownloadRequestBody = {
  orderId?: unknown;
  captureId?: unknown;
  itemId?: unknown;
  itemType?: unknown;
  testMode?: unknown;
  premiumDownload?: unknown;
};

type TrackRegistration = {
  fileName: string;
  title: string;
};

const ALBUM_DOWNLOAD_FILES: Record<string, DownloadFile> = {
  reckoning: {
    storagePath: "Reckoning.zip",
    downloadName: "Solo-Beats-Reckoning-Full-Album.zip",
    title: "Reckoning — Full Album",
  },
  blur: {
    storagePath: "Blur.zip",
    downloadName: "Solo-Beats-Blur-Full-Album.zip",
    title: "Blur — Full Album",
  },
  invincible: {
    storagePath: "Invicible.zip",
    downloadName: "Solo-Beats-Invincible-Full-Album.zip",
    title: "Invincible — Full Album",
  },
  "tasty-smile": {
    storagePath: "TastySmile.zip",
    downloadName: "Solo-Beats-Tasty-Smile-Full-Album.zip",
    title: "Tasty Smile — Full Album",
  },
  "beaming-dance": {
    storagePath: "BeamingDance.zip",
    downloadName: "Solo-Beats-Beaming-Dance-Full-Album.zip",
    title: "Beaming Dance — Full Album",
  },
  "cant-miss-it": {
    storagePath: "CantMissIt.zip",
    downloadName: "Solo-Beats-Cant-Miss-It-Full-Album.zip",
    title: "Can't Miss It — Full Album",
  },
  "full-speed": {
    storagePath: "FullSpeed.zip",
    downloadName: "Solo-Beats-Full-Speed-Full-Album.zip",
    title: "Full Speed — Full Album",
  },
  "night-terror": {
    storagePath: "NightTerror.zip",
    downloadName: "Solo-Beats-Night-Terror-Full-Album.zip",
    title: "Night Terror — Full Album",
  },
  reboot: {
    storagePath: "Reboot.zip",
    downloadName: "Solo-Beats-Reboot-Full-Album.zip",
    title: "Reboot — Full Album",
  },
  "strange-feeling": {
    storagePath: "StrangeFeeling.zip",
    downloadName: "Solo-Beats-Strange-Feeling-Full-Album.zip",
    title: "Strange Feeling — Full Album",
  },
  mystery: {
    storagePath: "Mystery.zip",
    downloadName: "Solo-Beats-Mystery-Full-Album.zip",
    title: "Mystery — Full Album",
  },
  "neon-lights": {
    storagePath: "Neonlights.zip",
    downloadName: "Solo-Beats-Neon-Lights-Full-Album.zip",
    title: "Neon Lights — Full Album",
  },
  "echoes-of-power": {
    storagePath: "EchoesOf Power.zip",
    downloadName: "Solo-Beats-Echoes-Of-Power-Full-Album.zip",
    title: "Echoes Of Power — Full Album",
  },
  "neon-overdrive": {
    storagePath: "NeonOverdrive.zip",
    downloadName: "Solo-Beats-Neon-Overdrive-Full-Album.zip",
    title: "Neon Overdrive — Full Album",
  },
  "unchained-energy": {
    storagePath: "Unchained-Energy.zip",
    downloadName: "Solo-Beats-Unchained-Energy-Full-Album.zip",
    title: "Unchained Energy — Full Album",
  },
  novafx: {
    storagePath: "Novafx.zip",
    downloadName: "Solo-Beats-Novafx-Full-Album.zip",
    title: "Novafx — Full Album",
  },
  "more-touch": {
    storagePath: "MoreTouch.zip",
    downloadName: "Solo-Beats-More-Touch-Full-Album.zip",
    title: "More Touch — Full Album",
  },
  "summer-blast": {
    storagePath: "SummerBlast.zip",
    downloadName: "Solo-Beats-Summer-Blast-Full-Album.zip",
    title: "Summer Blast — Full Album",
  },
  "cygnus-x": {
    storagePath: "CygnusX.zip",
    downloadName: "Solo-Beats-Cygnus-X-Full-Album.zip",
    title: "Cygnus X — Full Album",
  },

};

function makeSafeDownloadName(
  trackNumber: number,
  title: string,
  sourceFileName: string
): string {
  const safeTitle = title
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

  const extensionMatch = sourceFileName.match(/(\.[a-z0-9]+)$/i);
  const extension = extensionMatch?.[1]?.toLowerCase() || ".wav";

  return `${String(trackNumber).padStart(2, "0")}-${safeTitle}${extension}`;
}

function registerTracks(
  albumId: string,
  tracks: TrackRegistration[],
  storageFolder = `tracks/${albumId}`
): Record<string, DownloadFile> {
  return Object.fromEntries(
    tracks.map((track, index) => {
      const trackNumber = index + 1;
      const itemId = `${albumId}-${String(trackNumber).padStart(2, "0")}`;

      return [
        itemId,
        {
          storagePath: `${storageFolder}/${track.fileName}`,
          downloadName: makeSafeDownloadName(
            trackNumber,
            track.title,
            track.fileName
          ),
          title: track.title,
        },
      ];
    })
  );
}

const TRACK_DOWNLOAD_FILES: Record<string, DownloadFile> = {
  ...registerTracks("reckoning", [
    { fileName: "1 Never Broken.wav", title: "Never Broken" },
    { fileName: "2 Cold Resolve.wav", title: "Cold Resolve" },
    { fileName: "3 Last Warning.wav", title: "Last Warning" },
    { fileName: "4 Relentless.wav", title: "Relentless" },
    { fileName: "5 Silent War.wav", title: "Silent War" },
    { fileName: "6 Wake Up.wav", title: "Wake Up" },
    { fileName: "7 Born to Win.wav", title: "Born to Win" },
    { fileName: "8 World on Fire.wav", title: "World on Fire" },
    { fileName: "9 Superhuman.wav", title: "Superhuman" },
    { fileName: "10 Last Breath.wav", title: "Last Breath" },
    { fileName: "11 Defiance.wav", title: "Defiance" },
    { fileName: "12 Reckoning.wav", title: "Reckoning" },
    { fileName: "13 Dark Rainbow.wav", title: "Dark Rainbow" },
    { fileName: "14 Dangerous.wav", title: "Dangerous" },
    { fileName: "15 Ghosts Don't Sleep.wav", title: "Ghosts Don't Sleep" },
    { fileName: "16 Before I Fade.wav", title: "Before I Fade" },
    { fileName: "17 Red Moon.wav", title: "Red Moon" },
    { fileName: "18 Swords Play.wav", title: "Swords Play" },
    { fileName: "19 Last Flame.wav", title: "Last Flame" },
    { fileName: "20 Thunder Rise.wav", title: "Thunder Rise" },
  ]),

  ...registerTracks(
    "blur",
    [
      { fileName: "Bunny Hops.mp3", title: "Bunny Hops" },
      { fileName: "Classic Cadence.mp3", title: "Classic Cadence" },
      { fileName: "Cryptic Chords.mp3", title: "Cryptic Chords" },
      { fileName: "Drop It Tonight.mp3", title: "Drop It Tonight" },
      { fileName: "Dynamic Duets.mp3", title: "Dynamic Duets" },
      { fileName: "Glacial Grooves.mp3", title: "Glacial Grooves" },
      { fileName: "Laughter Lines.mp3", title: "Laughter Lines" },
      { fileName: "Limelight.mp3", title: "Limelight" },
      { fileName: "Mind Games.mp3", title: "Mind Games" },
      { fileName: "Mystic Paradox.mp3", title: "Mystic Paradox" },
      { fileName: "Pixel Dust Tunes.mp3", title: "Pixel Dust Tunes" },
      { fileName: "Riff Riders.mp3", title: "Riff Riders" },
      { fileName: "Shadow Of Silence.mp3", title: "Shadow Of Silence" },
      { fileName: "Silly Moon.mp3", title: "Silly Moon" },
      { fileName: "Smooth Synth.mp3", title: "Smooth Synth" },
      { fileName: "Velvet Nocturne.mp3", title: "Velvet Nocturne" },
      { fileName: "Visionary Vibes.mp3", title: "Visionary Vibes" },
      { fileName: "Witty Waves.mp3", title: "Witty Waves" },
    ],
    "albums/blur/tracks"
  ),

  ...registerTracks(
    "invincible",
    [
      { fileName: "Courageous Time 1.wav", title: "Courageous Time" },
      { fileName: "Free Hugs2.wav", title: "Free Hugs" },
      { fileName: "No Mercy3.wav", title: "No Mercy" },
      { fileName: "Bad Option 4.wav", title: "Bad Option" },
      { fileName: "Open Light5.wav", title: "Open Light" },
      { fileName: "Powerful Swag6.wav", title: "Powerful Swag" },
      { fileName: "Time Of Power7.wav", title: "Time Of Power" },
      { fileName: "Green Feelings8.wav", title: "Green Feelings" },
      { fileName: "Silver Madness9.wav", title: "Silver Madness" },
      { fileName: "Attractive Touch 10.wav", title: "Attractive Touch" },
    ],
    "tracks/invincible"
  ),

  ...registerTracks(
    "tasty-smile",
    [
      { fileName: "Better Lies.wav", title: "Better Lies" },
      { fileName: "Cold Memories.wav", title: "Cold Memories" },
      { fileName: "Next Scars.wav", title: "Next Scars" },
      { fileName: "No Darkness.wav", title: "No Darkness" },
      { fileName: "Not Up.wav", title: "Not Up" },
      { fileName: "Old Piano.wav", title: "Old Piano" },
      { fileName: "Only Mercy.wav", title: "Only Mercy" },
      { fileName: "Pure Jam.wav", title: "Pure Jam" },
      { fileName: "Soft Hugs.wav", title: "Soft Hugs" },
      { fileName: "Tough Chance.wav", title: "Tough Chance" },
    ],
    "tracks/tasty-smile"
  ),

  ...registerTracks(
    "beaming-dance",
    [
      { fileName: "Breaking Time.wav", title: "Breaking Time" },
      { fileName: "Cold Angel.wav", title: "Cold Angel" },
      { fileName: "Deep Skies.wav", title: "Deep Skies" },
      { fileName: "Easy Light.wav", title: "Easy Light" },
      { fileName: "Epic Cue.wav", title: "Epic Cue" },
      { fileName: "Hot Heroes (2).wav", title: "Hot Heroes" },
      { fileName: "Hot Whoop.wav", title: "Hot Whoop" },
      { fileName: "My Happy Time.wav", title: "My Happy Time" },
      { fileName: "Sad Vibrations.wav", title: "Sad Vibrations" },
      { fileName: "Ten Energy.wav", title: "Ten Energy" },
    ],
    "tracks/beaming-dance"
  ),

  ...registerTracks(
    "cant-miss-it",
    [
      { fileName: "Bad wolf-9.mp3", title: "Bad Wolf" },
      { fileName: "Bullet bites1.mp3", title: "Bullet Bites" },
      { fileName: "Death of roses3.mp3", title: "Death of Roses" },
      { fileName: "Double trouble8.mp3", title: "Double Trouble" },
      { fileName: "Dream big4.mp3", title: "Dream Big" },
      { fileName: "Evolution 10.mp3", title: "Evolution" },
      { fileName: "Fight and flight5 (2).mp3", title: "Fight and Flight" },
      { fileName: "Fluke7 (1).mp3", title: "Fluke" },
      { fileName: "Focus2.mp3", title: "Focus" },
      { fileName: "No basis6 (3).mp3", title: "No Basis" },
    ],
    "tracks/cant-miss-it"
  ),

  ...registerTracks(
    "full-speed",
    [
      { fileName: "1 Drop Fever.wav", title: "Drop Fever" },
      { fileName: "2 Heavy Aura.wav", title: "Heavy Aura" },
      { fileName: "3 Red Night.wav", title: "Red Night" },
      { fileName: "4 Floor Shake.wav", title: "Floor Shake" },
      { fileName: "5 Motion Blur.wav", title: "Motion Blur" },
      { fileName: "6 Cut Access.wav", title: "Cut Access" },
      { fileName: "7 Locked Out.wav", title: "Locked Out" },
      { fileName: "8 Dead Line.wav", title: "Dead Line" },
      { fileName: "9 Still Standing.wav", title: "Still Standing" },
      { fileName: "10 Stay Cold.wav", title: "Stay Cold" },
      { fileName: "11 Chain Cut.wav", title: "Chain Cut" },
      { fileName: "12 Halt.wav", title: "Halt" },
      { fileName: "13 Lock Trigger.wav", title: "Lock Trigger" },
      { fileName: "14 Hard Sever.wav", title: "Hard Sever" },
      { fileName: "15 Exile.wav", title: "Exile" },
      { fileName: "16 Full Speed .wav", title: "Full Speed" },
      { fileName: "17 Stay Winning.wav", title: "Stay Winning" },
      { fileName: "18 Moon Shift .wav", title: "Moon Shift" },
      { fileName: "19 Calm Fire.wav", title: "Calm Fire" },
      { fileName: "20 Light It Up.wav", title: "Light It Up" },
    ],
    "tracks/full-speed"
  ),

  ...registerTracks(
    "night-terror",
    [
      { fileName: "1 Vagabond Tune.wav", title: "Vagabond Tune" },
      { fileName: "2 Paper Bloom.wav", title: "Paper Bloom" },
      { fileName: "3 Solar Kiss.wav", title: "Solar Kiss" },
      { fileName: "4 Cloud Bloom.wav", title: "Cloud Bloom" },
      { fileName: "5 First Frost.wav", title: "First Frost" },
      { fileName: "6 Glowstream.wav", title: "Glowstream" },
      { fileName: "7 Stillpoint.wav", title: "Stillpoint" },
      { fileName: "8 Deepdrift.wav", title: "Deepdrift" },
      { fileName: "9 Cloudsong.wav", title: "Cloudsong" },
      { fileName: "10 Everdark.wav", title: "Everdark" },
      { fileName: "11 Ghostveil.wav", title: "Ghostveil" },
      { fileName: "12 Dreamshard.wav", title: "Dreamshard" },
      { fileName: "13 Raindrop Soul.wav", title: "Raindrop Soul" },
      { fileName: "14 Glass Sea.wav", title: "Glass Sea" },
      { fileName: "15 Silent Core.wav", title: "Silent Core" },
      { fileName: "16 Starfall.wav", title: "Starfall" },
      { fileName: "17 Wild Scars.wav", title: "Wild Scars" },
      { fileName: "18 Fear Strike.wav", title: "Fear Strike" },
      { fileName: "19 Night Terror.wav", title: "Night Terror" },
    ],
    "tracks/night-terror"
  ),

  ...registerTracks(
    "reboot",
    [
      { fileName: "1 Volt Rush.wav", title: "Volt Rush" },
      { fileName: "2 No Hero.wav", title: "No Hero" },
      { fileName: "3 Hot Bullet.wav", title: "Hot Bullet" },
      { fileName: "4 Break the Floor.wav", title: "Break the Floor" },
      { fileName: "5 Lonely Beat.wav", title: "Lonely Beat" },
      { fileName: "6 Reboot.wav", title: "Reboot" },
      { fileName: "7 Pure Love.wav", title: "Pure Love" },
      { fileName: "8 Hook Machine.wav", title: "Hook Machine" },
      { fileName: "9 No Explanation.wav", title: "No Explanation" },
      { fileName: "10 Enough.wav", title: "Enough" },
      { fileName: "11 Not Yet.wav", title: "Not Yet" },
      { fileName: "12 Without Pause.wav", title: "Without Pause" },
      { fileName: "13 Golden Sound.wav", title: "Golden Sound" },
      { fileName: "14 Victory.wav", title: "Victory" },
      { fileName: "15 Ground Bass.wav", title: "Ground Bass" },
      { fileName: "16 Mass.wav", title: "Mass" },
      { fileName: "17 State Motion.wav", title: "State Motion" },
      { fileName: "18 Titan.wav", title: "Titan" },
      { fileName: "19 Wrath of Giants.wav", title: "Wrath of Giants" },
      { fileName: "20 First Beast.wav", title: "First Beast" },
    ],
    "tracks/reboot"
  ),

  ...registerTracks("strange-feeling", [
    { fileName: "1 Steel Venom.wav", title: "Steel Venom" },
    { fileName: "2 Meltdown.wav", title: "Meltdown" },
    { fileName: "3 Nickel Tempest.wav", title: "Nickel Tempest" },
    { fileName: "4 Blade Runner.wav", title: "Blade Runner" },
    { fileName: "5 Wrong Turn.wav", title: "Wrong Turn" },
    { fileName: "6 Cold Exit.wav", title: "Cold Exit" },
    { fileName: "7 Empty Throne.wav", title: "Empty Throne" },
    { fileName: "8 Grey Ticket.wav", title: "Grey Ticket" },
    { fileName: "9 Silent Empire.wav", title: "Silent Empire" },
    { fileName: "10 Bad Intentions.wav", title: "Bad Intentions" },
    { fileName: "11 Maximum Damage.wav", title: "Maximum Damage" },
    { fileName: "12 Nothing to Lose.wav", title: "Nothing to Lose" },
    { fileName: "13 Too Late.wav", title: "Too Late" },
    { fileName: "14 Out of Time.wav", title: "Out of Time" },
    { fileName: "15 Not Today.wav", title: "Not Today" },
    { fileName: "16 Bad Memory.wav", title: "Bad Memory" },
    { fileName: "17 Last Mistake.wav", title: "Last Mistake" },
    { fileName: "18 Into the Dark.wav", title: "Into the Dark" },
    { fileName: "19 Between Worlds.wav", title: "Between Worlds" },
    { fileName: "20 Strange Feeling.wav", title: "Strange Feeling" },
  ]),

  ...registerTracks("neon-lights", [
    { fileName: "Sexy Desert-1.wav", title: "Sexy Desert" },
    { fileName: "Right Now-2.wav", title: "Right Now" },
    { fileName: "Near Smile-3.wav", title: "Near Smile" },
    { fileName: "No Shop Loop-4.wav", title: "No Shop Loop" },
    { fileName: "Hot Wave-5.wav", title: "Hot Wave" },
    { fileName: "Late Time-6.wav", title: "Late Time" },
    { fileName: "Latino Theory-7.wav", title: "Latino Theory" },
    { fileName: "Dancing Mess-8.wav", title: "Dancing Mess" },
    { fileName: "Cold Train-9.wav", title: "Cold Train" },
    { fileName: "Neon Lights-10.wav", title: "Neon Lights" },
  ]),

  ...registerTracks("mystery", [
    { fileName: "Cool Destiny 1.wav", title: "Cool Destiny" },
    { fileName: "Feel Again 2.wav", title: "Feel Again" },
    { fileName: "Bad Option 3.wav", title: "Bad Option" },
    { fileName: "Mystery 4.wav", title: "Mystery" },
    { fileName: "Dark Night 5.wav", title: "Dark Night" },
    { fileName: "Pure Energy 6.wav", title: "Pure Energy" },
    { fileName: "Glowing 7.wav", title: "Glowing" },
    { fileName: "This Power 8.wav", title: "This Power" },
    { fileName: "Smilling Juice 9.wav", title: "Smiling Juice" },
    { fileName: "Find Ends 10.wav", title: "Find Ends" },
  ]),

  ...registerTracks("echoes-of-power", [
    { fileName: "Ambient Winter.wav", title: "Ambient Winter" },
    { fileName: "Chaos Power.wav", title: "Chaos Power" },
    { fileName: "Courage Of Joy.wav", title: "Courage Of Joy" },
    { fileName: "Crystal Code.wav", title: "Crystal Code" },
    { fileName: "Dark's Fire.wav", title: "Dark's Fire" },
    { fileName: "Defender Of Power.wav", title: "Defender Of Power" },
    { fileName: "Grace Of Beasts.wav", title: "Grace Of Beasts" },
    { fileName: "Home Of Hope.wav", title: "Home Of Hope" },
    { fileName: "Memory of Solitude.wav", title: "Memory of Solitude" },
    { fileName: "River Sage.wav", title: "River Sage" },
    { fileName: "Sea of Peace.wav", title: "Sea of Peace" },
    { fileName: "Silent Armies.wav", title: "Silent Armies" },
    { fileName: "Soul Smoke .wav", title: "Soul Smoke" },
    { fileName: "Summer's Bite.wav", title: "Summer's Bite" },
    { fileName: "The invisible.wav", title: "The invisible" },
    { fileName: "The Little Tune.wav", title: "The Little Tune" },
    { fileName: "Thunder's Fire.wav", title: "Thunder's Fire" },
    { fileName: "Tunnel Illusion.wav", title: "Tunnel Illusion" },
    { fileName: "Voyage of Desire.wav", title: "Voyage of Desire" },
    { fileName: "Wild People.wav", title: "Wild People" },
  ]),

  ...registerTracks("neon-overdrive", [
    { fileName: "Pulse Invaders1.wav", title: "Pulse Invaders" },
    { fileName: "Pixel Riot2.wav", title: "Pixel Riot" },
    { fileName: "Rhythm Nexus3.wav", title: "Rhythm Nexus" },
    { fileName: "Voltage Arena4.wav", title: "Voltage Arena" },
    { fileName: "Level Up5.wav", title: "Level Up" },
    { fileName: "Dance Protocol6.wav", title: "Dance Protocol" },
    { fileName: "Nightshift Energy7.wav", title: "Nightshift Energy" },
    { fileName: "Neon Overdrive8.wav", title: "Neon Overdrive" },
    { fileName: "Bass Crusaders9.wav", title: "Bass Crusaders" },
    { fileName: "Cyber Groove10.wav", title: "Cyber Groove" },
  ]),

  ...registerTracks("unchained-energy", [
    { fileName: "Break the Silence.wav", title: "Break the Silence" },
    { fileName: "Broken Frequency.wav", title: "Broken Frequency" },
    { fileName: "Chasing Shadows.wav", title: "Chasing Shadows" },
    { fileName: "Crashing Lights.wav", title: "Crashing Lights" },
    { fileName: "Fallen Sparks.wav", title: "Fallen Sparks" },
    { fileName: "Into the Fire.wav", title: "Into the Fire" },
    { fileName: "Rise of Motion.wav", title: "Rise of Motion" },
    { fileName: "Static Reflection.wav", title: "Static Reflection" },
    { fileName: "Storm of Echoes.wav", title: "Storm of Echoes" },
    { fileName: "Unchained Energy.wav", title: "Unchained Energy" },
  ]),

  ...registerTracks("novafx", [
    { fileName: "Glitch Spark 1.wav", title: "Glitch Spark" },
    { fileName: "Vyntriq2.wav", title: "Vyntriq" },
    { fileName: "Aerosync3.wav", title: "Aerosync" },
    { fileName: "Fractalord4.wav", title: "Fractalord" },
    { fileName: "Novafx5.wav", title: "Novafx" },
    { fileName: "Hyperstrata 6.wav", title: "Hyperstrata" },
    { fileName: "Zynkrush7.wav", title: "Zynkrush" },
    { fileName: "Pulse Reactor 8.wav", title: "Pulse Reactor" },
    { fileName: "Ecl1pz9.wav", title: "Ecl1pz" },
    { fileName: "Luxtron1c 10.wav", title: "Luxtron1c" },
    { fileName: "Hot Vibes 11.wav", title: "Hot Vibes" },
    { fileName: "Pump It Up.wav", title: "Pump It Up" },
  ]),

  ...registerTracks("more-touch", [
    { fileName: "Tea Desert 1.wav", title: "Tea Desert" },
    { fileName: "Cold Motion 2.wav", title: "Cold Motion" },
    { fileName: "Wild Out Here 3.wav", title: "Wild Out Here" },
    { fileName: "Royal Hall 4.wav", title: "Royal Hall" },
    { fileName: "Energetic Light 5.wav", title: "Energetic Light" },
    { fileName: "Break Flow 6.wav", title: "Break Flow" },
    { fileName: "Shuffle 7.wav", title: "Shuffle" },
    { fileName: "Funny Wish 8.wav", title: "Funny Wish" },
    { fileName: "Is This Arcade 9.wav", title: "Is This Arcade" },
    { fileName: "Golden Love 10.wav", title: "Golden Love" },
  ]),

  ...registerTracks("summer-blast", [
    { fileName: "Summer Blast 1.wav", title: "Summer Blast" },
    { fileName: "Troubles-2.wav", title: "Troubles" },
    { fileName: "Upbeat Heroes-3.wav", title: "Upbeat Heroes" },
    { fileName: "No Flavors-4.wav", title: "No Flavors" },
    { fileName: "Safe Tears-5.wav", title: "Safe Tears" },
    { fileName: "Last Heaven-6.wav", title: "Last Heaven" },
    { fileName: "Romantic Pride-7.wav", title: "Romantic Pride" },
    { fileName: "Babe Midnight-8.wav", title: "Babe Midnight" },
    { fileName: "Night Solo-9.wav", title: "Night Solo" },
    { fileName: "Long Gem-10.wav", title: "Long Gem" },
  ]),
  ...registerTracks("cygnus-x", [
    { fileName: "Inspiration-wav.wav", title: "Inspiration" },
    { fileName: "particle Storm-wav.wav", title: "Particle Storm" },
    { fileName: "Memory Leak-wav.wav", title: "Memory Leak" },
    { fileName: "Disruptor-wav.wav", title: "Disruptor" },
    { fileName: "Parallax-wav.wav", title: "Parallax" },
    { fileName: "Viral Decay-wav.wav", title: "Viral Decay" },
    { fileName: "Reboot-wav.wav", title: "Reboot" },
    { fileName: "Nexus-wav.wav", title: "Nexus" },
    { fileName: "Aurora Ignite-wav.wav", title: "Aurora Ignite" },
    { fileName: "Quasar Flux-wav.wav", title: "Quasar Flux" },
    { fileName: "Axiom-.wav", title: "Axiom" },
    { fileName: "Displace-wav.wav", title: "Displace" },
    { fileName: "Dark Force-wav.wav", title: "Dark Force" },
    { fileName: "Turbulence-wav.wav", title: "Turbulence" },
    { fileName: "Sunder-wav.wav", title: "Sunder" },
    { fileName: "Jolt-wav.wav", title: "Jolt" },
    { fileName: "Neptune-wav.wav", title: "Neptune" },
    { fileName: "Party Cheer-wav.wav", title: "Party Cheer" },
    { fileName: "Pentakill-wav.wav", title: "Pentakill" },
    { fileName: "Catalyst-wav.wav", title: "Catalyst" },
  ]),
};


const PREMIUM_MONTHLY_TRACK_LIMIT = 10;

const PREMIUM_ALBUM_IDS = new Set([
  "reckoning",
  "full-speed",
  "night-terror",
  "reboot",
  "novafx",
]);

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function getAlbumIdFromTrackId(trackId: string): string | null {
  for (const albumId of PREMIUM_ALBUM_IDS) {
    if (trackId.startsWith(`${albumId}-`)) {
      return albumId;
    }
  }

  return null;
}

function getPremiumCycleKey(
  startTime: string | undefined,
  nextBillingTime: string | undefined
): string {
  const now = new Date();

  if (nextBillingTime) {
    const nextBilling = new Date(nextBillingTime);

    if (!Number.isNaN(nextBilling.getTime())) {
      const cycleStart = new Date(nextBilling);
      cycleStart.setUTCMonth(cycleStart.getUTCMonth() - 1);

      if (now >= cycleStart && now < nextBilling) {
        return cycleStart.toISOString().slice(0, 10);
      }
    }
  }

  if (startTime) {
    const started = new Date(startTime);

    if (!Number.isNaN(started.getTime())) {
      const cycleStart = new Date(started);

      while (true) {
        const next = new Date(cycleStart);
        next.setUTCMonth(next.getUTCMonth() + 1);

        if (now < next) {
          return cycleStart.toISOString().slice(0, 10);
        }

        cycleStart.setUTCMonth(cycleStart.getUTCMonth() + 1);
      }
    }
  }

  return now.toISOString().slice(0, 7);
}

async function handlePremiumTrackDownload(
  request: Request,
  itemId: string
) {
  const idToken = getBearerToken(request);

  if (!idToken) {
    return NextResponse.json(
      {
        success: false,
        error:
          "You must be signed in to use Premium downloads.",
      },
      { status: 401 }
    );
  }

  const decodedToken = await getAuth(
    firebaseAdminApp
  ).verifyIdToken(idToken);

  const subscriptionRef = adminDb
    .collection("premiumSubscriptions")
    .doc(decodedToken.uid);

  const subscriptionSnapshot =
    await subscriptionRef.get();

  if (!subscriptionSnapshot.exists) {
    return NextResponse.json(
      {
        success: false,
        error:
          "An active SOLO BEATS PREMIUM membership is required.",
      },
      { status: 403 }
    );
  }

  const subscription =
    subscriptionSnapshot.data() || {};

  if (
    subscription.premiumActive !== true ||
    subscription.status !== "ACTIVE"
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Your SOLO BEATS PREMIUM membership is not active.",
      },
      { status: 403 }
    );
  }

  const albumId = getAlbumIdFromTrackId(itemId);

  if (!albumId || !PREMIUM_ALBUM_IDS.has(albumId)) {
    return NextResponse.json(
      {
        success: false,
        error:
          "This track is not available for Premium monthly downloads.",
      },
      { status: 403 }
    );
  }

  const downloadFile = TRACK_DOWNLOAD_FILES[itemId];

  if (!downloadFile) {
    return NextResponse.json(
      {
        success: false,
        error:
          "The requested Premium track file has not been registered yet.",
      },
      { status: 404 }
    );
  }

  const {
    safeDownloadName,
    downloadUrl,
    expiresAt,
  } = await generateSignedDownload("track", itemId);

  const cycleKey = getPremiumCycleKey(
    typeof subscription.startTime === "string"
      ? subscription.startTime
      : undefined,
    typeof subscription.nextBillingTime === "string"
      ? subscription.nextBillingTime
      : undefined
  );

  const usageRef = adminDb
    .collection("premiumDownloadUsage")
    .doc(`${decodedToken.uid}_${cycleKey}`);

  const result = await adminDb.runTransaction(
    async (transaction) => {
      const usageSnapshot =
        await transaction.get(usageRef);

      const usage = usageSnapshot.data() || {};
      const selectedTrackIds = Array.isArray(
        usage.selectedTrackIds
      )
        ? (usage.selectedTrackIds as string[])
        : [];

      const alreadySelected =
        selectedTrackIds.includes(itemId);

      const used = Number.isFinite(
        usage.downloadsUsed
      )
        ? Number(usage.downloadsUsed)
        : selectedTrackIds.length;

      if (
        !alreadySelected &&
        used >= PREMIUM_MONTHLY_TRACK_LIMIT
      ) {
        return {
          allowed: false as const,
          alreadySelected: false,
          used,
        };
      }

      const nextUsed = alreadySelected
        ? used
        : used + 1;

      transaction.set(
        usageRef,
        {
          uid: decodedToken.uid,
          cycleKey,
          subscriptionId:
            subscription.paypalSubscriptionId || null,
          downloadsUsed: nextUsed,
          downloadLimit:
            PREMIUM_MONTHLY_TRACK_LIMIT,
          selectedTrackIds: alreadySelected
            ? selectedTrackIds
            : FieldValue.arrayUnion(itemId),
          lastDownloadedTrackId: itemId,
          lastDownloadAt:
            FieldValue.serverTimestamp(),
          updatedAt:
            FieldValue.serverTimestamp(),
          createdAt:
            usageSnapshot.exists
              ? usage.createdAt ||
                FieldValue.serverTimestamp()
              : FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return {
        allowed: true as const,
        alreadySelected,
        used: nextUsed,
      };
    }
  );

  if (!result.allowed) {
    return NextResponse.json(
      {
        success: false,
        error:
          "You have used all 10 Premium track downloads for this billing month.",
        downloadsUsed: result.used,
        downloadsRemaining: 0,
        downloadLimit:
          PREMIUM_MONTHLY_TRACK_LIMIT,
        cycleKey,
      },
      { status: 403 }
    );
  }

  await subscriptionRef.set(
    {
      premiumDownloadsUsed:
        result.used,
      premiumDownloadLimit:
        PREMIUM_MONTHLY_TRACK_LIMIT,
      premiumDownloadCycleKey:
        cycleKey,
      lastPremiumDownloadAt:
        FieldValue.serverTimestamp(),
      updatedAt:
        FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return NextResponse.json({
    success: true,
    premiumDownload: true,
    itemType: "track",
    itemId,
    title: downloadFile.title,
    fileName: safeDownloadName,
    downloadUrl,
    expiresAt:
      new Date(expiresAt).toISOString(),
    alreadySelected:
      result.alreadySelected,
    downloadsUsed: result.used,
    downloadsRemaining: Math.max(
      0,
      PREMIUM_MONTHLY_TRACK_LIMIT -
        result.used
    ),
    downloadLimit:
      PREMIUM_MONTHLY_TRACK_LIMIT,
    cycleKey,
    message: result.alreadySelected
      ? "A fresh download link was generated. This track was already selected during the current billing month."
      : "Premium track download selected successfully.",
  });
}

const DOWNLOAD_LINK_DURATION_MS = 60 * 60 * 1000;

function isItemType(value: unknown): value is ItemType {
  return value === "album" || value === "track";
}

function getDownloadFile(
  itemType: ItemType,
  itemId: string
): DownloadFile | undefined {
  if (itemType === "album") {
    return ALBUM_DOWNLOAD_FILES[itemId];
  }

  return TRACK_DOWNLOAD_FILES[itemId];
}

async function generateSignedDownload(
  itemType: ItemType,
  itemId: string
) {
  const downloadFile = getDownloadFile(itemType, itemId);

  if (!downloadFile) {
    throw new Error(
      itemType === "track"
        ? "The requested track file has not been registered yet."
        : "The requested album file has not been registered yet."
    );
  }

  const file = adminBucket.file(downloadFile.storagePath);
  const [fileExists] = await file.exists();

  if (!fileExists) {
    throw new Error(
      itemType === "track"
        ? `The track file "${downloadFile.storagePath}" was not found in Firebase Storage.`
        : `The album file "${downloadFile.storagePath}" was not found in Firebase Storage.`
    );
  }

  const expiresAt = Date.now() + DOWNLOAD_LINK_DURATION_MS;
  const safeDownloadName = downloadFile.downloadName.replace(/"/g, "");

  const [downloadUrl] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: expiresAt,
    responseDisposition:
      `attachment; filename="${safeDownloadName}"`,
  });

  return {
    downloadFile,
    safeDownloadName,
    downloadUrl,
    expiresAt,
  };
}

export async function POST(request: Request) {
  try {
    const body =
      (await request.json()) as DownloadRequestBody;

    const developmentMode =
      process.env.NODE_ENV !== "production";

    const requestedTestMode = body.testMode === true;
    const requestedPremiumDownload =
      body.premiumDownload === true;

    if (requestedPremiumDownload) {
      if (
        body.itemType !== "track" ||
        typeof body.itemId !== "string" ||
        body.itemId.trim() === ""
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "A valid Premium track ID is required.",
          },
          { status: 400 }
        );
      }

      return handlePremiumTrackDownload(
        request,
        body.itemId.trim()
      );
    }

    if (requestedTestMode) {
      if (!developmentMode) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Development download testing is disabled in production.",
          },
          { status: 403 }
        );
      }

      if (!isItemType(body.itemType)) {
        return NextResponse.json(
          {
            success: false,
            error: "A valid test item type is required.",
          },
          { status: 400 }
        );
      }

      if (
        typeof body.itemId !== "string" ||
        body.itemId.trim() === ""
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "A valid test item ID is required.",
          },
          { status: 400 }
        );
      }

      const cleanItemId = body.itemId.trim();

      const {
        downloadFile,
        safeDownloadName,
        downloadUrl,
        expiresAt,
      } = await generateSignedDownload(
        body.itemType,
        cleanItemId
      );

      return NextResponse.json({
        success: true,
        testMode: true,
        itemId: cleanItemId,
        itemType: body.itemType,
        title: downloadFile.title,
        fileName: safeDownloadName,
        downloadUrl,
        expiresAt: new Date(expiresAt).toISOString(),
        message:
          body.itemType === "track"
            ? "Development track download test is ready."
            : "Development album download test is ready.",
      });
    }

    const orderId = body.orderId;
    const captureId = body.captureId;
    const itemId = body.itemId;

    if (
      typeof orderId !== "string" ||
      orderId.trim() === ""
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "A valid order ID is required.",
        },
        { status: 400 }
      );
    }

    if (
      typeof captureId !== "string" ||
      captureId.trim() === ""
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A valid payment capture ID is required.",
        },
        { status: 400 }
      );
    }

    if (
      typeof itemId !== "string" ||
      itemId.trim() === ""
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A valid purchased item ID is required.",
        },
        { status: 400 }
      );
    }

    const cleanOrderId = orderId.trim();
    const cleanCaptureId = captureId.trim();
    const cleanItemId = itemId.trim();

    const purchaseRef = adminDb
      .collection("purchases")
      .doc(cleanOrderId);

    const purchaseSnapshot = await purchaseRef.get();

    if (!purchaseSnapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          error: "Purchase record not found.",
        },
        { status: 404 }
      );
    }

    const purchase = purchaseSnapshot.data();

    if (
      purchase?.paymentStatus !== "COMPLETED" ||
      purchase?.paymentCaptureStatus !== "COMPLETED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The payment has not been completed.",
        },
        { status: 403 }
      );
    }

    if (
      purchase?.paymentCaptureId !== cleanCaptureId
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The payment verification information does not match.",
        },
        { status: 403 }
      );
    }

    const purchasedItems = Array.isArray(
      purchase?.items
    )
      ? (purchase.items as PurchaseItem[])
      : [];

    const purchasedItem = purchasedItems.find(
      (item) => item.itemId === cleanItemId
    );

    if (!purchasedItem) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This item was not included in the completed purchase.",
        },
        { status: 403 }
      );
    }

    if (!isItemType(purchasedItem.itemType)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The purchased item type is not supported.",
        },
        { status: 400 }
      );
    }

    const {
      downloadFile,
      safeDownloadName,
      downloadUrl,
      expiresAt,
    } = await generateSignedDownload(
      purchasedItem.itemType,
      cleanItemId
    );

    await purchaseRef.set(
      {
        deliveryStatus: "delivered",
        downloadAccessGranted: true,
        downloadCount: FieldValue.increment(1),
        lastDownloadAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        deliveredItems: FieldValue.arrayUnion({
          itemId: cleanItemId,
          itemType: purchasedItem.itemType,
          title:
            purchasedItem.name || downloadFile.title,
          storagePath: downloadFile.storagePath,
          deliveredAt: new Date().toISOString(),
        }),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      testMode: false,
      orderId: cleanOrderId,
      itemId: cleanItemId,
      itemType: purchasedItem.itemType,
      title: downloadFile.title,
      fileName: safeDownloadName,
      downloadUrl,
      expiresAt: new Date(expiresAt).toISOString(),
      message:
        purchasedItem.itemType === "track"
          ? "Secure track download access granted."
          : "Secure album download access granted.",
    });
  } catch (error) {
    console.error("Secure download error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An unexpected download error occurred.",
      },
      { status: 500 }
    );
  }
}



