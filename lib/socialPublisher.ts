import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";

import {
  DocumentReference,
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminBucket,
  adminDb,
} from "./firebaseAdmin";

type QueueResult = {
  postId: string;

  youtube:
    | "not_selected"
    | "not_connected"
    | "already_uploaded"
    | "existing_verified"
    | "uploaded_public"
    | "uploaded_unlisted"
    | "uploaded_private"
    | "failed";

  youtubeUrl?: string;

  instagram:
    | "not_selected"
    | "not_connected"
    | "already_published"
    | "already_publishing"
    | "published"
    | "failed";

  instagramUrl?: string;

  facebook:
    | "not_selected"
    | "not_connected"
    | "already_published"
    | "already_publishing"
    | "published"
    | "failed";

  facebookUrl?: string;

  tiktok:
    | "not_selected"
    | "not_connected"
    | "already_published"
    | "already_publishing"
    | "processing"
    | "published"
    | "failed";

  tiktokUrl?: string;

  error?: string;
};

function encryptionKey() {
  const secret =
    process.env.SOCIAL_PUBLISHER_SECRET ||
    "";

  if (!secret) {
    throw new Error(
      "SOCIAL_PUBLISHER_SECRET_MISSING"
    );
  }

  return createHash("sha256")
    .update(secret)
    .digest();
}

function decrypt(
  encryptedValue: string
) {
  const parts =
    encryptedValue.split(".");

  if (parts.length !== 3) {
    throw new Error(
      "INVALID_ENCRYPTED_REFRESH_TOKEN"
    );
  }

  const iv =
    Buffer.from(
      parts[0],
      "base64"
    );

  const tag =
    Buffer.from(
      parts[1],
      "base64"
    );

  const encrypted =
    Buffer.from(
      parts[2],
      "base64"
    );

  const decipher =
    createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      iv
    );

  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(
      encrypted
    ),
    decipher.final(),
  ]).toString("utf8");
}


// ============================================================
// SOLO_TIKTOK_DIRECT_POST_V1
// TikTok Content Posting API - Direct Post
// FILE_UPLOAD + token refresh + creator info + status polling.
// ============================================================

function encrypt(
  value: string
) {
  const iv =
    randomBytes(12);

  const cipher =
    createCipheriv(
      "aes-256-gcm",
      encryptionKey(),
      iv
    );

  const encrypted =
    Buffer.concat([
      cipher.update(
        value,
        "utf8"
      ),
      cipher.final(),
    ]);

  const tag =
    cipher.getAuthTag();

  return [
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

function numericExpiry(
  value: unknown
) {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (
      value as {
        toMillis?: unknown;
      }
    ).toMillis === "function"
  ) {
    return (
      value as {
        toMillis: () => number;
      }
    ).toMillis();
  }

  return 0;
}

async function tiktokAccessToken({
  connectionRef,
  connection,
}: {
  connectionRef:
    DocumentReference;
  connection: any;
}) {
  const encryptedAccess =
    typeof connection
      .tiktokAccessTokenEncrypted ===
      "string"
      ? connection
          .tiktokAccessTokenEncrypted
          .trim()
      : "";

  const encryptedRefresh =
    typeof connection
      .tiktokRefreshTokenEncrypted ===
      "string"
      ? connection
          .tiktokRefreshTokenEncrypted
          .trim()
      : "";

  if (!encryptedAccess) {
    throw new Error(
      "TIKTOK_ACCESS_TOKEN_MISSING"
    );
  }

  const expiresAt =
    numericExpiry(
      connection
        .tiktokAccessTokenExpiresAt
    );

  /*
   * Reuse the current token when it has
   * at least 5 minutes remaining.
   */
  if (
    expiresAt >
    Date.now() + 5 * 60 * 1000
  ) {
    return decrypt(
      encryptedAccess
    );
  }

  if (!encryptedRefresh) {
    throw new Error(
      "TIKTOK_REFRESH_TOKEN_MISSING_RECONNECT_REQUIRED"
    );
  }

  const clientKey =
    process.env
      .TIKTOK_CLIENT_KEY
      ?.trim();

  const clientSecret =
    process.env
      .TIKTOK_CLIENT_SECRET
      ?.trim();

  if (
    !clientKey ||
    !clientSecret
  ) {
    throw new Error(
      "TIKTOK_OAUTH_ENV_MISSING"
    );
  }

  const refreshToken =
    decrypt(
      encryptedRefresh
    );

  const response =
    await fetch(
      "https://open.tiktokapis.com/v2/oauth/token/",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
          "Cache-Control":
            "no-cache",
        },

        body:
          new URLSearchParams({
            client_key:
              clientKey,

            client_secret:
              clientSecret,

            grant_type:
              "refresh_token",

            refresh_token:
              refreshToken,
          }),
      }
    );

  const text =
    await response.text();

  let data: any = {};

  try {
    data =
      text
        ? JSON.parse(text)
        : {};
  } catch {
    throw new Error(
      `TIKTOK_TOKEN_REFRESH_RESPONSE_INVALID: ${text.slice(
        0,
        1500
      )}`
    );
  }

  if (
    !response.ok ||
    typeof data.access_token !==
      "string" ||
    !data.access_token
  ) {
    throw new Error(
      data.error_description ||
      data.error ||
      `TIKTOK_TOKEN_REFRESH_FAILED: ${text.slice(
        0,
        1500
      )}`
    );
  }

  const newAccessToken =
    data.access_token as string;

  const newRefreshToken =
    typeof data.refresh_token ===
      "string" &&
    data.refresh_token
      ? data.refresh_token
      : refreshToken;

  const expiresIn =
    typeof data.expires_in ===
      "number"
      ? data.expires_in
      : 86400;

  const refreshExpiresIn =
    typeof data
      .refresh_expires_in ===
      "number"
      ? data.refresh_expires_in
      : 0;

  await connectionRef.set(
    {
      tiktokAccessTokenEncrypted:
        encrypt(
          newAccessToken
        ),

      tiktokRefreshTokenEncrypted:
        encrypt(
          newRefreshToken
        ),

      tiktokAccessTokenExpiresAt:
        Date.now() +
        expiresIn * 1000,

      tiktokRefreshTokenExpiresAt:
        refreshExpiresIn > 0
          ? (
              Date.now() +
              refreshExpiresIn *
                1000
            )
          : connection
              .tiktokRefreshTokenExpiresAt ||
            null,

      tiktokConnected:
        true,

      updatedAt:
        FieldValue
          .serverTimestamp(),
    },
    {
      merge: true,
    }
  );

  connection
    .tiktokAccessTokenEncrypted =
      encrypt(
        newAccessToken
      );

  connection
    .tiktokRefreshTokenEncrypted =
      encrypt(
        newRefreshToken
      );

  connection
    .tiktokAccessTokenExpiresAt =
      Date.now() +
      expiresIn * 1000;

  return newAccessToken;
}

async function tiktokCreatorInfo(
  accessToken: string
) {
  const response =
    await fetch(
      "https://open.tiktokapis.com/v2/post/publish/creator_info/query/",
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          "Content-Type":
            "application/json; charset=UTF-8",
        },

        body:
          JSON.stringify({}),
      }
    );

  const text =
    await response.text();

  let payload: any = {};

  try {
    payload =
      text
        ? JSON.parse(text)
        : {};
  } catch {
    throw new Error(
      `TIKTOK_CREATOR_INFO_INVALID: ${text.slice(
        0,
        1500
      )}`
    );
  }

  if (
    !response.ok ||
    payload?.error?.code !==
      "ok"
  ) {
    throw new Error(
      `TIKTOK_CREATOR_INFO_FAILED: ${
        payload?.error?.code ||
        response.status
      } ${
        payload?.error?.message ||
        text.slice(0, 1000)
      }`
    );
  }

  const privacyOptions =
    Array.isArray(
      payload
        ?.data
        ?.privacy_level_options
    )
      ? payload
          .data
          .privacy_level_options
          .filter(
            (value: unknown) =>
              typeof value ===
              "string"
          )
      : [];

  /*
   * Sandbox / unaudited Direct Post
   * publishing prefers public visibility when TikTok allows it.
   */
  const selectedPrivacyLevel =
    privacyOptions.includes(
      "PUBLIC_TO_EVERYONE"
    )
      ? "PUBLIC_TO_EVERYONE"
      : privacyOptions.includes(
          "SELF_ONLY"
        )
        ? "SELF_ONLY"
        : "";

  if (!selectedPrivacyLevel) {
    throw new Error(
      "TIKTOK_SUPPORTED_PRIVACY_NOT_AVAILABLE"
    );
  }

  return {
    privacyLevel:
      selectedPrivacyLevel,

    commentDisabled:
      payload
        ?.data
        ?.comment_disabled ===
      true,

    duetDisabled:
      payload
        ?.data
        ?.duet_disabled ===
      true,

    stitchDisabled:
      payload
        ?.data
        ?.stitch_disabled ===
      true,

    maxDuration:
      typeof payload
        ?.data
        ?.max_video_post_duration_sec ===
        "number"
        ? payload
            .data
            .max_video_post_duration_sec
        : null,
  };
}

function tiktokMimeType(
  storagePath: string
) {
  const lower =
    storagePath
      .toLowerCase();

  if (
    lower.endsWith(".mov") ||
    lower.endsWith(".qt")
  ) {
    return "video/quicktime";
  }

  if (
    lower.endsWith(".webm")
  ) {
    return "video/webm";
  }

  return "video/mp4";
}

function tiktokChunkPlan(
  videoSize: number
) {
  if (
    !Number.isFinite(
      videoSize
    ) ||
    videoSize <= 0
  ) {
    throw new Error(
      "TIKTOK_VIDEO_EMPTY"
    );
  }

  const MB =
    1024 * 1024;

  /*
   * TikTok permits chunks from 5 MB through
   * 64 MB, with special allowance for the
   * final remainder.
   *
   * One chunk is simplest for files <=64 MB.
   */
  if (
    videoSize <=
    64 * MB
  ) {
    return {
      chunkSize:
        videoSize,

      totalChunkCount:
        1,
    };
  }

  const chunkSize =
    10 * MB;

  const totalChunkCount =
    Math.max(
      1,
      Math.floor(
        videoSize /
        chunkSize
      )
    );

  return {
    chunkSize,
    totalChunkCount,
  };
}

async function tiktokInitializeVideo({
  accessToken,
  bytes,
  caption,
  privacyLevel,
}: {
  accessToken: string;
  bytes: Buffer;
  caption: string;
  privacyLevel: string;
}) {
  const {
    chunkSize,
    totalChunkCount,
  } =
    tiktokChunkPlan(
      bytes.length
    );

  const response =
    await fetch(
      "https://open.tiktokapis.com/v2/post/publish/video/init/",
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          "Content-Type":
            "application/json; charset=UTF-8",
        },

        body:
          JSON.stringify({
            post_info: {
              title:
                caption
                  .trim()
                  .slice(
                    0,
                    2200
                  ),

              privacy_level:
                privacyLevel,

              disable_duet:
                false,

              disable_comment:
                false,

              disable_stitch:
                false,

              /*
               * SOLO BEATS promotes its own
               * music/business through this
               * owner scheduler.
               */
              brand_organic_toggle:
                true,
            },

            source_info: {
              source:
                "FILE_UPLOAD",

              video_size:
                bytes.length,

              chunk_size:
                chunkSize,

              total_chunk_count:
                totalChunkCount,
            },
          }),
      }
    );

  const text =
    await response.text();

  let payload: any = {};

  try {
    payload =
      text
        ? JSON.parse(text)
        : {};
  } catch {
    throw new Error(
      `TIKTOK_VIDEO_INIT_INVALID: ${text.slice(
        0,
        1500
      )}`
    );
  }

  if (
    !response.ok ||
    payload?.error?.code !==
      "ok" ||
    typeof payload
      ?.data
      ?.publish_id !==
      "string" ||
    typeof payload
      ?.data
      ?.upload_url !==
      "string"
  ) {
    throw new Error(
      `TIKTOK_VIDEO_INIT_FAILED: ${
        payload?.error?.code ||
        response.status
      } ${
        payload?.error?.message ||
        text.slice(0, 1200)
      }`
    );
  }

  return {
    publishId:
      payload
        .data
        .publish_id as string,

    uploadUrl:
      payload
        .data
        .upload_url as string,

    chunkSize,
    totalChunkCount,
  };
}

async function tiktokUploadVideo({
  uploadUrl,
  bytes,
  chunkSize,
  totalChunkCount,
  contentType,
}: {
  uploadUrl: string;
  bytes: Buffer;
  chunkSize: number;
  totalChunkCount: number;
  contentType: string;
}) {
  for (
    let index = 0;
    index <
    totalChunkCount;
    index += 1
  ) {
    const start =
      index *
      chunkSize;

    const endExclusive =
      index ===
      totalChunkCount - 1
        ? bytes.length
        : Math.min(
            bytes.length,
            start +
              chunkSize
          );

    const chunk =
      bytes.subarray(
        start,
        endExclusive
      );

    if (
      chunk.length <= 0
    ) {
      throw new Error(
        "TIKTOK_UPLOAD_CHUNK_EMPTY"
      );
    }

    const maxAttempts =
      4;

    let uploaded =
      false;

    let lastError =
      "";

    for (
      let attempt = 1;
      attempt <= maxAttempts;
      attempt += 1
    ) {
      try {
        const response =
          await fetch(
            uploadUrl,
            {
              method:
                "PUT",

              headers: {
                "Content-Type":
                  contentType,

                "Content-Length":
                  String(
                    chunk.length
                  ),

                "Content-Range":
                  `bytes ${start}-${endExclusive - 1}/${bytes.length}`,
              },

              body:
                new Uint8Array(
                  chunk
                ),
            }
          );

        const responseText =
          await response.text();

        if (response.ok) {
          uploaded =
            true;

          break;
        }

        const detail =
          responseText.trim() ||
          response.statusText ||
          "EMPTY_RESPONSE_BODY";

        lastError =
          `HTTP ${response.status}: ${detail.slice(
            0,
            1500
          )}`;

        const retryable =
          response.status === 500 ||
          response.status === 502 ||
          response.status === 503 ||
          response.status === 504;

        if (
          !retryable ||
          attempt === maxAttempts
        ) {
          throw new Error(
            `TIKTOK_VIDEO_UPLOAD_FAILED_${response.status}: ${detail.slice(
              0,
              1500
            )}`
          );
        }
      }
      catch (error) {
        lastError =
          error instanceof Error
            ? error.message
            : String(error);

        if (
          attempt === maxAttempts
        ) {
          throw new Error(
            `TIKTOK_VIDEO_UPLOAD_RETRIES_EXHAUSTED: ${lastError}`
          );
        }
      }

      const delayMs =
        1500 * attempt;

      console.warn(
        `TikTok upload retry ${
          attempt
        }/${
          maxAttempts - 1
        } for chunk ${
          index + 1
        }/${
          totalChunkCount
        }`
      );

      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            delayMs
          )
      );
    }

    if (!uploaded) {
      throw new Error(
        `TIKTOK_VIDEO_UPLOAD_RETRIES_EXHAUSTED: ${
          lastError ||
          "UNKNOWN_ERROR"
        }`
      );
    }
  }
}


// ============================================================
// SOLO_TIKTOK_PHOTO_POST_V1
// TikTok Content Posting API - Photo Direct Post
// ============================================================

async function tiktokInitializePhoto({
  accessToken,
  title,
  description,
  privacyLevel,
  imageUrl,
}: {
  accessToken: string;
  title: string;
  description: string;
  privacyLevel: string;
  imageUrl: string;
}) {
  const response =
    await fetch(
      "https://open.tiktokapis.com/v2/post/publish/content/init/",
      {
        method:
          "POST",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          "Content-Type":
            "application/json; charset=UTF-8",
        },

        body:
          JSON.stringify({
            media_type:
              "PHOTO",

            post_mode:
              "DIRECT_POST",

            post_info: {
              title:
                title
                  .trim()
                  .slice(
                    0,
                    90
                  ),

              description:
                description
                  .trim()
                  .slice(
                    0,
                    4000
                  ),

              privacy_level:
                privacyLevel,

              disable_comment:
                false,

              auto_add_music:
                false,

              brand_organic_toggle:
                true,
            },

            source_info: {
              source:
                "PULL_FROM_URL",

              photo_cover_index:
                0,

              photo_images: [
                imageUrl,
              ],
            },
          }),
      }
    );

  const text =
    await response.text();

  let payload: any = {};

  try {
    payload =
      text
        ? JSON.parse(
            text
          )
        : {};
  }
  catch {
    throw new Error(
      `TIKTOK_PHOTO_INIT_INVALID: ${text.slice(
        0,
        1500
      )}`
    );
  }

  if (
    !response.ok ||
    payload?.error?.code !==
      "ok" ||
    typeof payload
      ?.data
      ?.publish_id !==
      "string" ||
    !payload
      .data
      .publish_id
  ) {
    throw new Error(
      `TIKTOK_PHOTO_INIT_FAILED: ${
        payload?.error?.code ||
        response.status
      } ${
        payload?.error?.message ||
        text.slice(
          0,
          1200
        )
      }`
    );
  }

  return {
    publishId:
      payload
        .data
        .publish_id as string,
  };
}

async function tiktokFetchStatus({
  accessToken,
  publishId,
}: {
  accessToken: string;
  publishId: string;
}) {
  const response =
    await fetch(
      "https://open.tiktokapis.com/v2/post/publish/status/fetch/",
      {
        method:
          "POST",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          "Content-Type":
            "application/json; charset=UTF-8",
        },

        body:
          JSON.stringify({
            publish_id:
              publishId,
          }),
      }
    );

  const text =
    await response.text();

  let payload: any = {};

  try {
    payload =
      text
        ? JSON.parse(text)
        : {};
  } catch {
    throw new Error(
      `TIKTOK_STATUS_RESPONSE_INVALID: ${text.slice(
        0,
        1500
      )}`
    );
  }

  if (
    !response.ok ||
    payload?.error?.code !==
      "ok"
  ) {
    throw new Error(
      `TIKTOK_STATUS_FAILED: ${
        payload?.error?.code ||
        response.status
      } ${
        payload?.error?.message ||
        text.slice(0, 1200)
      }`
    );
  }

  const status =
    typeof payload
      ?.data
      ?.status ===
      "string"
      ? payload.data.status
      : "";

  const failReason =
    typeof payload
      ?.data
      ?.fail_reason ===
      "string"
      ? payload
          .data
          .fail_reason
      : "";

  const postIdsRaw =
    Array.isArray(
      payload
        ?.data
        ?.publicaly_available_post_id
    )
      ? payload
          .data
          .publicaly_available_post_id
      : Array.isArray(
          payload
            ?.data
            ?.publicly_available_post_id
        )
        ? payload
            .data
            .publicly_available_post_id
        : [];

  const postIds =
    postIdsRaw
      .map(
        (value: unknown) =>
          String(value)
      )
      .filter(Boolean);

  return {
    status,
    failReason,
    postIds,
  };
}

async function claimTikTokPublish(
  ref: DocumentReference
) {
  return adminDb
    .runTransaction(
      async transaction => {
        const snapshot =
          await transaction
            .get(ref);

        if (!snapshot.exists) {
          throw new Error(
            "TIKTOK_QUEUE_POST_NOT_FOUND"
          );
        }

        const latest =
          snapshot.data() ||
          {};

        if (
          latest
            .tiktokPublishComplete ===
            true
        ) {
          return "already_published" as const;
        }

        const locked =
          latest
            .tiktokPublishLock ===
          true;

        let stale =
          false;

        const lockedAt =
          latest
            .tiktokPublishLockAt;

        if (
          locked &&
          lockedAt &&
          typeof lockedAt
            .toDate ===
            "function"
        ) {
          const age =
            Date.now() -
            lockedAt
              .toDate()
              .getTime();

          stale =
            age >
            20 *
              60 *
              1000;
        }

        if (
          locked &&
          !stale
        ) {
          return "already_publishing" as const;
        }

        transaction.set(
          ref,
          {
            tiktokPublishLock:
              true,

            tiktokPublishLockAt:
              FieldValue
                .serverTimestamp(),

            platformStatus: { tiktok: "publishing" },

            tiktokUploadStartedAt:
              FieldValue
                .serverTimestamp(),

            lastError:
              null,

            updatedAt:
              FieldValue
                .serverTimestamp(),
          },
          {
            merge:
              true,
          }
        );

        return "claimed" as const;
      }
    );
}

// ============================================================

async function youtubeAccessToken(
  encryptedRefreshToken: string
) {
  const clientId =
    process.env
      .YOUTUBE_CLIENT_ID
      ?.trim();

  const clientSecret =
    process.env
      .YOUTUBE_CLIENT_SECRET
      ?.trim();

  if (
    !clientId ||
    !clientSecret
  ) {
    throw new Error(
      "YOUTUBE_OAUTH_ENV_MISSING"
    );
  }

  const refreshToken =
    decrypt(
      encryptedRefreshToken
    );

  const response =
    await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          new URLSearchParams({
            client_id:
              clientId,

            client_secret:
              clientSecret,

            refresh_token:
              refreshToken,

            grant_type:
              "refresh_token",
          }),
      }
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    typeof data.access_token !==
      "string"
  ) {
    throw new Error(
      data.error_description ||
      data.error ||
      "YOUTUBE_TOKEN_REFRESH_FAILED"
    );
  }

  return data.access_token as string;
}

async function uploadYouTubeVideo({
  accessToken,
  bytes,
  title,
  description,
  tags,
  privacyStatus,
}: {
  accessToken: string;
  bytes: Buffer;
  title: string;
  description: string;
  tags: string[];
  privacyStatus:
    | "public"
    | "unlisted"
    | "private";
}) {
  const metadata = {
    snippet: {
      title:
        title
          .trim()
          .slice(
            0,
            100
          ) ||
        "SOLO BEATS",

      description:
        description
          .trim()
          .slice(
            0,
            5000
          ),

      categoryId:
        "10",

      tags:
        tags
          .filter(Boolean)
          .slice(0, 25),
    },

    status: {
      /*
       * SOLO_YOUTUBE_SELECTED_PRIVACY_V2
       * Honor Social Scheduler visibility exactly.
       */
      privacyStatus,

      selfDeclaredMadeForKids:
        false,
    },
  };

  const startResponse =
    await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status&notifySubscribers=false",
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          "Content-Type":
            "application/json; charset=UTF-8",

          "X-Upload-Content-Type":
            "video/mp4",

          "X-Upload-Content-Length":
            String(
              bytes.length
            ),
        },

        body:
          JSON.stringify(
            metadata
          ),
      }
    );

  if (!startResponse.ok) {
    const body =
      await startResponse.text();

    throw new Error(
      `YOUTUBE_UPLOAD_SESSION_FAILED: ${body.slice(
        0,
        3000
      )}`
    );
  }

  const uploadUrl =
    startResponse.headers.get(
      "location"
    );

  if (!uploadUrl) {
    throw new Error(
      "YOUTUBE_UPLOAD_LOCATION_MISSING"
    );
  }

  const uploadResponse =
    await fetch(
      uploadUrl,
      {
        method: "PUT",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          "Content-Type":
            "video/mp4",

          "Content-Length":
            String(
              bytes.length
            ),
        },

        body:
          new Uint8Array(
            bytes
          ),
      }
    );

  const responseText =
    await uploadResponse.text();

  if (!uploadResponse.ok) {
    throw new Error(
      `YOUTUBE_VIDEO_UPLOAD_FAILED: ${responseText.slice(
        0,
        3000
      )}`
    );
  }

  let video:
    any = {};

  try {
    video =
      JSON.parse(
        responseText
      );
  } catch {
    throw new Error(
      "YOUTUBE_UPLOAD_RESPONSE_INVALID"
    );
  }

  if (
    typeof video.id !==
    "string" ||
    !video.id
  ) {
    throw new Error(
      "YOUTUBE_VIDEO_ID_MISSING"
    );
  }

  return {
    videoId:
      video.id as string,

    privacyStatus:
      typeof video
        ?.status
        ?.privacyStatus ===
        "string"
        ? video
            .status
            .privacyStatus
        : "unknown",
  };
}


// ============================================================
// SOLO_INSTAGRAM_PUBLISHER_V1
// ============================================================

function sleep(ms: number) {
  return new Promise<void>(
    resolve => setTimeout(resolve, ms)
  );
}


// ============================================================
// SOLO_INSTAGRAM_ATOMIC_LOCK_V2
// ============================================================

async function claimInstagramPublish(
  ref: DocumentReference
) {
  return adminDb.runTransaction(
    async transaction => {
      const snapshot =
        await transaction.get(ref);

      if (!snapshot.exists) {
        throw new Error(
          "INSTAGRAM_QUEUE_POST_NOT_FOUND"
        );
      }

      const latest =
        snapshot.data() || {};

      if (
        typeof latest.instagramMediaId ===
          "string" &&
        latest.instagramMediaId
      ) {
        return "already_published" as const;
      }

      const locked =
        latest.instagramPublishLock ===
        true;

      let stale =
        false;

      const lockedAt =
        latest.instagramPublishLockAt;

      if (
        locked &&
        lockedAt &&
        typeof lockedAt.toDate ===
          "function"
      ) {
        const age =
          Date.now() -
          lockedAt
            .toDate()
            .getTime();

        stale =
          age >
          10 * 60 * 1000;
      }

      if (
        locked &&
        !stale
      ) {
        return "already_publishing" as const;
      }

      transaction.set(
        ref,
        {
          instagramPublishLock:
            true,

          instagramPublishLockAt:
            FieldValue.serverTimestamp(),

          platformStatus: { instagram: "publishing" },

          instagramUploadStartedAt:
            FieldValue.serverTimestamp(),

          lastError:
            null,

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        }
      );

      return "claimed" as const;
    }
  );
}
async function instagramPublicVideoUrl(
  storagePath: string,
  fallbackUrl: string
) {
  /*
   * Instagram must be able to fetch the MP4 from a public HTTPS URL.
   * Prefer a fresh Firebase signed URL generated server-side.
   */
  if (storagePath) {
    try {
      const [signedUrl] =
        await adminBucket
          .file(storagePath)
          .getSignedUrl({
            action: "read",
            expires:
              Date.now() +
              60 * 60 * 1000,
          });

      if (
        typeof signedUrl === "string" &&
        signedUrl.startsWith("https://")
      ) {
        return signedUrl;
      }
    } catch (error) {
      console.warn(
        "INSTAGRAM SIGNED VIDEO URL WARNING:",
        error
      );
    }
  }

  if (
    fallbackUrl &&
    fallbackUrl.startsWith("https://")
  ) {
    return fallbackUrl;
  }

  throw new Error(
    "INSTAGRAM_PUBLIC_VIDEO_URL_MISSING"
  );
}

async function instagramCreateImage({
  instagramAccountId,
  accessToken,
  imageUrl,
  caption,
}: {
  instagramAccountId: string;
  accessToken: string;
  imageUrl: string;
  caption: string;
}) {
  const response =
    await fetch(
      `https://graph.instagram.com/${encodeURIComponent(
        instagramAccountId
      )}/media`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          new URLSearchParams({
            image_url:
              imageUrl,

            caption:
              caption
                .trim()
                .slice(
                  0,
                  2200
                ),

            access_token:
              accessToken,
          }),
      }
    );

  const text =
    await response.text();

  let data: any = {};

  try {
    data =
      text
        ? JSON.parse(text)
        : {};
  }
  catch {
    throw new Error(
      `INSTAGRAM_IMAGE_RESPONSE_INVALID: ${text.slice(
        0,
        2000
      )}`
    );
  }

  if (
    !response.ok ||
    typeof data.id !== "string" ||
    !data.id
  ) {
    throw new Error(
      `INSTAGRAM_IMAGE_CREATE_FAILED: ${text.slice(
        0,
        3000
      )}`
    );
  }

  return data.id as string;
}

async function instagramCreateReel({
  instagramAccountId,
  accessToken,
  videoUrl,
  caption,
}: {
  instagramAccountId: string;
  accessToken: string;
  videoUrl: string;
  caption: string;
}) {
  const response =
    await fetch(
      `https://graph.instagram.com/${encodeURIComponent(
        instagramAccountId
      )}/media`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          new URLSearchParams({
            media_type: "REELS",
            video_url: videoUrl,
            caption:
              caption
                .trim()
                .slice(0, 2200),
            share_to_feed: "true",
            access_token: accessToken,
          }),
      }
    );

  const text =
    await response.text();

  let data: any = {};

  try {
    data =
      text
        ? JSON.parse(text)
        : {};
  } catch {
    throw new Error(
      `INSTAGRAM_CONTAINER_RESPONSE_INVALID: ${text.slice(
        0,
        2000
      )}`
    );
  }

  if (
    !response.ok ||
    typeof data.id !== "string" ||
    !data.id
  ) {
    throw new Error(
      `INSTAGRAM_CONTAINER_CREATE_FAILED: ${text.slice(
        0,
        3000
      )}`
    );
  }

  return data.id as string;
}

async function waitForInstagramContainer({
  creationId,
  accessToken,
}: {
  creationId: string;
  accessToken: string;
}) {
  for (
    let attempt = 0;
    attempt < 36;
    attempt += 1
  ) {
    const url =
      new URL(
        `https://graph.instagram.com/${encodeURIComponent(
          creationId
        )}`
      );

    url.searchParams.set(
      "fields",
      "status_code,status"
    );

    url.searchParams.set(
      "access_token",
      accessToken
    );

    const response =
      await fetch(
        url.toString(),
        {
          cache: "no-store",
        }
      );

    const text =
      await response.text();

    let data: any = {};

    try {
      data =
        text
          ? JSON.parse(text)
          : {};
    } catch {
      throw new Error(
        `INSTAGRAM_STATUS_RESPONSE_INVALID: ${text.slice(
          0,
          2000
        )}`
      );
    }

    if (!response.ok) {
      throw new Error(
        `INSTAGRAM_CONTAINER_STATUS_FAILED: ${text.slice(
          0,
          3000
        )}`
      );
    }

    const statusCode =
      typeof data.status_code === "string"
        ? data.status_code.toUpperCase()
        : "";

    if (
      statusCode === "FINISHED" ||
      statusCode === "PUBLISHED"
    ) {
      return;
    }

    if (
      statusCode === "ERROR" ||
      statusCode === "EXPIRED"
    ) {
      throw new Error(
        `INSTAGRAM_CONTAINER_${statusCode}: ${
          typeof data.status === "string"
            ? data.status
            : "Instagram could not process the Reel."
        }`
      );
    }

    await sleep(5000);
  }

  throw new Error(
    "INSTAGRAM_CONTAINER_PROCESSING_TIMEOUT"
  );
}

async function instagramPublishReel({
  instagramAccountId,
  accessToken,
  creationId,
}: {
  instagramAccountId: string;
  accessToken: string;
  creationId: string;
}) {
  const response =
    await fetch(
      `https://graph.instagram.com/${encodeURIComponent(
        instagramAccountId
      )}/media_publish`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          new URLSearchParams({
            creation_id: creationId,
            access_token: accessToken,
          }),
      }
    );

  const text =
    await response.text();

  let data: any = {};

  try {
    data =
      text
        ? JSON.parse(text)
        : {};
  } catch {
    throw new Error(
      `INSTAGRAM_PUBLISH_RESPONSE_INVALID: ${text.slice(
        0,
        2000
      )}`
    );
  }

  if (
    !response.ok ||
    typeof data.id !== "string" ||
    !data.id
  ) {
    throw new Error(
      `INSTAGRAM_REEL_PUBLISH_FAILED: ${text.slice(
        0,
        3000
      )}`
    );
  }

  return data.id as string;
}

async function instagramPermalink({
  mediaId,
  accessToken,
}: {
  mediaId: string;
  accessToken: string;
}) {
  try {
    const url =
      new URL(
        `https://graph.instagram.com/${encodeURIComponent(
          mediaId
        )}`
      );

    url.searchParams.set(
      "fields",
      "permalink"
    );

    url.searchParams.set(
      "access_token",
      accessToken
    );

    const response =
      await fetch(
        url.toString(),
        {
          cache: "no-store",
        }
      );

    const data =
      await response.json();

    return (
      response.ok &&
      typeof data?.permalink === "string"
    )
      ? data.permalink
      : "";
  } catch {
    return "";
  }
}
async function facebookPublishPhoto({
  pageId,
  accessToken,
  imageUrl,
  caption,
}: {
  pageId: string;
  accessToken: string;
  imageUrl: string;
  caption: string;
}) {
  const graphVersion =
    process.env.META_GRAPH_VERSION ||
    process.env.FACEBOOK_GRAPH_VERSION ||
    "v24.0";

  const response =
    await fetch(
      `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(
        pageId
      )}/photos`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          new URLSearchParams({
            url:
              imageUrl,

            caption:
              caption.slice(
                0,
                5000
              ),

            published:
              "true",

            access_token:
              accessToken,
          }),
      }
    );

  const responseText =
    await response.text();

  let data: any = {};

  try {
    data =
      responseText
        ? JSON.parse(
            responseText
          )
        : {};
  }
  catch {
    data = {};
  }

  if (
    !response.ok ||
    typeof data.id !== "string" ||
    !data.id
  ) {
    throw new Error(
      data?.error?.message ||
      responseText ||
      "Facebook image publishing failed."
    );
  }

  return String(data.id);
}

async function facebookPublishVideo({
  pageId,
  accessToken,
  videoUrl,
  caption,
}: {
  pageId: string;
  accessToken: string;
  videoUrl: string;
  caption: string;
}) {
  const graphVersion =
    process.env.META_GRAPH_VERSION ||
    process.env.FACEBOOK_GRAPH_VERSION ||
    "v24.0";

  const response =
    await fetch(
      `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(
        pageId
      )}/videos`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          new URLSearchParams({
            file_url: videoUrl,
            description:
              caption.slice(0, 5000),
            published: "true",
            access_token:
              accessToken,
          }),
      }
    );

  const responseText =
    await response.text();

  let data: any = {};

  try {
    data =
      responseText
        ? JSON.parse(responseText)
        : {};
  } catch {
    data = {};
  }

  if (
    !response.ok ||
    typeof data.id !== "string" ||
    !data.id
  ) {
    throw new Error(
      data?.error?.message ||
      responseText ||
      "Facebook video publishing failed."
    );
  }

  return String(data.id);
}

async function claimFacebookPublish(
  ref: any
) {
  return adminDb.runTransaction(
    async transaction => {
      const snapshot: any =
        await transaction.get(
          ref
        );

      const data =
        snapshot.data() || {};

      if (
        typeof data.facebookVideoId ===
          "string" &&
        data.facebookVideoId
      ) {
        return "already_published";
      }

      const lockAt =
        data.facebookPublishLockAt;

      const lockTime =
        lockAt &&
        typeof lockAt.toMillis ===
          "function"
          ? lockAt.toMillis()
          : 0;

      const freshLock =
        data.facebookPublishLock ===
          true &&
        lockTime > 0 &&
        Date.now() - lockTime <
          15 * 60 * 1000;

      if (freshLock) {
        return "already_publishing";
      }

      transaction.set(
        ref,
        {
          facebookPublishLock:
            true,

          facebookPublishLockAt:
            FieldValue
              .serverTimestamp(),

          platformStatus: { facebook: "publishing" },

          updatedAt:
            FieldValue
              .serverTimestamp(),
        },
        {
          merge: true,
        }
      );

      return "claimed";
    }
  );
}

// ============================================================
// SOLO_YOUTUBE_ATOMIC_LOCK_V2
// Only one publisher process may start a YouTube upload.
// ============================================================

async function claimYouTubePublish(
  ref: DocumentReference
) {
  return adminDb.runTransaction(
    async transaction => {
      const snapshot =
        await transaction.get(ref);

      if (!snapshot.exists) {
        return false;
      }

      const latest =
        snapshot.data() || {};

      if (
        typeof latest.youtubeVideoId ===
          "string" &&
        latest.youtubeVideoId.trim()
      ) {
        return false;
      }

      const lockAt =
        latest.youtubePublishLockAt &&
        typeof latest.youtubePublishLockAt
          .toMillis === "function"
          ? latest.youtubePublishLockAt
              .toMillis()
          : 0;

      const lockIsFresh =
        latest.youtubePublishLock ===
          true &&
        lockAt > 0 &&
        Date.now() - lockAt <
          15 * 60 * 1000;

      if (lockIsFresh) {
        return false;
      }

      transaction.set(
        ref,
        {
          youtubePublishLock: true,

          youtubePublishLockAt:
            FieldValue.serverTimestamp(),

          platformStatus: { youtube: "publishing" },

          youtubeUploadStartedAt:
            FieldValue.serverTimestamp(),

          lastError: null,

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        }
      );

      return true;
    }
  );
}

// ============================================================
// SOLO_RECURRING_UNTIL_CANCELLED_V1
// Creates exactly one next occurrence after successful publish.
// Series document prevents duplicate next-post creation.
// ============================================================

async function createNextRecurringOccurrence(
  document: DocumentReference,
  data: any
) {
  if (
    data.recurringEnabled !== true ||
    data.recurringUntilCancelled !== true ||
    data.recurringSeriesCancelled === true
  ) {
    return;
  }

  const recurringGroupId =
    typeof data.recurringGroupId === "string"
      ? data.recurringGroupId.trim()
      : "";

  if (!recurringGroupId) {
    return;
  }

  const frequencyDays =
    data.recurringFrequencyDays === 7
      ? 7
      : data.recurringFrequencyDays === 3
        ? 3
        : data.recurringFrequencyDays === 2
          ? 2
          : 1;

  const currentIndex =
    typeof data.recurringIndex === "number"
      ? data.recurringIndex
      : 0;

  const currentScheduledFor =
    typeof data.scheduledFor === "string"
      ? data.scheduledFor
      : "";

  const currentTime =
    Date.parse(
      currentScheduledFor
    );

  if (!Number.isFinite(currentTime)) {
    return;
  }

  const seriesRef =
    adminDb
      .collection(
        "socialRecurringSeries"
      )
      .doc(recurringGroupId);

  await adminDb.runTransaction(
    async transaction => {
      const seriesSnapshot =
        await transaction.get(
          seriesRef
        );

      if (!seriesSnapshot.exists) {
        return;
      }

      const series =
        seriesSnapshot.data() || {};

      if (series.active !== true) {
        return;
      }

      const nextIndex =
        currentIndex + 1;

      const lastGeneratedIndex =
        typeof series.lastGeneratedIndex ===
        "number"
          ? series.lastGeneratedIndex
          : 0;

      if (
        lastGeneratedIndex >=
        nextIndex
      ) {
        return;
      }

      const nextDate =
        new Date(currentTime);

      nextDate.setDate(
        nextDate.getDate() +
        frequencyDays
      );

      const nextRef =
        adminDb
          .collection(
            "socialPromotionQueue"
          )
          .doc();

      const rotationImages =
        Array.isArray(
          data.imageRotationImages
        )
          ? data.imageRotationImages.filter(
              (item: any) =>
                item &&
                typeof item.previewUrl ===
                  "string" &&
                item.previewUrl &&
                typeof item.storagePath ===
                  "string" &&
                item.storagePath
            )
          : [];

      const rotationEnabled =
        data.mediaType === "image" &&
        data.imageRotationEnabled === true &&
        rotationImages.length > 1;

      const nextRotationIndex =
        rotationEnabled
          ? (
              nextIndex %
              rotationImages.length
            )
          : 0;

      const nextRotationImage =
        rotationEnabled
          ? rotationImages[
              nextRotationIndex
            ]
          : null;

      const rotationVideoClips =
        Array.isArray(
          data.videoRotationClips
        )
          ? data.videoRotationClips.filter(
              (item: any) =>
                item &&
                typeof item.videoStoragePath ===
                  "string" &&
                item.videoStoragePath
            )
          : [];

      const videoRotationEnabled =
        data.videoRotationEnabled === true &&
        rotationVideoClips.length > 1;

      const nextVideoRotationIndex =
        videoRotationEnabled
          ? (
              nextIndex %
              rotationVideoClips.length
            )
          : 0;

      const nextVideoRotationClip =
        videoRotationEnabled
          ? rotationVideoClips[
              nextVideoRotationIndex
            ]
          : null;

      // ============================================================
      // SOLO_RECURRING_TIKTOK_INHERITANCE_V1
      // Persist TikTok selection for recurring-series descendants.
      // ============================================================

      const inheritedPlatforms =
        Array.isArray(data.platforms)
          ? data.platforms.filter(
              (item: unknown) =>
                typeof item === "string"
            )
          : [];

      const nextPlatforms =
        series.tiktokEnabled === true
          ? Array.from(
              new Set([
                ...inheritedPlatforms,
                "tiktok",
              ])
            )
          : inheritedPlatforms;

      const nextData:
        Record<string, any> = {
          ...data,

          platforms:
            nextPlatforms,

          postId:
            nextRef.id,

          videoRotationIndex:
            nextVideoRotationIndex,

          videoMediaId:
            nextVideoRotationClip
              ? (
                  nextVideoRotationClip
                    .sourceMediaId ||
                  data.videoMediaId
                )
              : data.videoMediaId,

          videoStoragePath:
            nextVideoRotationClip
              ? nextVideoRotationClip
                  .videoStoragePath
              : data.videoStoragePath,

          imageRotationIndex:
            nextRotationIndex,

          imageUrl:
            nextRotationImage
              ? nextRotationImage.previewUrl
              : data.imageUrl,

          imageStoragePath:
            nextRotationImage
              ? nextRotationImage.storagePath
              : data.imageStoragePath,

          status:
            "scheduled",

          scheduledFor:
            nextDate.toISOString(),

          recurringIndex:
            nextIndex,

          recurringEnabled:
            true,

          recurringUntilCancelled:
            true,

          recurringSeriesCancelled:
            false,

          recurringGroupId,

          retryCount: 0,
          maxRetries:
            typeof data.maxRetries ===
              "number"
              ? data.maxRetries
              : 3,

          publishedUrls: {},
          platformStatus: {},
          publishLog: [],
          lastError: null,

          createdAt:
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp(),
        };

      const removeFields = [
        "publishedAt",
        "cancelledAt",

        "youtubeVideoId",
        "youtubeUploadedAt",
        "youtubePublishLock",
        "youtubePublishLockAt",
        "youtubeUploadStartedAt",
        "youtubeExistingVideo",
        "youtubeExistingVideoRecognizedAt",

        "instagramMediaId",
        "instagramContainerId",
        "instagramPublishedAt",
        "instagramPublishLock",
        "instagramPublishLockAt",
        "instagramUploadStartedAt",

        "facebookVideoId",
        "facebookPublishedAt",
        "facebookPublishLock",
        "facebookPublishLockAt",

        "cancelledFromPostId",
      ];

      for (
        const field of removeFields
      ) {
        delete nextData[field];
      }

      transaction.set(
        nextRef,
        nextData
      );

      transaction.set(
        seriesRef,
        {
          lastGeneratedIndex:
            nextIndex,

          nextPostId:
            nextRef.id,

          lastPublishedPostId:
            document.id,

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        }
      );
    }
  );
}

export async function runSocialPublisher() {
  const connectionRef =
    adminDb
      .collection(
        "socialPlatformConnections"
      )
      .doc("owner");

  const connectionSnapshot =
    await connectionRef.get();

  const connection =
    connectionSnapshot.data() || {};

  // ============================================================
  // CONNECTIONS
  // ============================================================

  const youtubeConnected =
    connection.youtubeConnected === true;

  const encryptedRefreshToken =
    typeof connection
      .youtubeRefreshTokenEncrypted ===
      "string"
      ? connection
          .youtubeRefreshTokenEncrypted
      : "";

  const instagramConnected =
    connection.instagramConnected ===
      true &&
    typeof connection
      .instagramAccessTokenEncrypted ===
      "string" &&
    connection
      .instagramAccessTokenEncrypted
      .trim().length > 0;

  const instagramAccountId =
    typeof connection
      .instagramAccountId ===
      "string"
      ? connection
          .instagramAccountId
          .trim()
      : "";

  const encryptedInstagramToken =
    typeof connection
      .instagramAccessTokenEncrypted ===
      "string"
      ? connection
          .instagramAccessTokenEncrypted
      : "";

  const facebookConnected =
    connection
      .facebookConnected ===
      true;

  const facebookPageId =
    typeof connection
      .facebookPageId ===
      "string"
      ? connection
          .facebookPageId
          .trim()
      : "";

  const encryptedFacebookPageToken =
    typeof connection
      .facebookPageAccessTokenEncrypted ===
      "string"
      ? connection
          .facebookPageAccessTokenEncrypted
          .trim()
      : "";

  const tiktokConnected =
    connection
      .tiktokConnected ===
      true &&
    typeof connection
      .tiktokAccessTokenEncrypted ===
      "string" &&
    connection
      .tiktokAccessTokenEncrypted
      .trim().length > 0;

  // ============================================================
  // LOAD DUE POSTS
  // ============================================================

  const now =
    Date.now();

  const snapshot =
    await adminDb
      .collection(
        "socialPromotionQueue"
      )
      .where(
        "status",
        "==",
        "scheduled"
      )
      .get();

  function scheduledTime(
    value: unknown
  ) {
    if (
      typeof value === "string"
    ) {
      const parsed =
        Date.parse(value);

      return Number.isFinite(parsed)
        ? parsed
        : NaN;
    }

    if (
      value &&
      typeof value === "object" &&
      "toMillis" in value &&
      typeof (value as {
        toMillis?: unknown;
      }).toMillis === "function"
    ) {
      return (
        value as {
          toMillis: () => number;
        }
      ).toMillis();
    }

    return NaN;
  }

  const due =
    snapshot.docs
      .map(document => ({
        document,
        time:
          scheduledTime(
            document.data()
              .scheduledFor
          ),
      }))
      .filter(item =>
        Number.isFinite(
          item.time
        ) &&
        item.time <= now
      )
      .sort(
        (a, b) =>
          a.time - b.time
      )
      .slice(0, 50)
      .map(
        item =>
          item.document
      );
  const results:
    QueueResult[] = [];

  // ============================================================
  // PROCESS POSTS
  // ============================================================

  for (
    const document of due
  ) {
    const data =
      document.data();
    // ============================================================
    // SOLO_RETRY_LIMITER_V1
    // Never process a scheduled item after its retry limit.
    // ============================================================

    const currentRetryCount =
      typeof data.retryCount === "number"
        ? data.retryCount
        : 0;

    const configuredMaxRetries =
      typeof data.maxRetries === "number" &&
      data.maxRetries > 0
        ? data.maxRetries
        : 3;

    if (
      currentRetryCount >=
      configuredMaxRetries
    ) {
      await document.ref.set(
        {
          status: "failed",

          retryCount:
            configuredMaxRetries,

          maxRetries:
            configuredMaxRetries,

          lastError:
            typeof data.lastError === "string" &&
            data.lastError.trim()
              ? data.lastError
              : "MAX_RETRIES_REACHED",

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        }
      );

      continue;
    }


    const platforms =
      Array.isArray(
        data.platforms
      )
        ? data.platforms
        : [];

    let youtube:
      QueueResult["youtube"] =
        "not_selected";

    let instagram:
      QueueResult["instagram"] =
        "not_selected";

    let youtubeUrl:
      string | undefined;

    let instagramUrl:
      string | undefined;

    let tiktok:
      QueueResult["tiktok"] =
        "not_selected";

    let tiktokUrl:
      string | undefined;

    let resultError:
      string | undefined;

    // ============================================================
    // YOUTUBE
    // ============================================================

    if (
      platforms.includes(
        "youtube"
      )
    ) {
      // SOLO_EXISTING_YOUTUBE_VIDEO_V1
      const selectedExistingYoutubeUrl =
  data.youtubeContentType === "long"
    ? (
        typeof data.youtubeLongVideoUrl === "string" &&
        data.youtubeLongVideoUrl.trim()
          ? data.youtubeLongVideoUrl.trim()
          : (
              typeof data.youtubeVideoUrl === "string"
                ? data.youtubeVideoUrl.trim()
                : ""
            )
      )
    : (
        typeof data.youtubeShortVideoUrl === "string" &&
        data.youtubeShortVideoUrl.trim()
          ? data.youtubeShortVideoUrl.trim()
          : (
              typeof data.youtubeVideoUrl === "string"
                ? data.youtubeVideoUrl.trim()
                : ""
            )
      );

if (
  data.videoSource === "youtube" &&
  selectedExistingYoutubeUrl
) {
        youtube = "existing_verified";
        youtubeUrl =
          data.youtubeVideoUrl.trim();

        await document.ref.set(
          {
            platformStatus: { youtube: "existing_verified" },

            publishedUrls: { youtube: youtubeUrl },

            youtubeExistingVideo:
              true,

            youtubeExistingVideoRecognizedAt:
              FieldValue.serverTimestamp(),

            lastError: null,

            publishLog:
              FieldValue.arrayUnion({
                platform: "youtube",
                result:
                  "existing_video",
                url: youtubeUrl,
                at:
                  new Date()
                    .toISOString(),
              }),

            updatedAt:
              FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
      else if (
        typeof data
          .youtubeVideoId ===
          "string" &&
        data.youtubeVideoId
      ) {
        youtube =
          "already_uploaded";

        youtubeUrl =
          typeof data
            ?.publishedUrls
            ?.youtube ===
            "string"
            ? data
                .publishedUrls
                .youtube
            : undefined;
      }
      else if (
        !youtubeConnected ||
        !encryptedRefreshToken
      ) {
        youtube =
          "not_connected";

        await document.ref.set(
          {
            platformStatus: { youtube: "waiting_connection" },

            lastError:
              "YouTube is not connected.",

            updatedAt:
              FieldValue
                .serverTimestamp(),
          },
          {
            merge: true,
          }
        );
      }
      else {
        const storagePath =
          typeof data
            .videoStoragePath ===
            "string"
            ? data
                .videoStoragePath
            : "";

        if (!storagePath) {
          youtube =
            "failed";

          resultError =
            "Scheduled post has no permanent videoStoragePath.";

          await document.ref.set(
            {
              platformStatus: { youtube: "failed" },

              lastError:
                resultError,

              updatedAt:
                FieldValue
                  .serverTimestamp(),
            },
            {
              merge: true,
            }
          );
        }
        else {
          try {
            const youtubeClaimed =
              await claimYouTubePublish(
                document.ref
              );

            if (!youtubeClaimed) {
              throw new Error(
                "YOUTUBE_UPLOAD_ALREADY_CLAIMED"
              );
            }

            const [bytes] =
              await adminBucket
                .file(
                  storagePath
                )
                .download();

            const accessToken =
              await youtubeAccessToken(
                encryptedRefreshToken
              );

            // SOLO_YOUTUBE_AUTO_SEO_V1
            const normalTitle =
              typeof data.title === "string" &&
              data.title.trim()
                ? data.title.trim()
                : "SOLO BEATS";

            const trackName =
              typeof data.trackTitle === "string" &&
              data.trackTitle.trim()
                ? data.trackTitle.trim()
                : normalTitle;

            const seoEnabled =
              data.youtubeSeoEnabled !== false;

            const isLong =
              data.youtubeContentType === "long";

            const manualShortTitle =
              typeof data.youtubeShortTitle === "string"
                ? data.youtubeShortTitle.trim()
                : "";

            const manualLongTitle =
              typeof data.youtubeLongTitle === "string"
                ? data.youtubeLongTitle.trim()
                : "";

            // ============================================================
            // SOLO_YOUTUBE_SHORT_TITLE_CLEANUP_V2
            // Prevent generic uploaded filenames from becoming public
            // YouTube Short titles.
            // ============================================================

            const shortTrackName =
              trackName.trim();

            const genericShortName =
              /^(video|vid|img|clip|recording|untitled)(?:[\s_-]+[a-z0-9]{3,})?$/i.test(
                shortTrackName
              ) ||
              /^(img|vid)[-_]?\d{3,}$/i.test(
                shortTrackName
              ) ||
              /^video[-_ ]?[a-z0-9]{4,}$/i.test(
                shortTrackName
              );

            const autoShortTitle =
              genericShortName
                ? "Solo Beats | New Music #Shorts"
                : `${shortTrackName} | Solo Beats #Shorts`;

            const autoLongTitle =
              `${trackName} - Solo Beats | Official Music Video`;

            const title =
              isLong
                ? (
                    manualLongTitle ||
                    (seoEnabled
                      ? autoLongTitle
                      : normalTitle)
                  )
                : (
                    manualShortTitle ||
                    (seoEnabled
                      ? autoShortTitle
                      : normalTitle)
                  );

            const fallbackDescription =
              typeof data.caption === "string"
                ? data.caption.trim()
                : "";

            const manualDescription =
              isLong
                ? (
                    typeof data.youtubeLongDescription === "string"
                      ? data.youtubeLongDescription.trim()
                      : ""
                  )
                : (
                    typeof data.youtubeShortDescription === "string"
                      ? data.youtubeShortDescription.trim()
                      : ""
                  );

            const hashtags =
              isLong
                ? "#SoloBeats #NewMusic #MusicVideo"
                : "#Shorts #SoloBeats #NewMusic";

            const seoIntro =
              isLong
                ? `${trackName} by Solo Beats. Official music video from SOLO BEATS ENGINE MUSIC.`
                : `${trackName} by Solo Beats. Discover more music from SOLO BEATS ENGINE MUSIC.`;

            const seoFooter =
              `Discover more: https://www.solobeatsenginemusic.com\n\n${hashtags}`;

            const description =
              seoEnabled
                ? (
                    manualDescription
                      ? `${manualDescription}\n\n${seoFooter}`
                      : fallbackDescription
                        ? `${seoIntro}\n\n${fallbackDescription}\n\n${seoFooter}`
                        : `${seoIntro}\n\n${seoFooter}`
                  )
                : (
                    manualDescription ||
                    fallbackDescription
                  );

            const tags = Array.from(
              new Set(
                [
                  trackName,
                  `${trackName} Solo Beats`,
                  "Solo Beats",
                  "SOLO BEATS ENGINE MUSIC",
                  isLong
                    ? "official music video"
                    : "music short",
                  isLong
                    ? "music video"
                    : "YouTube Shorts",
                  "new music",
                  "independent music",
                ]
                  .map(value => value.trim())
                  .filter(Boolean)
              )
            );

            const requestedYoutubePrivacyStatus:
              | "public"
              | "unlisted"
              | "private" =
                data.youtubePrivacyStatus ===
                "private"
                  ? "private"
                  : data.youtubePrivacyStatus ===
                    "unlisted"
                    ? "unlisted"
                    : "public";
            const uploaded =
              await uploadYouTubeVideo({
                accessToken,
                bytes,
                title,
                description,
                tags,
                privacyStatus:
                  requestedYoutubePrivacyStatus,
              });

            youtubeUrl =
              `https://www.youtube.com/watch?v=${uploaded.videoId}`;

            const acceptedYoutubePrivacy =
              uploaded.privacyStatus ===
                "public" ||
              uploaded.privacyStatus ===
                "unlisted" ||
              uploaded.privacyStatus ===
                "private";

            const publicUpload =
              uploaded.privacyStatus ===
              "public";

            youtube =
              acceptedYoutubePrivacy
                ? (
                    uploaded.privacyStatus ===
                    "unlisted"
                      ? "uploaded_unlisted"
                      : uploaded.privacyStatus ===
                        "private"
                        ? "uploaded_private"
                        : "uploaded_public"
                  )
                : "failed";

            await document.ref.set(
              {
                youtubeVideoId:
                  uploaded.videoId,

                youtubePrivacyStatus:
                  uploaded
                    .privacyStatus,

                publishedUrls: { youtube: youtubeUrl },

                platformStatus: { youtube: acceptedYoutubePrivacy ? "published" : "failed" },

                youtubeUploadedAt:
                  FieldValue
                    .serverTimestamp(),

                youtubePublishLock:
                  FieldValue.delete(),

                youtubePublishLockAt:
                  FieldValue.delete(),

                lastError:
                  acceptedYoutubePrivacy
                    ? null
                    : "YouTube returned an unsupported privacy status.",

                publishLog:
                  FieldValue
                    .arrayUnion({
                      platform:
                        "youtube",

                      result:
                        acceptedYoutubePrivacy
                          ? "published"
                          : "failed",

                      videoId:
                        uploaded.videoId,

                      url:
                        youtubeUrl,

                      privacyStatus:
                        uploaded
                          .privacyStatus,

                      at:
                        new Date()
                          .toISOString(),
                    }),

                updatedAt:
                  FieldValue
                    .serverTimestamp(),
              },
              {
                merge: true,
              }
            );
          }
          catch (error) {
            youtube =
              "failed";

            const message =
              error instanceof Error
                ? error.message
                : "YouTube upload failed.";

            resultError =
              message;

            const maxRetries =
              typeof data.maxRetries === "number" &&
              data.maxRetries > 0
                ? data.maxRetries
                : 3;

            const retryCount =
              Math.min(
                typeof data.retryCount === "number"
                  ? data.retryCount + 1
                  : 1,
                maxRetries
              );

            await document.ref.set(
              {
                platformStatus: { youtube: "failed" },

                youtubePublishLock:
                  FieldValue.delete(),

                youtubePublishLockAt:
                  FieldValue.delete(),

                retryCount,

                lastError:
                  message.slice(
                    0,
                    5000
                  ),

                publishLog:
                  FieldValue
                    .arrayUnion({
                      platform:
                        "youtube",

                      result:
                        "failed",

                      error:
                        message.slice(
                          0,
                          1000
                        ),

                      at:
                        new Date()
                          .toISOString(),
                    }),

                updatedAt:
                  FieldValue
                    .serverTimestamp(),
              },
              {
                merge: true,
              }
            );
          }
        }
      }
    }

    // ============================================================
    // INSTAGRAM REELS
    // ============================================================

    if (
      platforms.includes(
        "instagram"
      )
    ) {
      if (
        typeof data
          .instagramMediaId ===
          "string" &&
        data.instagramMediaId
      ) {
        instagram =
          "already_published";

        instagramUrl =
          typeof data
            ?.publishedUrls
            ?.instagram ===
            "string"
            ? data
                .publishedUrls
                .instagram
            : undefined;
      }
      else if (
        !instagramConnected ||
        !instagramAccountId ||
        !encryptedInstagramToken
      ) {
        instagram =
          "not_connected";

        await document.ref.set(
          {
            platformStatus: { instagram: "waiting_connection" },

            lastError:
              "Instagram is not connected.",

            updatedAt:
              FieldValue
                .serverTimestamp(),
          },
          {
            merge: true,
          }
        );
      }
      else {
        try {
          const claim =
            await claimInstagramPublish(
              document.ref
            );

          if (
            claim ===
            "already_published"
          ) {
            instagram =
              "already_published";
          }
          else if (
            claim ===
            "already_publishing"
          ) {
            instagram =
              "already_publishing";
          }
          else {
            const accessToken =
              decrypt(
                encryptedInstagramToken
              );

            const isImagePost =
              data.mediaType ===
              "image";

            const storagePath =
              isImagePost
                ? (
                    typeof data
                      .imageStoragePath ===
                      "string"
                      ? data
                          .imageStoragePath
                      : ""
                  )
                : (
                    typeof data
                      .videoStoragePath ===
                      "string"
                      ? data
                          .videoStoragePath
                      : ""
                  );

            const fallbackUrl =
              isImagePost
                ? (
                    typeof data.imageUrl ===
                    "string"
                      ? data.imageUrl
                      : ""
                  )
                : (
                    typeof data.videoUrl ===
                    "string"
                      ? data.videoUrl
                      : ""
                  );

            const mediaUrl =
              await instagramPublicVideoUrl(
                storagePath,
                fallbackUrl
              );

            // SOLO_INSTAGRAM_OPTIMIZATION_V1
            const baseCaption =
              typeof data.caption === "string"
                ? data.caption.trim()
                : "";

            const trackName =
              typeof data.trackTitle === "string" &&
              data.trackTitle.trim()
                ? data.trackTitle.trim()
                : (
                    typeof data.title === "string"
                      ? data.title.trim()
                      : "Solo Beats"
                  );

            const manualInstagramCaption =
              typeof data.instagramCaption === "string"
                ? data.instagramCaption.trim()
                : "";

            const instagramOptimizationEnabled =
              data.instagramOptimizationEnabled !== false;

            const instagramHashtags =
              "#SoloBeats #NewMusic #MusicReels #IndependentArtist #ElectronicMusic #MusicDiscovery #NowPlaying #ReelsMusic";

            const instagramAutoCaption =
              `${trackName} by Solo Beats\n\n` +
              `Turn it up and discover more original music from SOLO BEATS ENGINE MUSIC.\n\n` +
              `Listen. Follow. Share.\n` +
              `https://www.solobeatsenginemusic.com\n\n` +
              instagramHashtags;

            const caption =
              manualInstagramCaption ||
              (
                instagramOptimizationEnabled
                  ? (
                      baseCaption
                        ? `${baseCaption}\n\n${instagramAutoCaption}`
                        : instagramAutoCaption
                    )
                  : baseCaption
              );
            const creationId =
              isImagePost
                ? await instagramCreateImage({
                    instagramAccountId,
                    accessToken,
                    imageUrl:
                      mediaUrl,
                    caption,
                  })
                : await instagramCreateReel({
                    instagramAccountId,
                    accessToken,
                    videoUrl:
                      mediaUrl,
                    caption,
                  });

            await document.ref.set(
              {
                instagramContainerId:
                  creationId,

                updatedAt:
                  FieldValue
                    .serverTimestamp(),
              },
              {
                merge: true,
              }
            );

            await waitForInstagramContainer({
              creationId,
              accessToken,
            });

            const mediaId =
              await instagramPublishReel({
                instagramAccountId,
                accessToken,
                creationId,
              });

            const permalink =
              await instagramPermalink({
                mediaId,
                accessToken,
              });

            instagram =
              "published";

            instagramUrl =
              permalink ||
              undefined;

            const instagramUpdate:
              Record<string, any> = {
                instagramMediaId:
                  mediaId,

                instagramPublishLock:
                  FieldValue.delete(),

                instagramPublishLockAt:
                  FieldValue.delete(),

                platformStatus: { instagram: "published" },

                instagramPublishedAt:
                  FieldValue
                    .serverTimestamp(),

                lastError:
                  null,

                publishLog:
                  FieldValue
                    .arrayUnion({
                      platform:
                        "instagram",

                      result:
                        "published",

                      mediaId,

                      url:
                        permalink ||
                        null,

                      at:
                        new Date()
                          .toISOString(),
                    }),

                updatedAt:
                  FieldValue
                    .serverTimestamp(),
              };

            if (permalink) {
              instagramUpdate.publishedUrls = { ...(instagramUpdate.publishedUrls || {}), instagram: permalink };
            }

            await document.ref.set(
              instagramUpdate,
              {
                merge: true,
              }
            );
          }
        }
        catch (error) {
          instagram =
            "failed";

          const message =
            error instanceof Error
              ? error.message
              : "Instagram Reel publishing failed.";

          resultError =
            message;

          const resetTikTokPublishId =
            message.startsWith(
              "TIKTOK_VIDEO_UPLOAD_FAILED_"
            ) ||
            message.startsWith(
              "TIKTOK_VIDEO_UPLOAD_RETRIES_EXHAUSTED:"
            ) ||
            message.startsWith(
              "TIKTOK_VIDEO_UPLOAD_NETWORK_FAILED:"
            );

          const maxRetries =
              typeof data.maxRetries === "number" &&
              data.maxRetries > 0
                ? data.maxRetries
                : 3;

            const retryCount =
              Math.min(
                typeof data.retryCount === "number"
                  ? data.retryCount + 1
                  : 1,
                maxRetries
              );

          await document.ref.set(
            {
              instagramPublishLock:
                FieldValue.delete(),

              instagramPublishLockAt:
                FieldValue.delete(),

              platformStatus: { instagram: "failed" },

              retryCount,

              lastError:
                message.slice(
                  0,
                  5000
                ),

              publishLog:
                FieldValue
                  .arrayUnion({
                    platform:
                      "instagram",

                    result:
                      "failed",

                    error:
                      message.slice(
                        0,
                        1000
                      ),

                    at:
                      new Date()
                        .toISOString(),
                  }),

              updatedAt:
                FieldValue
                  .serverTimestamp(),
            },
            {
              merge: true,
            }
          );
        }
      }
    }

    // ============================================================
    // FACEBOOK PAGE VIDEO
    // ============================================================

    let facebook:
      QueueResult["facebook"] =
      "not_selected";

    let facebookUrl:
      string | undefined;

    if (
      platforms.includes(
        "facebook"
      )
    ) {
      if (
        typeof data
          .facebookVideoId ===
          "string" &&
        data.facebookVideoId
      ) {
        facebook =
          "already_published";

        facebookUrl =
          typeof data
            ?.publishedUrls
            ?.facebook ===
            "string"
            ? data
                .publishedUrls
                .facebook
            : undefined;
      }
      else if (
        !facebookConnected ||
        !facebookPageId ||
        !encryptedFacebookPageToken
      ) {
        facebook =
          "not_connected";

        await document.ref.set(
          {
            platformStatus: { facebook: "waiting_connection" },

            lastError:
              "Facebook Page is not connected.",

            updatedAt:
              FieldValue
                .serverTimestamp(),
          },
          {
            merge: true,
          }
        );
      }
      else {
        try {
          const claim =
            await claimFacebookPublish(
              document.ref
            );

          if (
            claim ===
            "already_published"
          ) {
            facebook =
              "already_published";
          }
          else if (
            claim ===
            "already_publishing"
          ) {
            facebook =
              "already_publishing";
          }
          else {
            const accessToken =
              decrypt(
                encryptedFacebookPageToken
              );

            const isImagePost =
              data.mediaType ===
              "image";

            const storagePath =
              isImagePost
                ? (
                    typeof data
                      .imageStoragePath ===
                      "string"
                      ? data
                          .imageStoragePath
                      : ""
                  )
                : (
                    typeof data
                      .videoStoragePath ===
                      "string"
                      ? data
                          .videoStoragePath
                      : ""
                  );

            const fallbackUrl =
              isImagePost
                ? (
                    typeof data.imageUrl ===
                    "string"
                      ? data.imageUrl
                      : ""
                  )
                : (
                    typeof data.videoUrl ===
                    "string"
                      ? data.videoUrl
                      : ""
                  );

            const mediaUrl =
              await instagramPublicVideoUrl(
                storagePath,
                fallbackUrl
              );

            // SOLO_FACEBOOK_OPTIMIZATION_V1
            const baseCaption =
              typeof data.caption === "string"
                ? data.caption.trim()
                : "";

            const trackName =
              typeof data.trackTitle === "string" &&
              data.trackTitle.trim()
                ? data.trackTitle.trim()
                : (
                    typeof data.title === "string"
                      ? data.title.trim()
                      : "Solo Beats"
                  );

            const manualFacebookCaption =
              typeof data.facebookCaption === "string"
                ? data.facebookCaption.trim()
                : "";

            const facebookOptimizationEnabled =
              data.facebookOptimizationEnabled !== false;

            const facebookHashtags =
              "#SoloBeats #NewMusic #MusicReels #IndependentMusic #ElectronicMusic";

            const facebookAutoCaption =
              `${trackName} by Solo Beats\n\n` +
              `New music from SOLO BEATS ENGINE MUSIC.\n\n` +
              `Listen now and share it with someone who needs new music.\n` +
              `https://www.solobeatsenginemusic.com\n\n` +
              facebookHashtags;

            const caption =
              manualFacebookCaption ||
              (
                facebookOptimizationEnabled
                  ? (
                      baseCaption
                        ? `${baseCaption}\n\n${facebookAutoCaption}`
                        : facebookAutoCaption
                    )
                  : baseCaption
              );
            const facebookMediaId =
              isImagePost
                ? await facebookPublishPhoto({
                    pageId:
                      facebookPageId,

                    accessToken,

                    imageUrl:
                      mediaUrl,

                    caption,
                  })
                : await facebookPublishVideo({
                    pageId:
                      facebookPageId,

                    accessToken,

                    videoUrl:
                      mediaUrl,

                    caption,
                  });

            facebook =
              "published";

            facebookUrl =
              isImagePost
                ? `https://www.facebook.com/${facebookPageId}/photos/${facebookMediaId}/`
                : `https://www.facebook.com/${facebookPageId}/videos/${facebookMediaId}/`;

            await document.ref.set(
              {
                facebookVideoId:
                  facebookMediaId,

                facebookPublishLock:
                  FieldValue.delete(),

                facebookPublishLockAt:
                  FieldValue.delete(),

                platformStatus: { facebook: "published" },

                facebookPublishedAt:
                  FieldValue
                    .serverTimestamp(),

                publishedUrls: { facebook: facebookUrl },

                lastError:
                  null,

                publishLog:
                  FieldValue
                    .arrayUnion({
                      platform:
                        "facebook",

                      result:
                        "published",

                      mediaId:
                        facebookMediaId,

                      mediaType:
                        isImagePost
                          ? "image"
                          : "video",

                      url:
                        facebookUrl,

                      at:
                        new Date()
                          .toISOString(),
                    }),

                updatedAt:
                  FieldValue
                    .serverTimestamp(),
              },
              {
                merge: true,
              }
            );
          }
        }
        catch (error) {
          facebook =
            "failed";

          const message =
            error instanceof Error
              ? error.message
              : "Facebook publishing failed.";

          resultError =
            message;

          await document.ref.set(
            {
              facebookPublishLock:
                FieldValue.delete(),

              facebookPublishLockAt:
                FieldValue.delete(),

              platformStatus: { facebook: "failed" },

              lastError:
                message.slice(
                  0,
                  5000
                ),

              publishLog:
                FieldValue
                  .arrayUnion({
                    platform:
                      "facebook",

                    result:
                      "failed",

                    error:
                      message.slice(
                        0,
                        1000
                      ),

                    at:
                      new Date()
                        .toISOString(),
                  }),

              updatedAt:
                FieldValue
                  .serverTimestamp(),
            },
            {
              merge: true,
            }
          );
        }
      }
    }

    // ============================================================
    // SOLO_TIKTOK_PUBLISH_ENGINE_V1
    // ============================================================

    if (
      platforms.includes(
        "tiktok"
      )
    ) {
      if (
        data
          .tiktokPublishComplete ===
          true
      ) {
        tiktok =
          "already_published";

        tiktokUrl =
          typeof data
            ?.publishedUrls
            ?.tiktok ===
            "string"
            ? data
                .publishedUrls
                .tiktok
            : undefined;
      }
      else if (
        !tiktokConnected
      ) {
        tiktok =
          "not_connected";

        await document.ref.set(
          {
            platformStatus: { tiktok: "waiting_connection" },

            lastError:
              "TikTok is not connected.",

            updatedAt:
              FieldValue
                .serverTimestamp(),
          },
          {
            merge: true,
          }
        );
      }
      else {
        try {
          const claim =
            await claimTikTokPublish(
              document.ref
            );

          if (
            claim ===
            "already_published"
          ) {
            tiktok =
              "already_published";
          }
          else if (
            claim ===
            "already_publishing"
          ) {
            tiktok =
              "already_publishing";
          }
          else {
            const accessToken =
              await tiktokAccessToken({
                connectionRef,
                connection,
              });

            const existingPublishId =
              typeof data
                .tiktokPublishId ===
                "string"
                ? data
                    .tiktokPublishId
                    .trim()
                : "";

            let publishId =
              existingPublishId;

            // ====================================================
            // SOLO_TIKTOK_IMAGE_QUEUE_V1
            // ====================================================

            if (
              !publishId &&
              data.mediaType ===
                "image"
            ) {
              const storagePath =
                typeof data
                  .imageStoragePath ===
                  "string"
                  ? data
                      .imageStoragePath
                      .trim()
                  : "";

              if (!storagePath) {
                throw new Error(
                  "TIKTOK_IMAGE_STORAGE_PATH_MISSING"
                );
              }

              const manualCaption =
                typeof data
                  .tiktokCaption ===
                  "string"
                  ? data
                      .tiktokCaption
                      .trim()
                  : "";

              const fallbackCaption =
                typeof data
                  .caption ===
                  "string"
                  ? data
                      .caption
                      .trim()
                  : "";

              const trackName =
                typeof data
                  .trackTitle ===
                  "string" &&
                data
                  .trackTitle
                  .trim()
                  ? data
                      .trackTitle
                      .trim()
                  : (
                      typeof data
                        .title ===
                        "string" &&
                      data
                        .title
                        .trim()
                        ? data
                            .title
                            .trim()
                        : "Solo Beats"
                    );

              const autoCaption =
                `${trackName} | Solo Beats

Discover more from SOLO BEATS ENGINE MUSIC.

#SoloBeats #SoloBeatsEngineMusic #NewMusic #MusicTok #IndependentArtist`;

              const caption =
                (
                  manualCaption ||
                  (
                    data
                      .tiktokOptimizationEnabled !==
                      false
                      ? autoCaption
                      : fallbackCaption
                  ) ||
                  autoCaption
                )
                  .slice(
                    0,
                    4000
                  );

              const creator =
                await tiktokCreatorInfo(
                  accessToken
                );

              const imagePublicUrl =
                `https://www.solobeatsenginemusic.com/api/social-media/tiktok-image/${encodeURIComponent(
                  document.id
                )}`;

              const initializedPhoto =
                await tiktokInitializePhoto({
                  accessToken,

                  title:
                    trackName,

                  description:
                    caption,

                  privacyLevel:
                    creator
                      .privacyLevel,

                  imageUrl:
                    imagePublicUrl,
                });

              publishId =
                initializedPhoto
                  .publishId;

              await document.ref.set(
                {
                  tiktokPublishId:
                    publishId,

                  tiktokMediaType:
                    "image",

                  tiktokSourceUrl:
                    imagePublicUrl,

                  tiktokPrivacyLevel:
                    creator
                      .privacyLevel,

                  platformStatus: { tiktok: "processing" },

                  updatedAt:
                    FieldValue
                      .serverTimestamp(),
                },
                {
                  merge:
                    true,
                }
              );
            }

            /*
             * If we already uploaded the
             * video on a previous run, do
             * not upload it again. Just
             * ask TikTok for its status.
             */
            if (!publishId) {
              const storagePath =
                typeof data
                  .videoStoragePath ===
                  "string"
                  ? data
                      .videoStoragePath
                      .trim()
                  : "";

              if (!storagePath) {
                throw new Error(
                  "TIKTOK_VIDEO_STORAGE_PATH_MISSING"
                );
              }

              const [bytes] =
                await adminBucket
                  .file(
                    storagePath
                  )
                  .download();

              const manualCaption =
                typeof data
                  .tiktokCaption ===
                  "string"
                  ? data
                      .tiktokCaption
                      .trim()
                  : "";

              const fallbackCaption =
                typeof data
                  .caption ===
                  "string"
                  ? data
                      .caption
                      .trim()
                  : "";

              const trackName =
                typeof data
                  .trackTitle ===
                  "string" &&
                data
                  .trackTitle
                  .trim()
                  ? data
                      .trackTitle
                      .trim()
                  : (
                      typeof data
                        .title ===
                        "string" &&
                      data
                        .title
                        .trim()
                        ? data
                            .title
                            .trim()
                        : "Solo Beats New Music"
                    );

              const autoCaption =
                `${trackName} | Solo Beats\n\n` +
                `New music from SOLO BEATS ENGINE MUSIC.\n` +
                `Stream. Discover. Create. Promote.\n` +
                `https://www.solobeatsenginemusic.com\n\n` +
                `#SoloBeats #SoloBeatsEngineMusic #NewMusic #TikTokMusic #MusicTok #OriginalMusic #IndependentArtist #MusicPromotion`;

              const caption =
                (
                  manualCaption ||
                  (
                    data
                      .tiktokOptimizationEnabled !==
                      false
                      ? autoCaption
                      : fallbackCaption
                  ) ||
                  autoCaption
                )
                  .slice(
                    0,
                    2200
                  );

              const creator =
                await tiktokCreatorInfo(
                  accessToken
                );

              const initialized =
                await tiktokInitializeVideo({
                  accessToken,
                  bytes,
                  caption,
                  privacyLevel:
                    creator
                      .privacyLevel,
                });

              publishId =
                initialized
                  .publishId;

              /*
               * Save publish_id before
               * uploading bytes. If a
               * network interruption occurs,
               * the next run can check this
               * TikTok operation instead of
               * blindly creating duplicates.
               */
              await document.ref.set(
                {
                  tiktokPublishId:
                    publishId,

                  tiktokPrivacyLevel:
                    creator
                      .privacyLevel,

                  platformStatus: { tiktok: "uploading" },

                  updatedAt:
                    FieldValue
                      .serverTimestamp(),
                },
                {
                  merge: true,
                }
              );

              await tiktokUploadVideo({
                uploadUrl:
                  initialized
                    .uploadUrl,

                bytes,

                chunkSize:
                  initialized
                    .chunkSize,

                totalChunkCount:
                  initialized
                    .totalChunkCount,

                contentType:
                  tiktokMimeType(
                    storagePath
                  ),
              });
            }

            const statusResult =
              await tiktokFetchStatus({
                accessToken,
                publishId,
              });

            if (
              statusResult.status ===
              "PUBLISH_COMPLETE"
            ) {
              tiktok =
                "published";

              const postId =
                statusResult
                  .postIds[0] ||
                "";

              const username =
                typeof connection
                  .tiktokUsername ===
                  "string"
                  ? connection
                      .tiktokUsername
                      .replace(
                        /^@/,
                        ""
                      )
                      .trim()
                  : "";

              if (
                username &&
                postId
              ) {
                tiktokUrl =
                  `https://www.tiktok.com/@${username}/video/${postId}`;
              }

              const update:
                Record<string, any> = {
                  tiktokPublishComplete:
                    true,

                  tiktokPublishedPostId:
                    postId || null,

                  tiktokPublishLock:
                    FieldValue.delete(),

                  tiktokPublishLockAt:
                    FieldValue.delete(),

                  platformStatus: { tiktok: "published" },

                  tiktokPublishedAt:
                    FieldValue
                      .serverTimestamp(),

                  lastError:
                    null,

                  publishLog:
                    FieldValue
                      .arrayUnion({
                        platform:
                          "tiktok",

                        result:
                          "published",

                        publishId,

                        postId:
                          postId ||
                          null,

                        privacy:
                          typeof document.data()
                            ?.tiktokPrivacyLevel ===
                            "string"
                            ? document.data()
                                ?.tiktokPrivacyLevel
                            : "SELF_ONLY",

                        at:
                          new Date()
                            .toISOString(),
                      }),

                  updatedAt:
                    FieldValue
                      .serverTimestamp(),
                };

              if (tiktokUrl) {
                update.publishedUrls = { ...(update.publishedUrls || {}), tiktok: tiktokUrl };
              }

              await document.ref.set(
                update,
                {
                  merge: true,
                }
              );
            }
            else if (
              statusResult.status ===
              "FAILED"
            ) {
              /*
               * Failed TikTok publish IDs
               * can be discarded so the
               * normal retry system can
               * initialize a new attempt.
               */
              await document.ref.set(
                {
                  tiktokPublishId:
                    FieldValue.delete(),

                  tiktokPublishLock:
                    FieldValue.delete(),

                  tiktokPublishLockAt:
                    FieldValue.delete(),
                },
                {
                  merge: true,
                }
              );

              throw new Error(
                `TIKTOK_PUBLISH_FAILED: ${
                  statusResult
                    .failReason ||
                  "UNKNOWN_REASON"
                }`
              );
            }
            else {
              /*
               * TikTok processing is
               * asynchronous. Keep the queue
               * item scheduled. The next cron
               * run will poll publish_id again.
               */
              tiktok =
                "processing";

              await document.ref.set(
                {
                  tiktokPublishId:
                    publishId,

                  tiktokPublishLock:
                    FieldValue.delete(),

                  tiktokPublishLockAt:
                    FieldValue.delete(),

                  platformStatus: { tiktok: "processing" },

                  tiktokLastStatus:
                    statusResult
                      .status ||
                    "PROCESSING_UPLOAD",

                  lastError:
                    null,

                  updatedAt:
                    FieldValue
                      .serverTimestamp(),
                },
                {
                  merge: true,
                }
              );
            }
          }
        }
        catch (error) {
          tiktok =
            "failed";

          const message =
            error instanceof Error
              ? error.message
              : "TikTok publishing failed.";

          resultError =
            message;

          const resetTikTokPublishId =
            message.startsWith(
              "TIKTOK_VIDEO_UPLOAD_FAILED_"
            ) ||
            message.startsWith(
              "TIKTOK_VIDEO_UPLOAD_RETRIES_EXHAUSTED:"
            ) ||
            message.startsWith(
              "TIKTOK_VIDEO_UPLOAD_NETWORK_FAILED:"
            );

          const maxRetries =
            typeof data
              .maxRetries ===
              "number" &&
            data.maxRetries > 0
              ? data.maxRetries
              : 3;

          const retryCount =
            Math.min(
              typeof data
                .retryCount ===
                "number"
                ? data
                    .retryCount +
                  1
                : 1,

              maxRetries
            );

          await document.ref.set(
            {
              ...(resetTikTokPublishId
                ? {
                    tiktokPublishId:
                      FieldValue.delete(),
                  }
                : {}),

              tiktokPublishLock:
                FieldValue.delete(),

              tiktokPublishLockAt:
                FieldValue.delete(),

              platformStatus: { tiktok: "failed" },

              retryCount,

              lastError:
                message.slice(
                  0,
                  5000
                ),

              publishLog:
                FieldValue
                  .arrayUnion({
                    platform:
                      "tiktok",

                    result:
                      "failed",

                    error:
                      message.slice(
                        0,
                        1000
                      ),

                    at:
                      new Date()
                        .toISOString(),
                  }),

              updatedAt:
                FieldValue
                  .serverTimestamp(),
            },
            {
              merge: true,
            }
          );
        }
      }
    }

    // ============================================================
    // MARK QUEUE ITEM PUBLISHED
    // Only platforms currently implemented here count.
    // Facebook will be added separately.
    // ============================================================

    const youtubeComplete =
      !platforms.includes(
        "youtube"
      ) ||
      youtube ===
        "uploaded_public" ||
      youtube ===
        "uploaded_unlisted" ||
      youtube ===
        "uploaded_private" ||
      youtube ===
        "already_uploaded" ||
      youtube ===
        "existing_verified";

    const instagramComplete =
      !platforms.includes(
        "instagram"
      ) ||
      instagram ===
        "published" ||
      instagram ===
        "already_published";

    const facebookComplete =
      !platforms.includes(
        "facebook"
      ) ||
      facebook ===
        "published" ||
      facebook ===
        "already_published";

    const tiktokComplete =
      !platforms.includes(
        "tiktok"
      ) ||
      tiktok ===
        "published" ||
      tiktok ===
        "already_published";

    if (
      youtubeComplete &&
      instagramComplete &&
      facebookComplete &&
      tiktokComplete
    ) {
      await document.ref.set(
        {
          status:
            "published",

          publishedAt:
            FieldValue
              .serverTimestamp(),

          lastError:
            null,

          updatedAt:
            FieldValue
              .serverTimestamp(),
        },
        {
          merge: true,
        }
      );

      await createNextRecurringOccurrence(
        document.ref,
        data
      );
    }

    results.push({
      postId:
        document.id,

      youtube,
      youtubeUrl,

      instagram,
      instagramUrl,

      facebook,
      facebookUrl,

      tiktok,
      tiktokUrl,

      error:
        resultError,
    });
  }

  return {
    success: true,

    checked:
      snapshot.size,

    due:
      due.length,

    results,
  };
}





















