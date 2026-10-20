import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminBucket,
  adminDb,
} from "../../../../lib/firebaseAdmin";

import {
  requireSchedulerCustomer,
  type SchedulerPlatform,
} from "../../../../lib/socialSchedulerCustomer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================
// SOLO_CUSTOMER_POST_SCHEDULER_V1
// Customer-owned scheduled post storage.
// Publishing is intentionally handled in a later phase.
// ============================================================

const SUPPORTED_PLATFORMS:
  SchedulerPlatform[] = [
    "facebook",
    "instagram",
    "youtube",
    "tiktok",
  ];

type PostType =
  | "text"
  | "image"
  | "video";

type Recurrence =
  | "none"
  | "daily"
  | "weekly";

function cleanText(
  value: unknown,
  maxLength = 5000
) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .slice(0, maxLength);
}

function cleanPlatforms(
  value: unknown
): SchedulerPlatform[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value.filter(
        (
          item: unknown
        ): item is SchedulerPlatform =>
          typeof item === "string" &&
          SUPPORTED_PLATFORMS.includes(
            item as SchedulerPlatform
          )
      )
    )
  );
}

function currentMonthKey() {
  const now =
    new Date();

  return [
    now.getUTCFullYear(),
    String(
      now.getUTCMonth() + 1
    ).padStart(2, "0"),
  ].join("-");
}

function connectedForPlatform(
  connections: Record<
    string,
    unknown
  >,
  platform: SchedulerPlatform
) {
  const field =
    platform === "facebook"
      ? "facebookConnected"
      : platform === "instagram"
        ? "instagramConnected"
        : platform === "youtube"
          ? "youtubeConnected"
          : "tiktokConnected";

  return connections[field] === true;
}

function errorResponse(
  error: unknown
) {
  const message =
    error instanceof Error
      ? error.message
      : "";

  if (
    message ===
    "CUSTOMER_AUTH_REQUIRED"
  ) {
    return Response.json(
      {
        success: false,
        error:
          "Sign in to use the Social Scheduler.",
      },
      {
        status: 401,
      }
    );
  }

  if (
    message ===
    "SCHEDULER_SUBSCRIPTION_REQUIRED"
  ) {
    return Response.json(
      {
        success: false,
        error:
          "An active Social Scheduler subscription is required.",
      },
      {
        status: 403,
      }
    );
  }

  if (
    message ===
    "PLATFORM_NOT_INCLUDED"
  ) {
    return Response.json(
      {
        success: false,
        error:
          "One or more selected platforms are not included in your plan.",
      },
      {
        status: 403,
      }
    );
  }

  console.error(
    "Customer scheduler posts error:",
    error
  );

  return Response.json(
    {
      success: false,
      error:
        "The scheduled post request could not be completed.",
    },
    {
      status: 500,
    }
  );
}

export async function GET(
  request: Request
) {
  try {
    const {
      decoded,
    } =
      await requireSchedulerCustomer(
        request
      );

    const snapshot =
      await adminDb
        .collection(
          "socialSchedulerPosts"
        )
        .where(
          "customerUid",
          "==",
          decoded.uid
        )
        .limit(100)
        .get();

    const posts =
      snapshot.docs
        .map(doc => {
          const data =
            doc.data();

          return {
            id:
              doc.id,

            postType:
              data.postType || "text",

            title:
              data.title || "",

            caption:
              data.caption || "",

            mediaUrl:
              data.mediaUrl || "",

            mediaStoragePath:
              data.mediaStoragePath || "",

            platforms:
              Array.isArray(
                data.platforms
              )
                ? data.platforms
                : [],

            scheduledFor:
              data.scheduledFor || null,

            timezone:
              data.timezone || "UTC",

            recurrence:
              data.recurrence || "none",

            status:
              data.status || "SCHEDULED",

            // SOLO_CUSTOMER_FAILURE_DETAILS_V1
            lastError:
              typeof data.lastError ===
              "string"
                ? data.lastError
                : "",

            platformStatus:
              data.platformStatus &&
              typeof data.platformStatus ===
              "object"
                ? data.platformStatus
                : {},

            publishedUrls:
              data.publishedUrls &&
              typeof data.publishedUrls ===
              "object"
                ? data.publishedUrls
                : {},

            createdAtMs:
              typeof data.createdAtMs ===
              "number"
                ? data.createdAtMs
                : 0,
          };
        })
        .sort(
          (
            a,
            b
          ) =>
            b.createdAtMs -
            a.createdAtMs
        );

    return Response.json({
      success: true,
      posts,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request
) {
  try {
    const {
      decoded,
      customer,
      platforms:
        allowedPlatforms,
    } =
      await requireSchedulerCustomer(
        request
      );

    const body =
      await request.json();

    const postType =
      cleanText(
        body?.postType,
        20
      ) as PostType;

    if (
      ![
        "text",
        "image",
        "video",
      ].includes(postType)
    ) {
      return Response.json(
        {
          success: false,
          error:
            "Choose a valid post type.",
        },
        {
          status: 400,
        }
      );
    }

    // SOLO_CUSTOMER_POST_TITLE_V1
    const title =
      cleanText(
        body?.title,
        200
      );

    const caption =
      cleanText(
        body?.caption,
        5000
      );

    const mediaUrl =
      cleanText(
        body?.mediaUrl,
        3000
      );

    const mediaStoragePath =
      cleanText(
        body?.mediaStoragePath,
        3000
      );

    if (
      mediaStoragePath &&
      !mediaStoragePath.startsWith(
        `social-promotions/device/${decoded.uid}/`
      )
    ) {
      return Response.json(
        {
          success: false,
          error:
            "The uploaded media does not belong to this scheduler account.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !title &&
      !caption &&
      !mediaUrl
    ) {
      return Response.json(
        {
          success: false,
          error:
            "Add a title, description, or media.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      (
        postType === "image" ||
        postType === "video"
      ) &&
      !mediaUrl
    ) {
      return Response.json(
        {
          success: false,
          error:
            "A media URL is required for image and video posts.",
        },
        {
          status: 400,
        }
      );
    }

    const selectedPlatforms =
      cleanPlatforms(
        body?.platforms
      );

    if (
      selectedPlatforms.length ===
      0
    ) {
      return Response.json(
        {
          success: false,
          error:
            "Select at least one platform.",
        },
        {
          status: 400,
        }
      );
    }

    for (
      const platform of
      selectedPlatforms
    ) {
      if (
        !allowedPlatforms.includes(
          platform
        )
      ) {
        return Response.json(
          {
            success: false,
            error:
              `${platform} is not included in your current plan.`,
          },
          {
            status: 403,
          }
        );
      }
    }

    const connectionsSnapshot =
      await adminDb
        .collection(
          "socialSchedulerConnections"
        )
        .doc(decoded.uid)
        .get();

    const connections =
      connectionsSnapshot.exists
        ? connectionsSnapshot.data() ||
          {}
        : {};

    const disconnected =
      selectedPlatforms.filter(
        platform =>
          !connectedForPlatform(
            connections,
            platform
          )
      );

    if (
      disconnected.length >
      0
    ) {
      return Response.json(
        {
          success: false,
          error:
            `Connect these accounts first: ${disconnected.join(
              ", "
            )}.`,
        },
        {
          status: 400,
        }
      );
    }

    const scheduledFor =
      cleanText(
        body?.scheduledFor,
        100
      );

    if (!scheduledFor) {
      return Response.json(
        {
          success: false,
          error:
            "Choose a schedule date and time.",
        },
        {
          status: 400,
        }
      );
    }

    const scheduledDate =
      new Date(scheduledFor);

    if (
      Number.isNaN(
        scheduledDate.getTime()
      )
    ) {
      return Response.json(
        {
          success: false,
          error:
            "The scheduled date is invalid.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      scheduledDate.getTime() <
      Date.now() + 60 * 1000
    ) {
      return Response.json(
        {
          success: false,
          error:
            "Schedule the post at least one minute in the future.",
        },
        {
          status: 400,
        }
      );
    }

    const timezone =
      cleanText(
        body?.timezone,
        100
      ) || "UTC";

    const recurrenceRaw =
      cleanText(
        body?.recurrence,
        20
      );

    const recurrence:
      Recurrence =
        recurrenceRaw ===
          "daily" ||
        recurrenceRaw ===
          "weekly"
          ? recurrenceRaw
          : "none";

    const recurringEnabled =
      customer.recurringEnabled ===
      true;

    if (
      recurrence !== "none" &&
      !recurringEnabled
    ) {
      return Response.json(
        {
          success: false,
          error:
            "Recurring scheduling is not included in your current plan.",
        },
        {
          status: 403,
        }
      );
    }

    const ownerUnlimited =
      customer.ownerUnlimited ===
      true;

    const monthlyPostLimit =
      ownerUnlimited
        ? -1
        : Number(
            customer.monthlyPostLimit
          );

    if (
      !ownerUnlimited &&
      (
        !Number.isFinite(
          monthlyPostLimit
        ) ||
        monthlyPostLimit < 1
      )
    ) {
      return Response.json(
        {
          success: false,
          error:
            "Your monthly post limit is not configured.",
        },
        {
          status: 403,
        }
      );
    }

    const monthKey =
      currentMonthKey();

    const customerRef =
      adminDb
        .collection(
          "socialSchedulerCustomers"
        )
        .doc(decoded.uid);

    const postRef =
      adminDb
        .collection(
          "socialSchedulerPosts"
        )
        .doc();

    await adminDb.runTransaction(
      async transaction => {
        const freshCustomerSnapshot =
          await transaction.get(
            customerRef
          );

        if (
          !freshCustomerSnapshot.exists
        ) {
          throw new Error(
            "SCHEDULER_SUBSCRIPTION_REQUIRED"
          );
        }

        const freshCustomer =
          freshCustomerSnapshot.data() ||
          {};

        if (
          freshCustomer.accessActive !==
            true ||
          freshCustomer.status !==
            "ACTIVE"
        ) {
          throw new Error(
            "SCHEDULER_SUBSCRIPTION_REQUIRED"
          );
        }

        const storedMonth =
          typeof freshCustomer
            .usageMonth === "string"
            ? freshCustomer
                .usageMonth
            : "";

        const storedCount =
          storedMonth ===
          monthKey
            ? Number(
                freshCustomer
                  .monthlyPostsUsed
              ) || 0
            : 0;

        const freshOwnerUnlimited =
          freshCustomer
            .ownerUnlimited ===
          true;

        const freshLimit =
          Number(
            freshCustomer
              .monthlyPostLimit
          );

        if (
          !freshOwnerUnlimited &&
          (
            !Number.isFinite(
              freshLimit
            ) ||
            freshLimit < 1
          )
        ) {
          throw new Error(
            "POST_LIMIT_NOT_CONFIGURED"
          );
        }

        if (
          !freshOwnerUnlimited &&
          storedCount >=
            freshLimit
        ) {
          throw new Error(
            "MONTHLY_POST_LIMIT_REACHED"
          );
        }

        transaction.set(
          postRef,
          {
            customerUid:
              decoded.uid,

            customerEmail:
              decoded.email || null,

            postType,

            title,

            caption,

            mediaUrl:
              mediaUrl || null,

            mediaStoragePath:
              mediaStoragePath || null,

            platforms:
              selectedPlatforms,

            scheduledFor:
              scheduledDate.toISOString(),

            scheduledForMs:
              scheduledDate.getTime(),

            timezone,

            recurrence,

            status:
              "SCHEDULED",

            publishStatus:
              "PENDING",

            platformStatus:
              Object.fromEntries(
                selectedPlatforms.map(
                  platform => [
                    platform,
                    "PENDING",
                  ]
                )
              ),

            createdAt:
              FieldValue
                .serverTimestamp(),

            createdAtMs:
              Date.now(),

            updatedAt:
              FieldValue
                .serverTimestamp(),
          }
        );

        transaction.set(
          customerRef,
          {
            usageMonth:
              monthKey,

            monthlyPostsUsed:
              storedCount + 1,

            updatedAt:
              FieldValue
                .serverTimestamp(),
          },
          {
            merge: true,
          }
        );
      }
    ).catch(error => {
      if (
        error instanceof Error &&
        error.message ===
          "MONTHLY_POST_LIMIT_REACHED"
      ) {
        throw error;
      }

      if (
        error instanceof Error &&
        error.message ===
          "POST_LIMIT_NOT_CONFIGURED"
      ) {
        throw error;
      }

      throw error;
    });

    return Response.json({
      success: true,

      postId:
        postRef.id,

      status:
        "SCHEDULED",

      scheduledFor:
        scheduledDate.toISOString(),

      monthlyPostLimit,
    });
  } catch (error) {

    if (
      error instanceof Error &&
      error.message ===
        "MONTHLY_POST_LIMIT_REACHED"
    ) {
      return Response.json(
        {
          success: false,
          error:
            "You have reached your monthly scheduled post limit.",
        },
        {
          status: 429,
        }
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "POST_LIMIT_NOT_CONFIGURED"
    ) {
      return Response.json(
        {
          success: false,
          error:
            "Your monthly post limit is not configured.",
        },
        {
          status: 403,
        }
      );
    }

    return errorResponse(error);
  }
}

export async function DELETE(
  request: Request
) {
  try {
    const {
      decoded,
    } =
      await requireSchedulerCustomer(
        request
      );

    const body =
      await request.json();

    const postId =
      cleanText(
        body?.postId,
        200
      );

    const action =
      cleanText(
        body?.action,
        30
      ).toLowerCase();

    if (!postId) {
      return Response.json(
        {
          success: false,
          error:
            "Post ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const postRef =
      adminDb
        .collection(
          "socialSchedulerPosts"
        )
        .doc(postId);

    const snapshot =
      await postRef.get();

    if (!snapshot.exists) {
      return Response.json(
        {
          success: false,
          error:
            "Scheduled post not found.",
        },
        {
          status: 404,
        }
      );
    }

    const data =
      snapshot.data() || {};

    if (
      data.customerUid !==
      decoded.uid
    ) {
      return Response.json(
        {
          success: false,
          error:
            "You cannot modify this scheduled post.",
        },
        {
          status: 403,
        }
      );
    }

    if (
      action ===
      "delete"
    ) {
      if (
        data.status ===
        "SCHEDULED"
      ) {
        return Response.json(
          {
            success: false,
            error:
              "Cancel the scheduled post before deleting it.",
          },
          {
            status: 409,
          }
        );
      }

      const deleteMediaPath =
        cleanText(
          data.mediaStoragePath,
          3000
        );

      if (
        deleteMediaPath &&
        deleteMediaPath.startsWith(
          `social-promotions/device/${decoded.uid}/`
        )
      ) {
        try {
          await adminBucket
            .file(
              deleteMediaPath
            )
            .delete({
              ignoreNotFound:
                true,
            });
        } catch (
          storageError
        ) {
          console.warn(
            "Customer old post media cleanup warning:",
            storageError
          );
        }
      }

      await postRef.delete();

      return Response.json({
        success: true,
        postId,
        status:
          "DELETED",
      });
    }

    if (
      data.status ===
      "PUBLISHED"
    ) {
      return Response.json(
        {
          success: false,
          error:
            "Published posts cannot be cancelled.",
        },
        {
          status: 409,
        }
      );
    }

    await postRef.set(
      {
        status:
          "CANCELLED",

        updatedAt:
          FieldValue
            .serverTimestamp(),
      },
      {
        merge: true,
      }
    );

    const storedMediaPath =
      cleanText(
        data.mediaStoragePath,
        3000
      );

    if (
      storedMediaPath &&
      storedMediaPath.startsWith(
        `social-promotions/device/${decoded.uid}/`
      )
    ) {
      try {
        await adminBucket
          .file(
            storedMediaPath
          )
          .delete({
            ignoreNotFound:
              true,
          });
      } catch (
        storageError
      ) {
        console.warn(
          "Customer cancelled media cleanup warning:",
          storageError
        );
      }
    }

    return Response.json({
      success: true,
    });
  } catch (error) {
    return errorResponse(error);
  }
}





