import { NextResponse } from "next/server";

import {
  adminBucket,
  adminDb,
} from "../../../../lib/firebaseAdmin";

async function storageVideoUrl(
  storagePath: unknown
) {
  if (
    typeof storagePath !== "string" ||
    !storagePath
  ) {
    return null;
  }

  const file =
    adminBucket.file(storagePath);

  const [exists] =
    await file.exists();

  if (!exists) {
    return null;
  }

  const [url] =
    await file.getSignedUrl({
      action: "read",
      expires:
        Date.now() +
        60 * 60 * 1000,
    });

  return url;
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
        .where("kind", "==", "video")
        .get();

    const videos = (
      await Promise.all(
        snapshot.docs.map(
          async (doc) => {
            const data =
              doc.data();

            if (
              data.published !== true ||
              data.homepageEnabled !==
                true
            ) {
              return null;
            }

            const isYoutube =
              data.videoSource ===
                "youtube" &&
              typeof data.youtubeVideoId ===
                "string";

            const youtubeEmbed =
              isYoutube
                ? youtubeEmbedUrl(
                    data.youtubeVideoId
                  )
                : null;

            const videoUrl =
              isYoutube
                ? null
                : await storageVideoUrl(
                    data.storagePath
                  );

            if (
              !youtubeEmbed &&
              !videoUrl
            ) {
              return null;
            }

            return {
              mediaId: doc.id,

              title:
                data.title ||
                "SOLO BEATS Video",

              description:
                data.description || "",

              sourceType:
                data.sourceType ||
                "solo-beats",

              videoSource:
                isYoutube
                  ? "youtube"
                  : "upload",

              youtubeVideoId:
                isYoutube
                  ? data.youtubeVideoId
                  : null,

              youtubeUrl:
                isYoutube &&
                typeof data.youtubeUrl ===
                  "string"
                  ? data.youtubeUrl
                  : null,

              youtubeEmbedUrl:
                youtubeEmbed,

              videoUrl,

              featured:
                data.featured === true,

              displayOrder:
                Number.isFinite(
                  Number(
                    data.displayOrder
                  )
                )
                  ? Number(
                      data.displayOrder
                    )
                  : 0,
            };
          }
        )
      )
    )
      .filter(
        (
          video
        ): video is NonNullable<
          typeof video
        > => Boolean(video)
      )
      .sort((a, b) => {
        if (
          a.featured !== b.featured
        ) {
          return a.featured
            ? -1
            : 1;
        }

        return (
          a.displayOrder -
          b.displayOrder
        );
      });

    return NextResponse.json({
      success: true,
      videos,
    });
  } catch (error) {
    console.error(
      "Homepage Video Channel GET error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        videos: [],
        error:
          "Video channel could not be loaded.",
      },
      { status: 500 }
    );
  }
}
