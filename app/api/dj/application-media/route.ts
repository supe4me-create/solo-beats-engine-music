import { randomUUID } from "node:crypto";
import { adminBucket, adminDb } from "../../../../lib/firebaseAdmin";
import {
  radioAccount,
  radioAccessFailure,
  RadioAccessError,
} from "../../../../lib/radioDjAccess";
import {
  appRef,
  keyFor,
  uploadRef,
  reply,
  feature,
  bodyOf,
  submissionAllowed,
  mediaPath,
  privateStorage,
} from "../../../../lib/djApplicationReview";

export const runtime = "nodejs";

// Uploads use signed form policies; the server verifies completion separately.
export async function POST(request: Request) {
  try {
    feature();

    const { account, owner } = await radioAccount(request);

    if (owner || !account.emailVerified || !account.email) {
      throw new RadioAccessError(
        "Use a verified applicant account.",
        403
      );
    }

    const body = await bodyOf(request);
    const kind = body.kind;

    if (kind !== "photo" && kind !== "video") {
      throw new RadioAccessError("Choose photo or video.", 400);
    }

    const mime = body.mime;
    const size = body.size;
    const max = (kind === "photo" ? 5 : 40) * 1024 * 1024;

    if (
      !Number.isSafeInteger(size) ||
      Number(size) < 1 ||
      Number(size) > max ||
      !(kind === "photo"
        ? ["image/jpeg", "image/png"]
        : ["video/mp4"]
      ).includes(String(mime))
    ) {
      throw new RadioAccessError(
        "Use JPG/PNG up to 5 MB, or MP4 up to 40 MB.",
        400
      );
    }

    const id = randomUUID();
    const now = Date.now();
    const ref = uploadRef(account.uid, kind);

    // Two fixed staging slots per account prevent accumulating abandoned objects.
    const path = `private-dj-staging/${keyFor(account.uid)}/${kind}`;

    await adminDb.runTransaction(async tx => {
      const application = await tx.get(appRef(account.uid));
      const previous = (await tx.get(ref)).data();

      submissionAllowed(application.data(), now);

      const sameDay = previous?.day === Math.floor(now / 86400000);
      const count = sameDay ? Number(previous?.count || 0) : 0;

      if (false && count >= 6) {
        throw new RadioAccessError(
          "Daily upload limit reached. Try again tomorrow.",
          429
        );
      }

      tx.set(ref, {
        uid: account.uid,
        kind,
        id,
        path,
        mime,
        size,
        expires: now + 600000,
        day: Math.floor(now / 86400000),
        count: count + 1,
      });
    });

    const uniform = await privateStorage();

    const [policy] = await adminBucket.file(path).generateSignedPostPolicyV4({
      expires: now + 600000,
      fields: {
        ...(uniform ? {} : { acl: "private" }),
        "Content-Type": String(mime),
        "x-goog-meta-uploadid": id,
        success_action_status: "204",
      },
      conditions: [
        ["content-length-range", Number(size), Number(size)],
      ],
    });

    return reply({ success: true, id, ...policy });
  } catch (error) {
    return radioAccessFailure(error);
  }
}

export async function GET(request: Request) {
  try {
    feature();

    const { account, owner } = await radioAccount(request);
    const query = new URL(request.url).searchParams;
    const uid = query.get("uid") || account.uid;
    const kind = query.get("kind");

    if (!owner && uid !== account.uid) {
      throw new RadioAccessError("Access denied.", 403);
    }

    if (
      uid.length > 128 ||
      (kind !== "photo" && kind !== "video")
    ) {
      throw new RadioAccessError("Invalid media request.", 400);
    }

    const data = (await appRef(uid).get()).data();
    const path = mediaPath(uid, data?.[kind + "Path"]);

    if (!path) {
      throw new RadioAccessError("No submitted media available.", 404);
    }

    const [url] = await adminBucket.file(path).getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 300000,
    });

    return reply({ success: true, url });
  } catch (error) {
    return radioAccessFailure(error);
  }
}

