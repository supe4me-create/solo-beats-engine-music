import {
  createDecipheriv,
  createHash,
} from "crypto";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminDb,
} from "./firebaseAdmin";

function cleanText(
  value: unknown,
  maxLength = 5000
) {
  return typeof value === "string"
    ? value.trim().slice(
        0,
        maxLength
      )
    : "";
}

function graphVersion() {
  return (
    process.env
      .META_GRAPH_VERSION ||
    process.env
      .FACEBOOK_GRAPH_VERSION ||
    "v24.0"
  );
}

function encryptionKey() {
  const secret =
    process.env
      .SOCIAL_PUBLISHER_SECRET ||
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
  value: string
) {
  const parts =
    value.split(".");

  if (parts.length !== 3) {
    throw new Error(
      "INVALID_ENCRYPTED_TOKEN"
    );
  }

  const [
    ivPart,
    tagPart,
    encryptedPart,
  ] = parts;

  const decipher =
    createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(
        ivPart,
        "base64"
      )
    );

  decipher.setAuthTag(
    Buffer.from(
      tagPart,
      "base64"
    )
  );

  const decrypted =
    Buffer.concat([
      decipher.update(
        Buffer.from(
          encryptedPart,
          "base64"
        )
      ),
      decipher.final(),
    ]);

  return decrypted.toString(
    "utf8"
  );
}

function scheduledTime(
  value: unknown
) {
  if (
    typeof value ===
    "string"
  ) {
    const parsed =
      Date.parse(value);

    return Number.isFinite(
      parsed
    )
      ? parsed
      : NaN;
  }

  if (
    value &&
    typeof value ===
      "object" &&
    "toMillis" in value &&
    typeof (
      value as {
        toMillis?: unknown;
      }
    ).toMillis ===
      "function"
  ) {
    return (
      value as {
        toMillis:
          () => number;
      }
    ).toMillis();
  }

  return NaN;
}

async function responseJson(
  response: Response
) {
  const text =
    await response.text();

  let data: any = {};

  try {
    data =
      text
        ? JSON.parse(text)
        : {};
  } catch {
    data = {};
  }

  return {
    text,
    data,
  };
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
  const response =
    await fetch(
      `https://graph.facebook.com/${graphVersion()}/${encodeURIComponent(
        pageId
      )}/photos`,
      {
        method:
          "POST",

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

  const {
    text,
    data,
  } =
    await responseJson(
      response
    );

  if (
    !response.ok ||
    typeof data.id !==
      "string" ||
    !data.id
  ) {
    throw new Error(
      data?.error?.message ||
      text ||
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
  const response =
    await fetch(
      `https://graph.facebook.com/${graphVersion()}/${encodeURIComponent(
        pageId
      )}/videos`,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          new URLSearchParams({
            file_url:
              videoUrl,

            description:
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

  const {
    text,
    data,
  } =
    await responseJson(
      response
    );

  if (
    !response.ok ||
    typeof data.id !==
      "string" ||
    !data.id
  ) {
    throw new Error(
      data?.error?.message ||
      text ||
      "Facebook video publishing failed."
    );
  }

  return String(data.id);
}

async function instagramCreateContainer({
  instagramAccountId,
  accessToken,
  mediaUrl,
  caption,
  postType,
}: {
  instagramAccountId:
    string;
  accessToken:
    string;
  mediaUrl:
    string;
  caption:
    string;
  postType:
    "image" | "video";
}) {
  const params:
    Record<string, string> = {
      caption:
        caption.slice(
          0,
          2200
        ),

      access_token:
        accessToken,
    };

  if (
    postType ===
    "video"
  ) {
    params.media_type =
      "REELS";

    params.video_url =
      mediaUrl;
  } else {
    params.image_url =
      mediaUrl;
  }

  const response =
    await fetch(
      `https://graph.instagram.com/${encodeURIComponent(
        instagramAccountId
      )}/media`,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          new URLSearchParams(
            params
          ),
      }
    );

  const {
    text,
    data,
  } =
    await responseJson(
      response
    );

  if (
    !response.ok ||
    typeof data.id !==
      "string" ||
    !data.id
  ) {
    throw new Error(
      data?.error?.message ||
      text ||
      (
        postType ===
        "video"
          ? "Instagram video container failed."
          : "Instagram image container failed."
      )
    );
  }

  return String(data.id);
}

function sleep(
  ms: number
) {
  return new Promise<void>(
    resolve =>
      setTimeout(
        resolve,
        ms
      )
  );
}

async function waitForInstagramContainer({
  creationId,
  accessToken,
}: {
  creationId:
    string;
  accessToken:
    string;
}) {
  for (
    let attempt = 0;
    attempt < 60;
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
          cache:
            "no-store",
        }
      );

    const {
      text,
      data,
    } =
      await responseJson(
        response
      );

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
        text ||
        "Instagram media status check failed."
      );
    }

    const statusCode =
      typeof data.status_code ===
        "string"
        ? data.status_code
            .toUpperCase()
        : "";

    if (
      statusCode ===
        "FINISHED" ||
      statusCode ===
        "PUBLISHED"
    ) {
      return;
    }

    if (
      statusCode ===
        "ERROR" ||
      statusCode ===
        "EXPIRED"
    ) {
      throw new Error(
        typeof data.status ===
          "string"
          ? data.status
          : `Instagram media container ${statusCode.toLowerCase()}.`
      );
    }

    await sleep(
      3000
    );
  }

  throw new Error(
    "Instagram media processing timed out."
  );
}

async function instagramPublish({
  instagramAccountId,
  accessToken,
  creationId,
}: {
  instagramAccountId:
    string;
  accessToken:
    string;
  creationId:
    string;
}) {
  const response =
    await fetch(
      `https://graph.instagram.com/${encodeURIComponent(
        instagramAccountId
      )}/media_publish`,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          new URLSearchParams({
            creation_id:
              creationId,

            access_token:
              accessToken,
          }),
      }
    );

  const {
    text,
    data,
  } =
    await responseJson(
      response
    );

  if (
    !response.ok ||
    typeof data.id !==
      "string" ||
    !data.id
  ) {
    throw new Error(
      data?.error?.message ||
      text ||
      "Instagram publishing failed."
    );
  }

  return String(
    data.id
  );
}

export async function runCustomerSocialPublisher() {
  const snapshot =
    await adminDb
      .collection(
        "socialSchedulerPosts"
      )
      .where(
        "status",
        "==",
        "SCHEDULED"
      )
      .limit(100)
      .get();

  const now =
    Date.now();

  const results:
    Array<Record<
      string,
      unknown
    >> = [];

  for (
    const document of
    snapshot.docs
  ) {
    const data =
      document.data() || {};

    const dueAt =
      scheduledTime(
        data.scheduledFor
      );

    if (
      !Number.isFinite(
        dueAt
      ) ||
      dueAt > now
    ) {
      continue;
    }

    const customerUid =
      cleanText(
        data.customerUid,
        200
      );

    if (!customerUid) {
      continue;
    }

    const platforms =
      Array.isArray(
        data.platforms
      )
        ? data.platforms.filter(
            (
              item: unknown
            ): item is string =>
              typeof item ===
                "string"
          )
        : [];

    const postType =
      cleanText(
        data.postType,
        20
      ).toLowerCase();

    if (
      postType !==
        "image" &&
      postType !==
        "video"
    ) {
      continue;
    }

    const mediaUrl =
      cleanText(
        data.mediaUrl,
        3000
      );

    const caption =
      cleanText(
        data.caption,
        5000
      );

    if (!mediaUrl) {
      await document.ref.set(
        {
          status:
            "FAILED",

          lastError:
            "Media URL is missing.",

          updatedAt:
            FieldValue
              .serverTimestamp(),
        },
        {
          merge:
            true,
        }
      );

      continue;
    }

    const connectionSnapshot =
      await adminDb
        .collection(
          "socialSchedulerConnections"
        )
        .doc(
          customerUid
        )
        .get();

    const connection =
      connectionSnapshot
        .data() || {};

    const platformStatus:
      Record<
        string,
        string
      > = {};

    const publishedUrls:
      Record<
        string,
        string
      > = {};

    const publishLog:
      Array<
        Record<
          string,
          unknown
        >
      > = [];

    let failed =
      false;

    let lastError =
      "";

    if (
      platforms.includes(
        "facebook"
      )
    ) {
      try {
        const pageId =
          cleanText(
            connection
              .facebookPageId,
            500
          );

        const encryptedToken =
          cleanText(
            connection
              .facebookPageAccessTokenEncrypted,
            10000
          );

        if (
          connection
            .facebookConnected !==
              true ||
          !pageId ||
          !encryptedToken
        ) {
          throw new Error(
            "Facebook is not connected for this customer."
          );
        }

        const token =
          decrypt(
            encryptedToken
          );

        const facebookId =
          postType ===
            "video"
            ? await facebookPublishVideo({
                pageId,

                accessToken:
                  token,

                videoUrl:
                  mediaUrl,

                caption,
              })
            : await facebookPublishPhoto({
                pageId,

                accessToken:
                  token,

                imageUrl:
                  mediaUrl,

                caption,
              });

        platformStatus.facebook =
          "published";

        publishedUrls.facebook =
          facebookId;

        publishLog.push({
          platform:
            "facebook",

          mediaType:
            postType,

          result:
            "published",

          id:
            facebookId,

          at:
            new Date()
              .toISOString(),
        });
      } catch (error) {
        failed =
          true;

        const message =
          error instanceof
            Error
            ? error.message
            : "Facebook publishing failed.";

        lastError =
          message;

        platformStatus.facebook =
          "failed";

        publishLog.push({
          platform:
            "facebook",

          mediaType:
            postType,

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
        });
      }
    }

    if (
      platforms.includes(
        "instagram"
      )
    ) {
      try {
        const accountId =
          cleanText(
            connection
              .instagramAccountId,
            500
          );

        const encryptedToken =
          cleanText(
            connection
              .instagramAccessTokenEncrypted,
            10000
          );

        if (
          !accountId ||
          !encryptedToken
        ) {
          throw new Error(
            "Instagram is not connected for this customer."
          );
        }

        const token =
          decrypt(
            encryptedToken
          );

        const creationId =
          await instagramCreateContainer({
            instagramAccountId:
              accountId,

            accessToken:
              token,

            mediaUrl,

            caption,

            postType:
              postType as
                "image" |
                "video",
          });

        await waitForInstagramContainer({
          creationId,

          accessToken:
            token,
        });

        const instagramId =
          await instagramPublish({
            instagramAccountId:
              accountId,

            accessToken:
              token,

            creationId,
          });

        platformStatus.instagram =
          "published";

        publishedUrls.instagram =
          instagramId;

        publishLog.push({
          platform:
            "instagram",

          mediaType:
            postType,

          result:
            "published",

          id:
            instagramId,

          at:
            new Date()
              .toISOString(),
        });
      } catch (error) {
        failed =
          true;

        const message =
          error instanceof
            Error
            ? error.message
            : "Instagram publishing failed.";

        lastError =
          message;

        platformStatus.instagram =
          "failed";

        publishLog.push({
          platform:
            "instagram",

          mediaType:
            postType,

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
        });
      }
    }

    const requestedImplementedPlatforms =
      platforms.filter(
        platform =>
          platform ===
            "facebook" ||
          platform ===
            "instagram"
      );

    const allComplete =
      requestedImplementedPlatforms
        .length > 0 &&
      requestedImplementedPlatforms
        .every(
          platform =>
            platformStatus[
              platform
            ] ===
              "published"
        );

    await document.ref.set(
      {
        platformStatus,

        publishedUrls,

        publishLog:
          publishLog.length
            ? FieldValue.arrayUnion(
                ...publishLog
              )
            : [],

        status:
          allComplete
            ? "PUBLISHED"
            : failed
              ? "FAILED"
              : data.status,

        lastError:
          allComplete
            ? null
            : lastError ||
              null,

        publishedAt:
          allComplete
            ? FieldValue
                .serverTimestamp()
            : null,

        updatedAt:
          FieldValue
            .serverTimestamp(),
      },
      {
        merge:
          true,
      }
    );

    results.push({
      postId:
        document.id,

      customerUid,

      postType,

      status:
        allComplete
          ? "PUBLISHED"
          : failed
            ? "FAILED"
            : data.status,

      platformStatus,
    });
  }

  return {
    success:
      true,

    processed:
      results.length,

    results,
  };
}
