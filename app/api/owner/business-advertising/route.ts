import { chargeSavedMethod } from "../../../../lib/paypalVault";
import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { adminBucket, adminDb, firebaseAdminApp } from "../../../../lib/firebaseAdmin";

const OWNER_EMAIL = "supe4.me@gmail.com";

function bearer(request: Request) {
  const value = request.headers.get("authorization") || "";
  return value.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null;
}

async function verifyOwner(request: Request) {
  const token = bearer(request);
  if (!token) throw new Error("OWNER_AUTH_REQUIRED");
  const decoded = await getAuth(firebaseAdminApp).verifyIdToken(token);
  if (decoded.email?.toLowerCase() !== OWNER_EMAIL) {
    throw new Error("OWNER_ACCESS_ONLY");
  }
  return decoded;
}

function toIso(value: unknown): string | null {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return typeof value === "string" ? value : null;
}

async function signedUrl(path: unknown): Promise<string | null> {
  if (typeof path !== "string" || !path) return null;
  try {
    const file = adminBucket.file(path);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 60 * 60 * 1000,
    });
    return url;
  } catch (error) {
    console.error("Business advertising preview URL error:", error);
    return null;
  }
}

function authError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "OWNER_AUTH_REQUIRED") {
    return NextResponse.json(
      { success: false, error: "Owner sign-in is required." },
      { status: 401 }
    );
  }
  if (message === "OWNER_ACCESS_ONLY") {
    return NextResponse.json(
      { success: false, error: "Owner access only." },
      { status: 403 }
    );
  }
  return null;
}

function isExpiredSchedule(
  endDate: unknown
) {
  if (
    typeof endDate !== "string" ||
    !endDate
  ) {
    return false;
  }

  const end = new Date(
    `${endDate}T23:59:59.999Z`
  );

  return (
    !Number.isNaN(end.getTime()) &&
    new Date() > end
  );
}

export async function GET(request: Request) {
  try {
    await verifyOwner(request);

    const snapshot = await adminDb
      .collection("businessAdvertisingSubmissions")
      .orderBy("createdAt", "desc")
      .get();

    const expiredDocuments =
      snapshot.docs.filter((document) => {
        const data = document.data();

        return (
          data.placementStatus === "scheduled" &&
          data.reviewStatus === "approved" &&
          data.paymentStatus === "paid" &&
          isExpiredSchedule(
            data.scheduleEndDate
          )
        );
      });

    const expiredIds = new Set(
      expiredDocuments.map(
        (document) => document.id
      )
    );

    if (expiredDocuments.length > 0) {
      const batch = adminDb.batch();

      expiredDocuments.forEach(
        (document) => {
          batch.set(
            document.ref,
            {
              placementStatus: "expired",
              expiredAt:
                FieldValue.serverTimestamp(),
              updatedAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
      );

      await batch.commit();
    }

    const submissions = await Promise.all(
      snapshot.docs.map(async (document) => {
        const data = document.data();
        const [imageUrl, videoUrl] = await Promise.all([
          signedUrl(data.imageStoragePath),
          signedUrl(data.videoStoragePath),
        ]);

        return {
          submissionId: document.id,
          advertiserAccountEmail: data.advertiserAccountEmail || null,
          businessName: data.businessName || "Unknown Business",
          contactName: data.contactName || "Unknown Contact",
          businessEmail: data.businessEmail || null,
          businessWebsite: data.businessWebsite || null,
          campaignName: data.campaignName || "Untitled Campaign",
          campaignGoal: data.campaignGoal || "other",
          headline: data.headline || "",
          description: data.description || "",
          callToAction: data.callToAction || "Learn More",
          targetAudience: data.targetAudience || null,
          targetGenre: data.targetGenre || null,
          requestedPlacements: Array.isArray(data.requestedPlacements)
            ? data.requestedPlacements
            : [],
          requestedDurationDays: Number(data.requestedDurationDays || 0),
          proposedBudget: data.proposedBudget || "0.00",
          finalPrice: data.finalPrice || null,
          currency: data.currency || "USD",
          preferredStartDate: data.preferredStartDate || null,
          youtubeLink: data.youtubeLink || null,
          creativeType: data.creativeType || "image",
          reviewStatus: data.reviewStatus || "pending",
          paymentStatus: data.paymentStatus || "not_requested",
          placementStatus:
            expiredIds.has(document.id)
              ? "expired"
              : data.placementStatus ||
                "not_scheduled",
          sponsoredLabel: data.sponsoredLabel || "Sponsored",
          createdAt: toIso(data.createdAt),
          reviewedAt: toIso(data.reviewedAt),
          rejectionReason: data.rejectionReason || null,
          scheduleStartDate: data.scheduleStartDate || null,
          scheduleEndDate: data.scheduleEndDate || null,
          placementLocation: data.placementLocation || null,
          placementLocations: Array.isArray(data.placementLocations)
            ? data.placementLocations
            : data.placementLocation
              ? [data.placementLocation]
              : [],
          imageUrl,
          videoUrl,
        };
      })
    );

    return NextResponse.json({ success: true, submissions });
  } catch (error) {
    const known = authError(error);
    if (known) return known;
    console.error("Business advertising owner list error:", error);
    return NextResponse.json(
      { success: false, error: "Business advertising submissions could not be loaded." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const owner = await verifyOwner(request);
    const body = await request.json();

    const submissionId =
      typeof body.submissionId === "string" ? body.submissionId.trim() : "";
    const action =
      body.action === "approve" ||
      body.action === "reject" ||
      body.action === "schedule" ||
      body.action === "deactivate"
        ? body.action
        : "";
    const rejectionReason =
      typeof body.rejectionReason === "string" ? body.rejectionReason.trim() : "";
    const requestedFinalPrice = Number(body.finalPrice);

    if (!submissionId || !action) {
      return NextResponse.json(
        { success: false, error: "A valid submission and review action are required." },
        { status: 400 }
      );
    }

    if (action === "reject" && !rejectionReason) {
      return NextResponse.json(
        { success: false, error: "A rejection reason is required." },
        { status: 400 }
      );
    }

    const ref = adminDb.collection("businessAdvertisingSubmissions").doc(submissionId);
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return NextResponse.json(
        { success: false, error: "The business advertising submission was not found." },
        { status: 404 }
      );
    }

    if (action === "approve") {
      const lockedPrice = Number(
        snapshot.data()?.proposedBudget
      );

      if (!Number.isFinite(lockedPrice) || lockedPrice <= 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              "This campaign does not have a valid locked platform price.",
          },
          { status: 400 }
        );
      }
    }

    if (action === "schedule") {
      const submission =
        snapshot.data() || {};

      if (
        submission.reviewStatus !==
          "approved" ||
        submission.paymentStatus !==
          "paid"
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Only approved and paid business campaigns can be scheduled.",
          },
          { status: 400 }
        );
      }

      const startDate =
        typeof body.startDate ===
          "string"
          ? body.startDate.trim()
          : "";
      const endDate =
        typeof body.endDate ===
          "string"
          ? body.endDate.trim()
          : "";
      const requestedPlacements =
        Array.isArray(submission.requestedPlacements)
          ? submission.requestedPlacements.filter(
              (placement: unknown): placement is string =>
                typeof placement === "string" &&
                ["homepage", "store", "radio", "tv"].includes(
                  placement
                )
            )
          : [];

      const placementLocations = Array.from(
        new Set(requestedPlacements)
      );

      const start =
        new Date(
          `${startDate}T00:00:00.000Z`
        );
      const end =
        new Date(
          `${endDate}T23:59:59.999Z`
        );

      if (
        !startDate ||
        !endDate ||
        Number.isNaN(
          start.getTime()
        ) ||
        Number.isNaN(
          end.getTime()
        ) ||
        end <= start
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Choose a valid start date and end date.",
          },
          { status: 400 }
        );
      }

      if (placementLocations.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              "This campaign does not contain a valid purchased placement.",
          },
          { status: 400 }
        );
      }

      const purchasedDays =
        Number(
          submission.requestedDurationDays ||
            0
        );

      const scheduledDays =
        Math.ceil(
          (end.getTime() -
            start.getTime()) /
            (24 * 60 * 60 * 1000)
        );

      if (
        scheduledDays >
        purchasedDays
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              `This campaign purchased ${purchasedDays} days. The selected schedule is ${scheduledDays} days.`,
          },
          { status: 400 }
        );
      }

      await ref.set(
        {
          placementStatus:
            "scheduled",
          scheduleStartDate:
            startDate,
          scheduleEndDate:
            endDate,
          placementLocation:
            placementLocations[0],
          placementLocations,
          scheduledByUid:
            owner.uid,
          scheduledByEmail:
            owner.email || null,
          scheduledAt:
            FieldValue.serverTimestamp(),
          updatedAt:
            FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return NextResponse.json({
        success: true,
        submissionId,
        placementStatus:
          "scheduled",
        scheduleStartDate:
          startDate,
        scheduleEndDate:
          endDate,
        placementLocation:
          placementLocations[0],
        placementLocations,
      });
    }

    if (action === "deactivate") {
      const submission =
        snapshot.data() || {};

      if (
        submission.reviewStatus !==
          "approved"
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Only an approved business campaign can be deactivated.",
          },
          { status: 400 }
        );
      }

      await ref.set(
        {
          placementStatus:
            "deactivated",
          deactivatedAt:
            FieldValue.serverTimestamp(),
          deactivatedByUid:
            owner.uid,
          deactivatedByEmail:
            owner.email || null,
          updatedAt:
            FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return NextResponse.json({
        success: true,
        submissionId,
        reviewStatus:
          submission.reviewStatus,
        paymentStatus:
          submission.paymentStatus ||
          "not_requested",
        placementStatus:
          "deactivated",
      });
    }

    let automaticPayment:
      | Awaited<
          ReturnType<
            typeof chargeSavedMethod
          >
        >
      | null = null;

    if (action === "approve") {
      const submission =
        snapshot.data() || {};
      const lockedPrice = Number(
        submission.proposedBudget
      ).toFixed(2);

      automaticPayment =
        await chargeSavedMethod({
          uid:
            submission.advertiserUid ||
            "",
          submissionId,
          amount: lockedPrice,
          campaignName:
            submission.campaignName ||
            "Business Advertising",
        });
    }

    const update =
      action === "approve"
        ? {
            reviewStatus: "approved",
            paymentStatus:
              automaticPayment?.success
                ? "paid"
                : "awaiting_payment",
            placementStatus:
              automaticPayment?.success
                ? "ready_to_schedule"
                : "not_scheduled",
            finalPrice: Number(
          snapshot.data()?.proposedBudget ||
          requestedFinalPrice
        ).toFixed(2),
            rejectionReason: null,
            automaticPaymentAttempted:
              true,
            automaticPaymentError:
              automaticPayment &&
              !automaticPayment.success
                ? automaticPayment.error
                : null,
            paymentOrderId:
              automaticPayment?.success
                ? automaticPayment.orderId
                : null,
            paymentCaptureId:
              automaticPayment?.success
                ? automaticPayment.captureId
                : null,
            paidAmount:
              automaticPayment?.success
                ? automaticPayment.amount
                : null,
            paidCurrency:
              automaticPayment?.success
                ? automaticPayment.currency
                : null,
            paidAt:
              automaticPayment?.success
                ? FieldValue.serverTimestamp()
                : null,
            reviewedByUid: owner.uid,
            reviewedByEmail: owner.email || null,
            reviewedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          }
        : {
            reviewStatus: "rejected",
            paymentStatus: "not_requested",
            placementStatus: "not_scheduled",
            rejectionReason,
            reviewedByUid: owner.uid,
            reviewedByEmail: owner.email || null,
            reviewedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          };

    await ref.set(update, { merge: true });

    return NextResponse.json({
      success: true,
      submissionId,
      reviewStatus: action === "approve" ? "approved" : "rejected",
      paymentStatus:
        action === "approve"
          ? automaticPayment?.success
            ? "paid"
            : "awaiting_payment"
          : "not_requested",
      placementStatus:
        action === "approve" &&
        automaticPayment?.success
          ? "ready_to_schedule"
          : "not_scheduled",
      automaticPayment:
        action === "approve"
          ? automaticPayment?.success
            ? {
                success: true,
                orderId:
                  automaticPayment.orderId,
                captureId:
                  automaticPayment.captureId,
              }
            : {
                success: false,
                fallbackToCheckout:
                  true,
                error:
                  automaticPayment?.error ||
                  "The customer must complete normal checkout.",
              }
          : null,
      finalPrice: action === "approve"
        ? Number(snapshot.data()?.proposedBudget).toFixed(2)
        : null,
      rejectionReason: action === "reject" ? rejectionReason : null,
      reviewedAt: new Date().toISOString(),
    });
  } catch (error) {
    const known = authError(error);
    if (known) return known;
    console.error("Business advertising owner review error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "The business advertising submission could not be reviewed.",
      },
      { status: 500 }
    );
  }
}





