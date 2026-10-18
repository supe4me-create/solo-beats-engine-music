import { spawn } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

import { adminBucket } from "../../../../../lib/firebaseAdmin";

import {
  requireVisualizerRenderAccess,
  refundVisualizerReservation,
  type VisualizerRenderAccess,
} from "../../../../../lib/visualizerRenderAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type GenerateBody = {
  title?: string;
  artist?: string;
  format?: "vertical" | "horizontal";
  visualStyle?: "cinematic" | "fire" | "neon";
  visualMode?: "auto" | "manual";
  manualEnergy?: number;
  clipStart?: number;
  clipDuration?: number;
  audioStoragePath?: string;
  imageStoragePath?: string;
  sourceMode?: "image" | "video";
  videoStoragePath?: string;
  bounceStrength?: number;
  beatSensitivity?: number;
  bounceDirection?: "auto" | "zoom" | "x" | "y";
  textOverlayDataUrl?: string;
  chunkMode?: boolean;
  chunkSessionId?: string;
  chunkIndex?: number;
  reservationId?: string;
};

function clean(value: unknown, max = 2000) {
  return String(value || "")
    .trim()
    .slice(0, max);
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, number));
}

function sanitizeFilePart(value: string) {
  return (
    value
      .replace(/[^a-zA-Z0-9-_ ]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80) || "solo-beats"
  );
}

function extensionFromPath(storagePath: string, fallback: string) {
  const ext = path.extname(storagePath);
  return ext || fallback;
}

function escapeDrawtext(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/%/g, "\\%")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, " ");
}

function escapeAssText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\r?\n/g, " ")
    .trim();
}
async function resolveFfmpegPath() {
  const candidates = [
    process.env.FFMPEG_PATH,
    path.join(
      process.cwd(),
      "node_modules",
      "ffmpeg-static",
      process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"
    ),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }

  throw new Error("FFMPEG_BINARY_NOT_FOUND");
}

async function resolveFontPath(): Promise<string | null> {
  const candidates = [
    process.env.VISUALIZER_FONT_PATH,
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    "C:\\Windows\\Fonts\\arialbd.ttf",
    "C:\\Windows\\Fonts\\arial.ttf",
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }

  return null;
}

async function runFfmpeg(args: string[]) {
  const ffmpegPath = await resolveFfmpegPath();

  await new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stderr = "";
    let stdout = "";

    child.stdout.on("data", chunk => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", chunk => {
      stderr += chunk.toString();
    });

    child.on("error", reject);

    child.on("close", code => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          [
            "FFMPEG_FAILED",
            "",
            "STDERR:",
            stderr.slice(-12000),
            "",
            "STDOUT:",
            stdout.slice(-4000),
          ].join("\n")
        )
      );
    });
  });
}

type BeatPeak = {
  time: number;
  strength: number;
};

async function captureFfmpegBuffer(
  args: string[]
): Promise<Buffer> {
  const ffmpegPath =
    await resolveFfmpegPath();

  return await new Promise<Buffer>(
    (resolve, reject) => {
      const child =
        spawn(
          ffmpegPath,
          args,
          {
            stdio: [
              "ignore",
              "pipe",
              "pipe",
            ],
            windowsHide: true,
          }
        );

      const chunks: Buffer[] = [];
      let stderr = "";

      child.stdout.on(
        "data",
        chunk => {
          chunks.push(
            Buffer.from(chunk)
          );
        }
      );

      child.stderr.on(
        "data",
        chunk => {
          stderr +=
            chunk.toString();
        }
      );

      child.on(
        "error",
        reject
      );

      child.on(
        "close",
        code => {
          if (code === 0) {
            resolve(
              Buffer.concat(chunks)
            );
            return;
          }

          reject(
            new Error(
              [
                "BEAT_ANALYSIS_FAILED",
                stderr.slice(-6000),
              ].join("\n")
            )
          );
        }
      );
    }
  );
}

async function analyzeBeatPeaks(
  mediaPath: string,
  clipStart: number,
  clipDuration: number,
  sensitivity: number
): Promise<BeatPeak[]> {
  const sampleRate = 8000;

  const pcm =
    await captureFfmpegBuffer([
      "-v",
      "error",

      "-ss",
      String(clipStart),

      "-t",
      String(clipDuration),

      "-i",
      mediaPath,

      "-vn",

      "-af",
      "highpass=f=45,lowpass=f=180",

      "-ac",
      "1",

      "-ar",
      String(sampleRate),

      "-f",
      "s16le",

      "pipe:1",
    ]);

  if (pcm.length < 4) {
    return [];
  }

  const samples =
    Math.floor(
      pcm.length / 2
    );

  const windowSamples =
    Math.max(
      80,
      Math.round(
        sampleRate * 0.02
      )
    );

  const energies: number[] = [];

  for (
    let start = 0;
    start + windowSamples <= samples;
    start += windowSamples
  ) {
    let sumSquares = 0;

    for (
      let index = 0;
      index < windowSamples;
      index++
    ) {
      const sample =
        pcm.readInt16LE(
          (start + index) * 2
        );

      sumSquares +=
        sample * sample;
    }

    energies.push(
      Math.sqrt(
        sumSquares /
          windowSamples
      )
    );
  }

  if (energies.length < 5) {
    return [];
  }

  const overallAverage =
    energies.reduce(
      (sum, value) =>
        sum + value,
      0
    ) /
    energies.length;

  if (overallAverage < 1) {
    return [];
  }

  const normalizedSensitivity =
    Math.min(
      100,
      Math.max(
        0,
        sensitivity
      )
    );

  // Higher sensitivity = easier detection.
  const thresholdRatio =
    1.68 -
    (
      normalizedSensitivity /
      100
    ) *
      0.53;

  const historyWindows = 25;
  const minGapWindows = 10;

  const candidates: BeatPeak[] = [];

  for (
    let index = historyWindows;
    index < energies.length - 1;
    index++
  ) {
    let historySum = 0;

    for (
      let h =
        index - historyWindows;
      h < index;
      h++
    ) {
      historySum +=
        energies[h];
    }

    const localAverage =
      historySum /
      historyWindows;

    const floor =
      Math.max(
        overallAverage * 0.45,
        localAverage * thresholdRatio
      );

    const current =
      energies[index];

    if (
      current <= floor ||
      current <= energies[index - 1] ||
      current < energies[index + 1]
    ) {
      continue;
    }

    const ratio =
      current /
      Math.max(
        1,
        localAverage
      );

    const strength =
      Math.min(
        1,
        Math.max(
          0.42,
          (
            ratio -
            thresholdRatio +
            0.5
          ) /
            1.35
        )
      );

    const peak: BeatPeak = {
      time:
        (
          index *
          windowSamples
        ) /
        sampleRate,
      strength,
    };

    const previous =
      candidates[
        candidates.length - 1
      ];

    if (
      previous &&
      (
        peak.time -
        previous.time
      ) <
        (
          minGapWindows *
          windowSamples
        ) /
          sampleRate
    ) {
      if (
        peak.strength >
        previous.strength
      ) {
        candidates[
          candidates.length - 1
        ] = peak;
      }

      continue;
    }

    candidates.push(peak);
  }

  return candidates;
}

function buildBeatPulseExpression(
  beats: BeatPeak[],
  frameVariable: "on" | "n" = "on"
) {
  if (!beats.length) {
    return "0";
  }

  const pulseFrames = 6;

  const terms =
    beats.map(
      beat => {
        const frame =
          Math.max(
            0,
            Math.round(beat.time * 24)
          );

        const strength =
          Math.min(
            1,
            Math.max(
              0.35,
              beat.strength
            )
          ).toFixed(3);

        return (
          `(${strength}` +
          `*between(${frameVariable}\\,${frame}\\,${frame + pulseFrames})` +
          `*(1-(${frameVariable}-${frame})/${pulseFrames}))`
        );
      }
    );

  return terms.join("+");
}
export async function POST(request: Request) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "solo-visualizer-"));

  let renderAccess:
    VisualizerRenderAccess | null =
    null;

  try {
    const body = (await request.json()) as GenerateBody;

    renderAccess =
      await requireVisualizerRenderAccess(
        request,
        body.reservationId
      );

    const title = clean(body.title || "SOLO BEATS", 100);
    const artist = clean(body.artist || "SOLO BEATS", 100);

    const format = body.format === "horizontal" ? "horizontal" : "vertical";

    const visualStyle =
      body.visualStyle === "fire"
        ? "fire"
        : body.visualStyle === "neon"
          ? "neon"
          : "cinematic";

    const visualMode = body.visualMode === "manual" ? "manual" : "auto";

    const sourceMode = body.sourceMode === "video" ? "video" : "image";

    const bounceDirection =
      body.bounceDirection === "zoom" ||
      body.bounceDirection === "x" ||
      body.bounceDirection === "y"
        ? body.bounceDirection
        : "auto";

    const chunkMode =
      body.chunkMode === true;

    const chunkSessionId =
      clean(
        body.chunkSessionId,
        120
      ).replace(
        /[^a-zA-Z0-9_-]/g,
        ""
      );

    const chunkIndex =
      Math.max(
        0,
        Math.floor(
          Number(
            body.chunkIndex || 0
          )
        )
      );

    const clipStart =
      clampNumber(
        body.clipStart,
        0,
        3600,
        0
      );

    const clipDuration =
      chunkMode
        ? clampNumber(
            body.clipDuration,
            5,
            30,
            30
          )
        : clampNumber(
            body.clipDuration,
            120,
            300,
            120
          );
    const manualEnergy = clampNumber(body.manualEnergy, 50, 200, 100);
    const bounceStrength = clampNumber(body.bounceStrength, 0, 200, 100);
    const beatSensitivity = clampNumber(body.beatSensitivity, 0, 100, 65);

    const audioStoragePath = clean(body.audioStoragePath, 2000);
    const imageStoragePath = clean(body.imageStoragePath, 2000);
    const videoStoragePath = clean(body.videoStoragePath, 2000);

    if (sourceMode === "image" && !audioStoragePath) {
      return Response.json(
        {
          success: false,
          error: "AUDIO_STORAGE_PATH_REQUIRED",
        },
        { status: 400 }
      );
    }

    if (sourceMode === "image" && !imageStoragePath) {
      return Response.json(
        {
          success: false,
          error: "IMAGE_STORAGE_PATH_REQUIRED",
        },
        { status: 400 }
      );
    }

    if (sourceMode === "video" && !videoStoragePath) {
      return Response.json(
        {
          success: false,
          error: "VIDEO_STORAGE_PATH_REQUIRED",
        },
        { status: 400 }
      );
    }

    let audioPath = "";
    let visualPath = "";

    if (sourceMode === "image") {
      const audioFile =
        adminBucket.file(
          audioStoragePath
        );

      const imageFile =
        adminBucket.file(
          imageStoragePath
        );

      const [
        audioDownload,
        imageDownload,
      ] =
        await Promise.all([
          audioFile.download(),
          imageFile.download(),
        ]);

      audioPath =
        path.join(
          tempDir,
          "audio" +
            extensionFromPath(
              audioStoragePath,
              ".wav"
            )
        );

      visualPath =
        path.join(
          tempDir,
          "image" +
            extensionFromPath(
              imageStoragePath,
              ".png"
            )
        );

      await fs.writeFile(
        audioPath,
        audioDownload[0]
      );

      await fs.writeFile(
        visualPath,
        imageDownload[0]
      );
    }
    else {
      const videoFile =
        adminBucket.file(
          videoStoragePath
        );

      const [
        videoDownload,
      ] =
        await videoFile.download();

      visualPath =
        path.join(
          tempDir,
          "video" +
            extensionFromPath(
              videoStoragePath,
              ".mp4"
            )
        );

      await fs.writeFile(
        visualPath,
        videoDownload
      );
    }

    const textOverlayDataUrl =
      typeof body.textOverlayDataUrl === "string"
        ? body.textOverlayDataUrl
        : "";

    if (
      !textOverlayDataUrl.startsWith(
        "data:image/png;base64,"
      )
    ) {
      return Response.json(
        {
          success: false,
          error:
            "TEXT_OVERLAY_PNG_REQUIRED",
        },
        {
          status: 400,
        }
      );
    }

    const overlayBase64 =
      textOverlayDataUrl.substring(
        "data:image/png;base64,".length
      );

    const textOverlayPath =
      path.join(
        tempDir,
        "text-overlay.png"
      );

    await fs.writeFile(
      textOverlayPath,
      Buffer.from(
        overlayBase64,
        "base64"
      )
    );
    const outputPath =
      path.join(
        tempDir,
        "visualizer.mp4"
      );
    const fontPath = await resolveFontPath();

    const fontPathForFilter = fontPath
      ? fontPath.replace(/\\/g, "/").replace(/:/g, "\\:")
      : "";

    const drawTextFontOption =
      fontPath
        ? `fontfile='${fontPathForFilter}'`
        : `font='Sans'`;

    const width = format === "horizontal" ? 1920 : 1080;
    const height = format === "horizontal" ? 1080 : 1920;

    const coverSize = format === "horizontal" ? 520 : 700;
    const glowSize = format === "horizontal" ? 620 : 820;
    const waveWidth = format === "horizontal" ? 1340 : 860;
    const waveHeight = format === "horizontal" ? 90 : 120;
    const spectrumWidth = format === "horizontal" ? 1340 : 860;
    const spectrumHeight = format === "horizontal" ? 210 : 280;

    const panelWidth = format === "horizontal" ? 1440 : 940;
    const panelHeight = format === "horizontal" ? 350 : 500;
    const panelX = Math.floor((width - panelWidth) / 2);
    const panelY = format === "horizontal" ? 660 : 1260;

    const coverY = format === "horizontal" ? 90 : 165;
    const glowY = format === "horizontal" ? 45 : 110;
    const waveY = format === "horizontal" ? 700 : 1320;
    const titleY = format === "horizontal" ? 790 : 1455;
    const artistY = format === "horizontal" ? 845 : 1525;
    const spectrumY = format === "horizontal" ? 840 : 1575;

    const titleSize = format === "horizontal" ? 58 : 70;
    const artistSize = format === "horizontal" ? 30 : 38;

    const metaLabelSize =
      format === "horizontal"
        ? 18
        : 22;

    const songInfoX =
      panelX + (
        format === "horizontal"
          ? 48
          : 40
      );

    const songInfoY =
      format === "horizontal"
        ? 775
        : 1450;

    const songInfoWidth =
      panelWidth - (
        format === "horizontal"
          ? 96
          : 80
      );

    const songInfoHeight =
      format === "horizontal"
        ? 118
        : 154;

    const songLabelY =
      format === "horizontal"
        ? 786
        : 1462;

    const songTitleY =
      format === "horizontal"
        ? 806
        : 1494;

    const artistLabelY =
      format === "horizontal"
        ? 842
        : 1540;

    const artistNameY =
      format === "horizontal"
        ? 862
        : 1572;

    const safeTitle = escapeDrawtext(title.toUpperCase());
    const safeArtist = escapeDrawtext(artist.toUpperCase());

    const assTitle =
      escapeAssText(
        title.toUpperCase()
      );

    const assArtist =
      escapeAssText(
        artist.toUpperCase()
      );

    const assPath =
      path.join(
        tempDir,
        "song-info.ass"
      );

    const assPathForFilter =
      assPath
        .replace(/\\/g, "/")
        .replace(/:/g, "\\:");

    const assTitleSize =
      format === "horizontal"
        ? 58
        : 72;

    const assArtistSize =
      format === "horizontal"
        ? 34
        : 44;

    const assLabelSize =
      format === "horizontal"
        ? 18
        : 24;

    const assX =
      format === "horizontal"
        ? 310
        : 120;

    const assSongLabelY =
      format === "horizontal"
        ? 770
        : 1420;

    const assSongY =
      format === "horizontal"
        ? 796
        : 1460;

    const assArtistLabelY =
      format === "horizontal"
        ? 855
        : 1545;

    const assArtistY =
      format === "horizontal"
        ? 880
        : 1585;

    const assContent = [
      "[Script Info]",
      "ScriptType: v4.00+",
      `PlayResX: ${width}`,
      `PlayResY: ${height}`,
      "ScaledBorderAndShadow: yes",
      "",
      "[V4+ Styles]",
      "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding",
      `Style: Label,DejaVu Sans,${assLabelSize},&H00D0D0D0,&H00FFFFFF,&H90000000,&H60000000,-1,0,0,0,100,100,1,0,1,2,1,7,0,0,0,1`,
      `Style: Song,DejaVu Sans,${assTitleSize},&H00FFFFFF,&H00FFFFFF,&H90000000,&H60000000,-1,0,0,0,100,100,1,0,1,3,1,7,0,0,0,1`,
      `Style: Artist,DejaVu Sans,${assArtistSize},&H005533FF,&H00FFFFFF,&H90000000,&H60000000,-1,0,0,0,100,100,1,0,1,3,1,7,0,0,0,1`,
      "",
      "[Events]",
      "Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text",
      `Dialogue: 0,0:00:00.00,9:59:59.00,Label,,0,0,0,,{\\pos(${assX},${assSongLabelY})}SONG`,
      `Dialogue: 0,0:00:00.00,9:59:59.00,Song,,0,0,0,,{\\pos(${assX},${assSongY})}${assTitle}`,
      `Dialogue: 0,0:00:00.00,9:59:59.00,Label,,0,0,0,,{\\pos(${assX},${assArtistLabelY})}ARTIST`,
      `Dialogue: 0,0:00:00.00,9:59:59.00,Artist,,0,0,0,,{\\pos(${assX},${assArtistY})}${assArtist}`,
      "",
    ].join("\n");

    await fs.writeFile(
      assPath,
      assContent,
      "utf8"
    );

    const energyFactor =
      visualMode === "manual"
        ? manualEnergy / 100
        : visualStyle === "fire"
          ? 1.25
          : visualStyle === "neon"
            ? 1.12
            : 1;

    const glowAlpha = Math.min(0.8, Math.max(0.18, 0.36 * energyFactor)).toFixed(2);
    const bounceFactor = Math.min(0.18, Math.max(0.02, (bounceStrength / 100) * 0.08 * energyFactor));

    const detectedBeats =
      sourceMode === "video"
        ? await analyzeBeatPeaks(
            visualPath,
            clipStart,
            clipDuration,
            beatSensitivity
          )
        : [];

    const maxRenderBeats = 180;

    const renderBeats =
      detectedBeats.length <= maxRenderBeats
        ? detectedBeats
        : Array.from(
            {
              length: maxRenderBeats,
            },
            (_, index) => {
              const sourceIndex =
                Math.round(
                  index *
                    (
                      detectedBeats.length -
                      1
                    ) /
                    (
                      maxRenderBeats -
                      1
                    )
                );

              return detectedBeats[
                sourceIndex
              ];
            }
          );
const beatPulseExpr =
      buildBeatPulseExpression(
        renderBeats,
        "on"
      );

    const beatPulseFrameExpr =
      buildBeatPulseExpression(
        renderBeats,
        "n"
      );

    console.log(
      "VISUALIZER V7 REAL BEATS",
      {
        detected:
          detectedBeats.length,
        renderedBeats:
          renderBeats.length,
        sensitivity:
          beatSensitivity,
        firstBeats:
          detectedBeats
            .slice(0, 8)
            .map(beat => ({
              time:
                Number(
                  beat.time.toFixed(3)
                ),
              strength:
                Number(
                  beat.strength.toFixed(3)
                ),
            })),
      }
    );


    const spectrumColor =
      visualStyle === "fire"
        ? "fire"
        : visualStyle === "neon"
          ? "rainbow"
          : "magma";

    const waveColors =
      visualStyle === "fire"
        ? "0xffff2200|0xffffaa00"
        : visualStyle === "neon"
          ? "0xff00ffff|0xffff00ff"
          : "0xffff1744|0xffffffff";

    const bgSaturation =
      visualStyle === "fire"
        ? "1.45"
        : visualStyle === "neon"
          ? "1.28"
          : "1.18";

    const bgBrightness =
      visualStyle === "fire"
        ? "-0.03"
        : visualStyle === "neon"
          ? "-0.05"
          : "-0.08";

    const panelColor =
      visualStyle === "fire"
        ? "0x140200@0.65"
        : visualStyle === "neon"
          ? "0x020616@0.62"
          : "0x000000@0.58";

    const titleColor =
      visualStyle === "fire"
        ? "0xffffc266"
        : visualStyle === "neon"
          ? "0xffd7f9ff"
          : "0xffffffff";

    const artistColor =
      visualStyle === "fire"
        ? "0xffff8a33"
        : visualStyle === "neon"
          ? "0xff9ef7ff"
          : "0xffff3355";

    const songInfoBoxColor =
      visualStyle === "fire"
        ? "0x140700@0.74"
        : visualStyle === "neon"
          ? "0x04111c@0.74"
          : "0x050505@0.74";

    const metaLabelColor =
      visualStyle === "fire"
        ? "0xffffc58a"
        : visualStyle === "neon"
          ? "0xff85eeff"
          : "0xffd0d0d0";

    const filterParts: string[] = [
      `[0:a]asplit=2[aWave][aSpec]`,
      `[aWave]showwaves=s=${waveWidth}x${waveHeight}:mode=line:colors=${waveColors}:rate=24,format=rgba[wave]`,
      `[aSpec]showspectrum=s=${spectrumWidth}x${spectrumHeight}:mode=combined:color=${spectrumColor}:slide=scroll:scale=cbrt:win_func=hann:legend=0[specRaw]`,
      `[specRaw]eq=brightness='0.14*(${beatPulseFrameExpr})':contrast=1.18:saturation=1.28:eval=frame,format=rgba[spec]`,
    ];

    if (sourceMode === "image") {
      filterParts.push(
        `[1:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},boxblur=42:6,eq=brightness='${bgBrightness}+0.10*(${beatPulseFrameExpr})':saturation='${bgSaturation}+0.45*(${beatPulseFrameExpr})':contrast=1.08:eval=frame[vbg]`,
        `[1:v]scale=${coverSize}:${coverSize}:force_original_aspect_ratio=decrease,pad=${coverSize}:${coverSize}:(ow-iw)/2:(oh-ih)/2:color=black@0,format=rgba[coverBase]`,
        `[coverBase]split=3[cover][coverGlowSrc][reflectSrc]`,
        `[coverGlowSrc]scale=${glowSize}:${glowSize},boxblur=32:8,format=rgba,colorchannelmixer=aa=${glowAlpha}[coverGlow]`,
        `[reflectSrc]vflip,crop=${coverSize}:${Math.floor(coverSize * 0.22)}:0:0,format=rgba,colorchannelmixer=aa=0.18[reflection]`,
        `[vbg][coverGlow]overlay=(W-w)/2:${glowY}[v1]`,
        `[v1][cover]overlay=(W-w)/2:${coverY}[v2]`,
        `[v2][reflection]overlay=(W-w)/2:${coverY + coverSize - 4}[v3]`,
        `[v3]drawbox=x=${panelX}:y=${panelY}:w=${panelWidth}:h=${panelHeight}:color=${panelColor}:t=fill[v4]`,
        `[v4][wave]overlay=(W-w)/2:${waveY}[v5]`,
        `[v5][spec]overlay=(W-w)/2:${spectrumY}[v6]`
      );
    } else {
      const prepWidth = format === "horizontal" ? 2280 : 1440;
      const prepHeight = format === "horizontal" ? 1320 : 2360;
      const panX =
        bounceDirection === "y"
          ? 0
          : Math.max(16, Math.floor(prepWidth * (0.02 + (bounceStrength / 200) * 0.05)));
      const panY =
        bounceDirection === "x"
          ? 0
          : Math.max(16, Math.floor(prepHeight * (0.02 + (bounceStrength / 200) * 0.05)));

      const zoomAmp =
        bounceDirection === "x" || bounceDirection === "y"
          ? (bounceFactor * 0.4).toFixed(4)
          : (bounceFactor * 0.75).toFixed(4);

      const zoomBeatAmount =
        bounceDirection === "zoom" ||
        bounceDirection === "auto"
          ? Number(zoomAmp)
          : Number(zoomAmp) * 0.35;

      const autoShakeX =
        bounceDirection === "auto"
          ? Math.max(
              2,
              Math.floor(
                prepWidth *
                  0.0035 *
                  Math.max(
                    0.5,
                    bounceStrength / 100
                  )
              )
            )
          : 0;

      const autoShakeY =
        bounceDirection === "auto"
          ? Math.max(
              2,
              Math.floor(
                prepHeight *
                  0.0028 *
                  Math.max(
                    0.5,
                    bounceStrength / 100
                  )
              )
            )
          : 0;

      const zoomExpr =
        `1+${zoomBeatAmount.toFixed(4)}*(${beatPulseExpr})`;

      const xExpr =
        panX > 0 || autoShakeX > 0
          ? `iw/2-(iw/zoom/2)+(${beatPulseExpr})*(${panX}*sin(on*0.63)+${autoShakeX}*sin(on*2.47))`
          : `iw/2-(iw/zoom/2)`;

      const yExpr =
        panY > 0 || autoShakeY > 0
          ? `ih/2-(ih/zoom/2)+(${beatPulseExpr})*(${panY}*cos(on*0.57)+${autoShakeY}*cos(on*2.19))`
          : `ih/2-(ih/zoom/2)`;

      filterParts.push(
        `[0:v]setpts=PTS-STARTPTS,fps=24,scale=${prepWidth}:${prepHeight}:force_original_aspect_ratio=increase,crop=${prepWidth}:${prepHeight},zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=1:s=${width}x${height}:fps=24,eq=brightness='${bgBrightness}+0.10*(${beatPulseFrameExpr})':saturation='${bgSaturation}+0.45*(${beatPulseFrameExpr})':contrast=1.08:eval=frame[vbg]`,
        `[vbg]drawbox=x=${panelX}:y=${panelY}:w=${panelWidth}:h=${panelHeight}:color=${panelColor}:t=fill[v1]`,
        `[v1][wave]overlay=(W-w)/2:${waveY}[v2]`,
        `[v2][spec]overlay=(W-w)/2:${spectrumY}[v3]`
      );
    }

    const currentVideoLabel = sourceMode === "image" ? "v6" : "v3";

    const textOverlayInput =
      sourceMode === "image"
        ? 2
        : 1;

    filterParts.push(
      `[${textOverlayInput}:v]format=rgba[textCard]`,
      `[${currentVideoLabel}][textCard]overlay=0:0:format=auto[vText]`,
      `[vText]format=yuv420p[v]`
    );

    const filter = filterParts.join(";");

    const args =
      sourceMode === "image"
        ? [
            "-y",
            "-ss",
            String(clipStart),
            "-t",
            String(clipDuration),
            "-i",
            audioPath,
            "-loop",
            "1",
            "-i",
            visualPath,

            "-loop",
            "1",
            "-i",
            textOverlayPath,

            "-filter_complex",
            filter,
            "-map",
            "[v]",
            "-map",
            "0:a",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-crf",
            "27",
            "-r",
            "24",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            "-shortest",
            outputPath,
          ]
        : [
            "-y",

            "-ss",
            String(clipStart),

            "-t",
            String(clipDuration),

            "-i",
            visualPath,

            "-loop",
            "1",
            "-i",
            textOverlayPath,


            "-filter_complex",
            filter,

            "-map",
            "[v]",

            "-map",
            "0:a:0",

            "-c:v",
            "libx264",

            "-preset",
            "ultrafast",

            "-crf",
            "27",

            "-r",
            "24",

            "-c:a",
            "aac",

            "-b:a",
            "192k",

            "-pix_fmt",
            "yuv420p",

            "-movflags",
            "+faststart",

            "-shortest",

            outputPath,
          ];

    console.log("VISUALIZER V6 START", {
      format,
      visualStyle,
      visualMode,
      sourceMode,
      bounceStrength,
      beatSensitivity,
      bounceDirection,
      clipStart,
      clipDuration,
    });

    await runFfmpeg(args);

    console.log("VISUALIZER V6 COMPLETE");

    const bytes = await fs.readFile(outputPath);
    if (chunkMode) {
      if (!chunkSessionId) {
        throw new Error(
          "CHUNK_SESSION_REQUIRED"
        );
      }

      const paddedIndex =
        String(
          chunkIndex
        ).padStart(
          3,
          "0"
        );

      const chunkStoragePath =
        `owner/music-visualizer/chunks/${chunkSessionId}/chunk-${paddedIndex}.mp4`;

      await adminBucket.upload(
        outputPath,
        {
          destination:
            chunkStoragePath,

          metadata: {
            contentType:
              "video/mp4",

            cacheControl:
              "no-store",
          },
        }
      );

      console.log(
        "VISUALIZER CHUNK SAVED",
        {
          chunkSessionId,
          chunkIndex,
          clipStart,
          clipDuration,
          chunkStoragePath,
        }
      );

      return Response.json(
        {
          success: true,
          chunkMode: true,
          chunkIndex,
          storagePath:
            chunkStoragePath,
        }
      );
    }


    const fileName = `${sanitizeFilePart(title)}-${sourceMode}-${visualStyle}-visualizer.mp4`;

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("MUSIC VISUALIZER V6 ERROR:", error);

    if (renderAccess) {
      await refundVisualizerReservation(
        renderAccess,
        error instanceof Error
          ? error.message
          : "VISUALIZER_GENERATION_FAILED"
      ).catch(() => {});
    }

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "VISUALIZER_GENERATION_FAILED",
      },
      { status: 500 }
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}