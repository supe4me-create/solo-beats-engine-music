import { randomUUID } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import {
  adminBucket,
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";
import {
  radioAccount,
  requireRadioOwner,
  radioAccessFailure,
  RadioAccessError,
} from "../../../../lib/radioDjAccess";
import {
  appRef,
  noteRef,
  uploadRef,
  keyFor,
  reply,
  feature,
  bodyOf,
  validateProfile,
  submissionAllowed,
  mediaPath,
  privateStorage,
} from "../../../../lib/djApplicationReview";

export const runtime = "nodejs";
export const maxDuration = 60;

function publicApplication(data: Record<string, unknown> | undefined) {
  if (!data) return null;

  const fields = [
    "uid", "email", "name", "legalName", "displayName",
    "djName", "city", "country", "introduction", "musicUrl",
    "links", "status", "requestedAt", "updatedAt",
    "feedback", "version",
  ];

  return {
    ...Object.fromEntries(fields.map(key => [key, data[key] ?? null])),
    hasPhoto: !!data.photoPath,
    hasVideo: !!data.videoPath,
  };
}

async function removeMedia(uid: string, paths: unknown[]) {
  let failed = false;

  for (const value of paths) {
    const path = mediaPath(uid, value);
    if (!path) continue;

    try {
      await adminBucket.file(path).delete({ ignoreNotFound: true });
    } catch {
      failed = true;
    }
  }

  return failed;
}

// Checks the MP4 container's declared duration; owner review checks the content.
function mp4Duration(bytes: Buffer): number {
  function scan(start: number, end: number, nested: boolean): number {
    let pos = start;

    while (pos + 8 <= end) {
      let size = bytes.readUInt32BE(pos);
      let header = 8;
      const type = bytes.toString("ascii", pos + 4, pos + 8);

      if (size === 1) {
        if (pos + 16 > end) break;
        const large = bytes.readBigUInt64BE(pos + 8);
        if (large > BigInt(Number.MAX_SAFE_INTEGER)) break;
        size = Number(large);
        header = 16;
      }

      if (size === 0) size = end - pos;
      if (size < header || pos + size > end) break;

      const data = pos + header;

      if (type === "moov" && !nested) {
        const result = scan(data, pos + size, true);
        if (Number.isFinite(result)) return result;
      }

      if (type === "mvhd" && nested) {
        const version = bytes[data];

        if (version === 0 && data + 20 <= pos + size) {
          return bytes.readUInt32BE(data + 16) /
            bytes.readUInt32BE(data + 12);
        }

        if (version === 1 && data + 32 <= pos + size) {
          return Number(bytes.readBigUInt64BE(data + 24)) /
            bytes.readUInt32BE(data + 20);
        }
      }

      pos += size;
    }

    return NaN;
  }

  return scan(0, bytes.length, false);
}

export async function GET(request: Request) {
  try {
    const access = await radioAccount(request);

    if (process.env.RADIO_DJ_REQUESTS_ENABLED === "false") {
      return reply({ success: true, enabled: false });
    }

    if (access.owner) {
      const query = new URL(request.url).searchParams;
      const filter = query.get("status") || "pending";

      if (
        !["pending", "more_info", "approved", "declined", "revoked", "deleted"]
          .includes(filter)
      ) {
        throw new RadioAccessError("Invalid filter.", 400);
      }

      const snapshot = await adminDb
        .collection("radioDjRequests")
        .where("status", "==", filter)
        .limit(100)
        .get();

      const rows = snapshot.docs
        .map(doc => doc.data())
        .filter(row => typeof row.uid === "string" && row.uid.length <= 128);

      const current = rows.length
        ? await getAuth(firebaseAdminApp).getUsers(
            rows.map(row => ({ uid: row.uid }))
          )
        : { users: [] };

      return reply({
        success: true,
        enabled: true,
        hasMore: snapshot.size === 100,
        requests: rows.map(row => {
          const account = current.users.find(user => user.uid === row.uid);

          return {
            ...publicApplication(row),
            email: account?.email || row.email || "",
            emailVerified: account?.emailVerified === true,
            accountDisabled: !account || account.disabled,
          };
        }),
      });
    }

    const data = (await appRef(access.account.uid).get()).data();
    let canApply = true;
    let blocked = "";

    try {
      submissionAllowed(data, Date.now());
    } catch (error) {
      canApply = false;
      blocked = (error as Error).message;
    }

    return reply({
      success: true,
      enabled: true,
      application: publicApplication(data),
      status: data?.status || "none",
      canApply,
      blocked,
      emailVerified: access.account.emailVerified,
      accessReason: access.reason,
    });
  } catch (error) {
    return radioAccessFailure(error);
  }
}

export async function POST(request: Request) {
  const created: string[] = [];
  let committed = false;
  let uid = "";

  try {
    feature();

    const { account, owner } = await radioAccount(request);
    uid = account.uid;

    if (owner || !account.emailVerified || !account.email) {
      throw new RadioAccessError("Use a verified applicant account.", 403);
    }

    const body = await bodyOf(request);
    const profile = validateProfile(body);
    const ref = appRef(uid);
    const prior = (await ref.get()).data();

    submissionAllowed(prior, Date.now());

    const revision = randomUUID();
    const uniform = await privateStorage();
    const media: Record<string, string> = {};

    for (const kind of ["photo", "video"]) {
      const id = body[kind + "Id"];
      const previousPath = mediaPath(uid, prior?.[kind + "Path"]);

      if (!id && previousPath) {
        media[kind + "Path"] = previousPath;
        continue;
      }

      if (typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id)) {
        throw new RadioAccessError(`Upload your ${kind} first.`, 400);
      }

      const upload = (await uploadRef(uid, kind).get()).data();

      if (
        !upload ||
        upload.id !== id ||
        upload.uid !== uid ||
        upload.expires < Date.now()
      ) {
        throw new RadioAccessError(
          `${kind} upload expired. Select the file again.`,
          400
        );
      }

      const sourcePath = `private-dj-staging/${keyFor(uid)}/${kind}`;
      const [metadata] = await adminBucket.file(sourcePath).getMetadata();

      if (
        Number(metadata.size) !== upload.size ||
        metadata.contentType !== upload.mime ||
        metadata.metadata?.uploadid !== id
      ) {
        throw new RadioAccessError(
          `${kind} upload is incomplete. Select the file again.`,
          400
        );
      }

      const max = (kind === "photo" ? 5 : 40) * 1024 * 1024;

      if (Number(metadata.size) > max) {
        throw new RadioAccessError("File is too large.", 400);
      }

      const source = adminBucket.file(sourcePath, {
        generation: Number(metadata.generation),
      });

      const [bytes] = await source.download();

      if (kind === "photo") {
        const valid = upload.mime === "image/png"
          ? bytes.subarray(0, 8).equals(
              Buffer.from([137,80,78,71,13,10,26,10])
            )
          : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;

        if (!valid) {
          throw new RadioAccessError("Photo must be a valid JPG or PNG.", 400);
        }
      } else {
        const duration = mp4Duration(bytes);

        if (!Number.isFinite(duration) || duration < 30 || duration > 60.5) {
          throw new RadioAccessError(
            "Intro video must be an MP4 between 30 and 60 seconds.",
            400
          );
        }
      }

      const destination =
        `private-dj-applications/${keyFor(uid)}/${revision}/${kind}`;

      created.push(destination);

      // Submitted copies have no signed upload policy.
      await adminBucket.file(destination).save(bytes, {
        resumable: false,
        ...(uniform ? {} : { predefinedAcl: "private" as const }),
        metadata: {
          contentType: String(upload.mime),
          cacheControl: "private, no-store",
          metadata: { applicant: keyFor(uid) },
        },
      });

      media[kind + "Path"] = destination;
    }

    const now = Date.now();

    await adminDb.runTransaction(async tx => {
      const latest = (await tx.get(ref)).data();

      submissionAllowed(latest, now);

      if (latest?.updatedAt !== prior?.updatedAt) {
        throw new RadioAccessError(
          "Application changed. Reload before submitting.",
          409
        );
      }

      tx.set(ref, {
        ...profile,
        ...media,
        uid,
        email: account.email,
        name: account.displayName || "",
        version: 3,
        status: "pending",
        requestedAt: now,
        updatedAt: now,
        consentAt: now,
      });

      tx.set(noteRef(uid), {
        type: "dj_access_request",
        category: "radio",
        title: "DJ application ready for review",
        message: profile.djName + " submitted a DJ application.",
        targetUrl: "/dj/radio#dj-requests",
        relatedId: uid,
        read: false,
        createdAt: new Date(now),
        updatedAt: new Date(now),
      });
    });

    committed = true;

    const failed = await removeMedia(
      uid,
      [prior?.photoPath, prior?.videoPath].filter(
        path => !Object.values(media).includes(String(path))
      )
    );

    return reply({
      success: true,
      message:
        "Application submitted. DJ permissions are unchanged." +
        (failed ? " Old media cleanup needs owner attention." : ""),
    });
  } catch (error) {
    if (!committed && uid) {
      await removeMedia(uid, created);
    }

    return radioAccessFailure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    feature();

    const { account: owner } = await requireRadioOwner(request);
    const body = await bodyOf(request);
    const uid = body.uid;
    const action = body.action;

    if (
      typeof uid !== "string" ||
      !uid ||
      uid.length > 128 ||
      uid === owner.uid ||
      !["approve", "decline", "more_info", "delete"].includes(String(action))
    ) {
      throw new RadioAccessError("Invalid review action.", 400);
    }

    const feedback =
      typeof body.feedback === "string" ? body.feedback.trim() : "";

    if (
      feedback.length > 1000 ||
      (action === "more_info" && !feedback)
    ) {
      throw new RadioAccessError(
        "Explain the requested information (up to 1000 characters).",
        400
      );
    }

    if (action === "approve") {
      const target = await getAuth(firebaseAdminApp).getUser(uid);

      if (target.disabled || !target.emailVerified) {
        throw new RadioAccessError(
          "Applicant must have an enabled account and verified email.",
          400
        );
      }
    }

    const ref = appRef(uid);
    let removed: unknown[] = [];

    await adminDb.runTransaction(async tx => {
      const doc = await tx.get(ref);
      const note = await tx.get(noteRef(uid));
      const data = doc.data();
      const photoUpload = (await tx.get(uploadRef(uid, "photo"))).data();
      const videoUpload = (await tx.get(uploadRef(uid, "video"))).data();

      if (!data || data.updatedAt !== body.updatedAt) {
        throw new RadioAccessError(
          "Application changed. Refresh the list.",
          409
        );
      }

      if (
        ["approve", "decline"].includes(String(action)) &&
        !["pending", "more_info"].includes(data.status)
      ) {
        throw new RadioAccessError(
          "Only open applications can be reviewed.",
          409
        );
      }

      if (
        action === "approve" &&
        (
          data.version !== 3 ||
          !mediaPath(uid, data.photoPath) ||
          !mediaPath(uid, data.videoPath)
        )
      ) {
        throw new RadioAccessError(
          "Legacy application: request more information so the DJ can complete the new form.",
          409
        );
      }

      const now = Math.max(Date.now(), Number(data.updatedAt || 0) + 1);

      if (action === "delete") {
        if (
          Math.max(
            Number(photoUpload?.expires || 0),
            Number(videoUpload?.expires || 0)
          ) > now
        ) {
          throw new RadioAccessError(
            "An upload permission is still active. Wait 10 minutes after the last upload before deleting.",
            409
          );
        }

        removed = [
          data.photoPath,
          data.videoPath,
          ...(Array.isArray(data.cleanupPaths) ? data.cleanupPaths : []),
        ];

        // Retain only a cooldown tombstone, not submitted personal details.
        tx.set(ref, {
          uid,
          status: "deleted",
          updatedAt: now,
          cleanupPaths: removed.filter(path => mediaPath(uid, path)),
        });
      } else {
        tx.update(ref, {
          status:
            action === "approve"
              ? "approved"
              : action === "decline"
                ? "declined"
                : "more_info",
          feedback,
          updatedAt: now,
          decidedBy: owner.uid,
        });
      }

      if (note.exists) {
        tx.update(note.ref, {
          read: true,
          updatedAt: new Date(now),
          message: "DJ application reviewed.",
        });
      }
    });
    // ==========================================================
    // SOLO_DJ_APPROVAL_PAID_GATE_V2
    // Application approval allows the DJ to choose a paid plan.
    // It does NOT unlock the DJ tools by itself.
    // Verified PayPal payment automatically activates access.
    // Grant Free Access remains an explicit owner option.
    // ==========================================================
    if (action === "approve") {
      const auth = getAuth(firebaseAdminApp);
      const approvedUser = await auth.getUser(uid);

      if (approvedUser.disabled || !approvedUser.emailVerified) {
        throw new RadioAccessError(
          "Applicant must have an enabled account and verified email.",
          400
        );
      }

      const claims = {
        ...(approvedUser.customClaims || {}),
        soloBeatsRadioDj: true,
        "soloBeatsDjPolicy": {
          v: 1,
          type: "paid",
          state: "active",
          start: null,
          end: null,
          paidApproved: false,
        },
      };

      await auth.setCustomUserClaims(uid, claims);
    }

    let failed = await removeMedia(uid, removed);

    if (action === "delete") {
      for (const kind of ["photo", "video"]) {
        try {
          await adminBucket
            .file(`private-dj-staging/${keyFor(uid)}/${kind}`)
            .delete({ ignoreNotFound: true });
        } catch {
          failed = true;
        }
      }

      if (!failed) {
        await ref.update({ cleanupPaths: [] });
      }
    }

    return reply({
      success: true,
      message:
        (
          action === "approve"
            ? "Application approved. The DJ can now choose a paid access plan. Use Grant Free Access if you want to provide complimentary access."
            : action === "delete"
              ? "Application details deleted. Account and DJ permissions unchanged. Storage retention/soft-delete policies may retain recovery copies."
              : "Review decision saved. DJ permissions unchanged."
        ) +
        (
          failed
            ? " Media cleanup failed; contact the owner before considering deletion complete."
            : ""
        ),
    });
  } catch (error) {
    return radioAccessFailure(error);
  }
}

