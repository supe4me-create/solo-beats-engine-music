import { NextResponse } from "next/server";

import {
  adminBucket,
  adminDb,
} from "../../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PremiumTvVideo = {
  mediaId: string;
  title: string;
  description: string;
  sourceType: string;
  featured: boolean;
  displayOrder: number;
  videoSource: "upload" | "youtube";
  youtubeVideoId: string | null;
  youtubeUrl: string | null;
  youtubeEmbedUrl: string | null;
  videoUrl: string | null;
};

function text(
  value: unknown,
  fallback = ""
) {
  return typeof value === "string"
    ? value
    : fallback;
}

function numberValue(
  value: unknown,
  fallback = 0
) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function youtubeEmbedUrl(
  videoId: unknown
) {
  if (
    typeof videoId !== "string" ||
    !/^[A-Za-z0-9_-]{11}$/.test(
      videoId
    )
  ) {
    return null;
  }

  return `https://www.youtube.com/embed/${videoId}`;
}

export async function GET() {
  try {
    const snapshot =
      await adminDb
        .collection("mediaLibrary")
        .get();

    const candidates =
      snapshot.docs
        .map((doc) => ({
          mediaId: doc.id,
          ...doc.data(),
        }))
        .filter((item) => {
          const data =
            item as Record<
              string,
              unknown
            >;

          const now =
            Date.now();

          const scheduleStart =
            typeof data.tvScheduleStart ===
              "string" &&
            data.tvScheduleStart.trim()
              ? Date.parse(
                  data.tvScheduleStart
                )
              : null;

          const scheduleEnd =
            typeof data.tvScheduleEnd ===
              "string" &&
            data.tvScheduleEnd.trim()
              ? Date.parse(
                  data.tvScheduleEnd
                )
              : null;

          const scheduleStarted =
            scheduleStart === null ||
            !Number.isFinite(
              scheduleStart
            ) ||
            now >= scheduleStart;

          const scheduleNotEnded =
            scheduleEnd === null ||
            !Number.isFinite(
              scheduleEnd
            ) ||
            now < scheduleEnd;

          const isYoutube =
            data.videoSource ===
              "youtube" &&
            typeof data.youtubeVideoId ===
              "string" &&
            /^[A-Za-z0-9_-]{11}$/.test(
              data.youtubeVideoId
            );

          const hasStorage =
            typeof data.storagePath ===
              "string" &&
            data.storagePath.length >
              0;

          return (
            data.published === true &&
            data.premiumTvEnabled ===
              true &&
            scheduleStarted &&
            scheduleNotEnded &&
            data.kind === "video" &&
            (
              isYoutube ||
              hasStorage
            )
          );
        })
        .sort((a, b) => {
          const first =
            a as Record<
              string,
              unknown
            >;

          const second =
            b as Record<
              string,
              unknown
            >;

          const featuredDifference =
            Number(
              second.featured === true
            ) -
            Number(
              first.featured === true
            );

          if (
            featuredDifference !== 0
          ) {
            return featuredDifference;
          }

          return (
            numberValue(
              first.displayOrder
            ) -
            numberValue(
              second.displayOrder
            )
          );
        });

    const videos:
      PremiumTvVideo[] = [];

    for (
      const item of candidates
    ) {
      const data =
        item as Record<
          string,
          unknown
        >;

      const isYoutube =
        data.videoSource ===
          "youtube" &&
        typeof data.youtubeVideoId ===
          "string";

      if (isYoutube) {
        const embed =
          youtubeEmbedUrl(
            data.youtubeVideoId
          );

        if (!embed) {
          continue;
        }

        videos.push({
          mediaId:
            text(data.mediaId),

          title:
            text(
              data.title,
              "SOLO BEATS Video"
            ),

          description:
            text(
              data.description
            ),

          sourceType:
            text(
              data.sourceType,
              "solo-beats"
            ),

          featured:
            data.featured === true,

          displayOrder:
            numberValue(
              data.displayOrder
            ),

          videoSource:
            "youtube",

          youtubeVideoId:
            text(
              data.youtubeVideoId
            ),

          youtubeUrl:
            typeof data.youtubeUrl ===
              "string"
              ? data.youtubeUrl
              : null,

          youtubeEmbedUrl:
            embed,

          videoUrl: null,
        });

        continue;
      }

      const storagePath =
        text(data.storagePath);

      try {
        const [videoUrl] =
          await adminBucket
            .file(storagePath)
            .getSignedUrl({
              action: "read",
              expires:
                Date.now() +
                60 * 60 * 1000,
            });

        videos.push({
          mediaId:
            text(data.mediaId),

          title:
            text(
              data.title,
              "SOLO BEATS Video"
            ),

          description:
            text(
              data.description
            ),

          sourceType:
            text(
              data.sourceType,
              "solo-beats"
            ),

          featured:
            data.featured === true,

          displayOrder:
            numberValue(
              data.displayOrder
            ),

          videoSource:
            "upload",

          youtubeVideoId:
            null,

          youtubeUrl:
            null,

          youtubeEmbedUrl:
            null,

          videoUrl,
        });
      } catch (error) {
        console.error(
          "Premium TV signed URL error:",
          storagePath,
          error
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        videos,
        count:
          videos.length,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error(
      "Premium TV video feed error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        videos: [],
        error:
          error instanceof Error
            ? error.message
            : "Premium TV videos could not be loaded.",
      },
      { status: 500 }
    );
  }
}
