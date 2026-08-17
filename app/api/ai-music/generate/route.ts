import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

const OWNER_EMAIL = "supe4.me@gmail.com";

const FREE_TRIAL_LIMIT = 2;

const PREMIUM_MONTHLY_CREDITS = 10;

const PREMIUM_GENERATION_COST = 1;

const PREMIUM_CYCLE_MS =
  30 * 24 * 60 * 60 * 1000;

type GenerateRequest = {
  prompt?: string;
  genre?: string;
  mood?: string;
  bpm?: number;
  musicKey?: string;
  duration?: number;
  vocalMode?:
    | "instrumental"
    | "vocals";
};

function bearerToken(
  request: Request
): string | null {
  const authorization =
    request.headers.get(
      "authorization"
    );

  const match =
    authorization?.match(
      /^Bearer\s+(.+)$/i
    );

  return (
    match?.[1]?.trim() ||
    null
  );
}

async function authenticatedUser(
  request: Request
) {
  const token =
    bearerToken(request);

  if (!token) {
    throw new Error(
      "AUTH_REQUIRED"
    );
  }

  try {
    return await getAuth(
      firebaseAdminApp
    ).verifyIdToken(token);
  } catch {
    throw new Error(
      "AUTH_INVALID"
    );
  }
}

function newPremiumCycle() {
  const start =
    new Date();

  const end =
    new Date(
      start.getTime() +
        PREMIUM_CYCLE_MS
    );

  return {
    premiumCreditsRemaining:
      PREMIUM_MONTHLY_CREDITS,
    premiumCreditsLimit:
      PREMIUM_MONTHLY_CREDITS,
    premiumCreditPeriodStart:
      start.toISOString(),
    premiumCreditPeriodEnd:
      end.toISOString(),
  };
}

function premiumPeriodExpired(
  value: unknown
) {
  if (
    typeof value !== "string"
  ) {
    return true;
  }

  const time =
    Date.parse(value);

  return (
    !Number.isFinite(time) ||
    time <= Date.now()
  );
}

async function ensurePremiumCredits(
  uid: string
) {
  const ref =
    adminDb
      .collection(
        "aiMusicUsage"
      )
      .doc(uid);

  return adminDb.runTransaction(
    async (transaction) => {
      const snapshot =
        await transaction.get(
          ref
        );

      const data =
        snapshot.data() || {};

      const currentRemaining =
        typeof data
          .premiumCreditsRemaining ===
        "number"
          ? data
              .premiumCreditsRemaining
          : null;

      const currentLimit =
        typeof data
          .premiumCreditsLimit ===
        "number"
          ? data
              .premiumCreditsLimit
          : null;

      const expired =
        premiumPeriodExpired(
          data
            .premiumCreditPeriodEnd
        );

      if (
        currentRemaining ===
          null ||
        currentLimit === null ||
        expired
      ) {
        const cycle =
          newPremiumCycle();

        transaction.set(
          ref,
          {
            uid,
            ...cycle,
            updatedAt:
              new Date()
                .toISOString(),
          },
          { merge: true }
        );

        return cycle;
      }

      const safeRemaining =
        Math.max(
          0,
          Math.min(
            PREMIUM_MONTHLY_CREDITS,
            currentRemaining
          )
        );

      return {
        premiumCreditsRemaining:
          safeRemaining,
        premiumCreditsLimit:
          PREMIUM_MONTHLY_CREDITS,
        premiumCreditPeriodStart:
          typeof data
            .premiumCreditPeriodStart ===
          "string"
            ? data
                .premiumCreditPeriodStart
            : "",
        premiumCreditPeriodEnd:
          typeof data
            .premiumCreditPeriodEnd ===
          "string"
            ? data
                .premiumCreditPeriodEnd
            : "",
      };
    }
  );
}

async function reservePremiumGeneration(
  uid: string
) {
  const ref =
    adminDb
      .collection(
        "aiMusicUsage"
      )
      .doc(uid);

  return adminDb.runTransaction(
    async (transaction) => {
      const snapshot =
        await transaction.get(
          ref
        );

      const data =
        snapshot.data() || {};

      let remaining =
        typeof data
          .premiumCreditsRemaining ===
        "number"
          ? data
              .premiumCreditsRemaining
          : PREMIUM_MONTHLY_CREDITS;

      let periodStart =
        typeof data
          .premiumCreditPeriodStart ===
        "string"
          ? data
              .premiumCreditPeriodStart
          : "";

      let periodEnd =
        typeof data
          .premiumCreditPeriodEnd ===
        "string"
          ? data
              .premiumCreditPeriodEnd
          : "";

      if (
        !periodStart ||
        premiumPeriodExpired(
          periodEnd
        )
      ) {
        const cycle =
          newPremiumCycle();

        remaining =
          cycle
            .premiumCreditsRemaining;

        periodStart =
          cycle
            .premiumCreditPeriodStart;

        periodEnd =
          cycle
            .premiumCreditPeriodEnd;
      }

      if (
        remaining <
        PREMIUM_GENERATION_COST
      ) {
        throw new Error(
          "PREMIUM_CREDITS_EXHAUSTED"
        );
      }

      const nextRemaining =
        Math.max(
          0,
          remaining -
            PREMIUM_GENERATION_COST
        );

      transaction.set(
        ref,
        {
          uid,
          premiumCreditsRemaining:
            nextRemaining,
          premiumCreditsLimit:
            PREMIUM_MONTHLY_CREDITS,
          premiumCreditPeriodStart:
            periodStart,
          premiumCreditPeriodEnd:
            periodEnd,
          updatedAt:
            new Date()
              .toISOString(),
        },
        { merge: true }
      );

      return {
        premiumCreditsRemaining:
          nextRemaining,
        premiumCreditsLimit:
          PREMIUM_MONTHLY_CREDITS,
        premiumCreditPeriodStart:
          periodStart,
        premiumCreditPeriodEnd:
          periodEnd,
      };
    }
  );
}

async function refundPremiumGeneration(
  uid: string
) {
  const ref =
    adminDb
      .collection(
        "aiMusicUsage"
      )
      .doc(uid);

  await adminDb.runTransaction(
    async (transaction) => {
      const snapshot =
        await transaction.get(
          ref
        );

      const data =
        snapshot.data() || {};

      const remaining =
        typeof data
          .premiumCreditsRemaining ===
        "number"
          ? data
              .premiumCreditsRemaining
          : 0;

      transaction.set(
        ref,
        {
          premiumCreditsRemaining:
            Math.min(
              PREMIUM_MONTHLY_CREDITS,
              remaining +
                PREMIUM_GENERATION_COST
            ),
          premiumCreditsLimit:
            PREMIUM_MONTHLY_CREDITS,
          updatedAt:
            new Date()
              .toISOString(),
        },
        { merge: true }
      );
    }
  );
}

async function getAccess(
  uid: string,
  email?: string
) {
  const isOwner =
    (email || "")
      .toLowerCase() ===
    OWNER_EMAIL.toLowerCase();

  if (isOwner) {
    return {
      isOwner: true,
      premiumActive: true,

      freeUsed: 0,
      freeRemaining:
        FREE_TRIAL_LIMIT,

      premiumCreditsRemaining:
        PREMIUM_MONTHLY_CREDITS,

      premiumCreditsLimit:
        PREMIUM_MONTHLY_CREDITS,

      premiumCreditPeriodEnd:
        "",

      premiumGenerationCost:
        0,

      canGenerate: true,

      accessMode:
        "owner" as const,
    };
  }

  const [
    premiumSnapshot,
    usageSnapshot,
  ] = await Promise.all([
    adminDb
      .collection(
        "premiumSubscriptions"
      )
      .doc(uid)
      .get(),

    adminDb
      .collection(
        "aiMusicUsage"
      )
      .doc(uid)
      .get(),
  ]);

  const premium =
    premiumSnapshot.data() ||
    {};

  const premiumActive =
    premiumSnapshot.exists &&
    premium.premiumActive ===
      true &&
    premium.status ===
      "ACTIVE";

  const usage =
    usageSnapshot.data() || {};

  const freeUsed =
    typeof usage
      .freeGenerationsUsed ===
    "number"
      ? usage
          .freeGenerationsUsed
      : 0;

  const freeRemaining =
    Math.max(
      0,
      FREE_TRIAL_LIMIT -
        freeUsed
    );

  if (premiumActive) {
    const credits =
      await ensurePremiumCredits(
        uid
      );

    return {
      isOwner: false,
      premiumActive: true,

      freeUsed,
      freeRemaining,

      ...credits,

      premiumGenerationCost:
        PREMIUM_GENERATION_COST,

      canGenerate:
        credits
          .premiumCreditsRemaining >=
        PREMIUM_GENERATION_COST,

      accessMode:
        "premium" as const,
    };
  }

  return {
    isOwner: false,
    premiumActive: false,

    freeUsed,
    freeRemaining,

    premiumCreditsRemaining:
      0,

    premiumCreditsLimit:
      PREMIUM_MONTHLY_CREDITS,

    premiumCreditPeriodEnd:
      "",

    premiumGenerationCost:
      PREMIUM_GENERATION_COST,

    canGenerate:
      freeRemaining > 0,

    accessMode:
      freeRemaining > 0
        ? ("trial" as const)
        : ("locked" as const),
  };
}

async function reserveFreeGeneration(
  uid: string
) {
  const ref =
    adminDb
      .collection(
        "aiMusicUsage"
      )
      .doc(uid);

  return adminDb.runTransaction(
    async (transaction) => {
      const snapshot =
        await transaction.get(
          ref
        );

      const data =
        snapshot.data() || {};

      const used =
        typeof data
          .freeGenerationsUsed ===
        "number"
          ? data
              .freeGenerationsUsed
          : 0;

      if (
        used >=
        FREE_TRIAL_LIMIT
      ) {
        throw new Error(
          "FREE_TRIAL_EXHAUSTED"
        );
      }

      const nextUsed =
        used + 1;

      transaction.set(
        ref,
        {
          uid,

          freeGenerationsUsed:
            nextUsed,

          updatedAt:
            new Date()
              .toISOString(),
        },
        { merge: true }
      );

      return {
        freeUsed:
          nextUsed,

        freeRemaining:
          Math.max(
            0,
            FREE_TRIAL_LIMIT -
              nextUsed
          ),
      };
    }
  );
}

async function refundFreeGeneration(
  uid: string
) {
  const ref =
    adminDb
      .collection(
        "aiMusicUsage"
      )
      .doc(uid);

  await adminDb.runTransaction(
    async (transaction) => {
      const snapshot =
        await transaction.get(
          ref
        );

      const data =
        snapshot.data() || {};

      const used =
        typeof data
          .freeGenerationsUsed ===
        "number"
          ? data
              .freeGenerationsUsed
          : 0;

      transaction.set(
        ref,
        {
          freeGenerationsUsed:
            Math.max(
              0,
              used - 1
            ),

          updatedAt:
            new Date()
              .toISOString(),
        },
        { merge: true }
      );
    }
  );
}

export async function GET(
  request: Request
) {
  try {
    const user =
      await authenticatedUser(
        request
      );

    const access =
      await getAccess(
        user.uid,
        user.email
      );

    return NextResponse.json({
      success: true,
      ...access,

      freeTrialLimit:
        FREE_TRIAL_LIMIT,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "";

    if (
      message ===
      "AUTH_REQUIRED"
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Sign in to use the AI Music Generator.",
        },
        { status: 401 }
      );
    }

    if (
      message ===
      "AUTH_INVALID"
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Your sign-in session is invalid or expired.",
        },
        { status: 401 }
      );
    }

    console.error(
      "AI MUSIC ACCESS ERROR",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          "AI Music access could not be checked.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request
) {
  let reservedTrial =
    false;

  let reservedPremium =
    false;

  let reservedUid =
    "";

  try {
    const user =
      await authenticatedUser(
        request
      );

    const access =
      await getAccess(
        user.uid,
        user.email
      );

    if (
      !access.isOwner &&
      access.premiumActive &&
      !access.canGenerate
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Your monthly AI Music credits have been used. Your credits will reset automatically at the start of your next AI Music cycle.",

          code:
            "PREMIUM_CREDITS_EXHAUSTED",

          premiumCreditsRemaining:
            0,

          premiumCreditsLimit:
            PREMIUM_MONTHLY_CREDITS,
        },
        { status: 403 }
      );
    }

    if (
      !access.canGenerate
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Your 2 free AI song generations have been used. An active SOLO BEATS PREMIUM subscription is now required.",

          code:
            "SUBSCRIPTION_REQUIRED",

          freeRemaining: 0,
        },
        { status: 403 }
      );
    }

    let freeRemaining =
      access.freeRemaining;

    let premiumCreditsRemaining =
      access
        .premiumCreditsRemaining;

    let premiumCreditPeriodEnd =
      access
        .premiumCreditPeriodEnd;

    if (
      !access.isOwner &&
      access.premiumActive
    ) {
      const reservation =
        await reservePremiumGeneration(
          user.uid
        );

      reservedPremium =
        true;

      reservedUid =
        user.uid;

      premiumCreditsRemaining =
        reservation
          .premiumCreditsRemaining;

      premiumCreditPeriodEnd =
        reservation
          .premiumCreditPeriodEnd;
    } else if (
      !access.isOwner
    ) {
      const reservation =
        await reserveFreeGeneration(
          user.uid
        );

      reservedTrial =
        true;

      reservedUid =
        user.uid;

      freeRemaining =
        reservation
          .freeRemaining;
    }

    const body =
      (await request.json()) as GenerateRequest;

    const prompt =
      body.prompt?.trim();

    if (!prompt) {
      if (
        reservedPremium &&
        reservedUid
      ) {
        await refundPremiumGeneration(
          reservedUid
        );

        reservedPremium =
          false;
      }

      if (
        reservedTrial &&
        reservedUid
      ) {
        await refundFreeGeneration(
          reservedUid
        );

        reservedTrial =
          false;
      }

      return NextResponse.json(
        {
          error:
            "A music prompt is required.",
        },
        { status: 400 }
      );
    }

    const apiKey =
      process.env
        .ELEVENLABS_API_KEY;

    if (!apiKey) {
      if (
        reservedPremium &&
        reservedUid
      ) {
        await refundPremiumGeneration(
          reservedUid
        );

        reservedPremium =
          false;
      }

      if (
        reservedTrial &&
        reservedUid
      ) {
        await refundFreeGeneration(
          reservedUid
        );

        reservedTrial =
          false;
      }

      return NextResponse.json(
        {
          error:
            "ELEVENLABS_API_KEY is not configured yet.",
        },
        { status: 503 }
      );
    }

    const duration =
      Math.max(
        3,
        Math.min(
          600,
          Number(
            body.duration
          ) || 30
        )
      );

    const fullPrompt = [
      prompt,

      body.genre
        ? `Genre: ${body.genre}.`
        : "",

      body.mood
        ? `Mood: ${body.mood}.`
        : "",

      body.bpm
        ? `Tempo: ${body.bpm} BPM.`
        : "",

      body.musicKey
        ? `Key: ${body.musicKey}.`
        : "",

      body.vocalMode ===
      "instrumental"
        ? "Instrumental only. No vocals."
        : "Include vocals where musically appropriate.",
    ]
      .filter(Boolean)
      .join(" ");

    const providerResponse =
      await fetch(
        "https://api.elevenlabs.io/v1/music",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "xi-api-key":
              apiKey,
          },

          body:
            JSON.stringify({
              prompt:
                fullPrompt,

              music_length_ms:
                duration *
                1000,
            }),
        }
      );

    if (
      !providerResponse.ok
    ) {
      const providerMessage =
        await providerResponse.text();

      if (
        reservedPremium &&
        reservedUid
      ) {
        await refundPremiumGeneration(
          reservedUid
        );

        reservedPremium =
          false;
      }

      if (
        reservedTrial &&
        reservedUid
      ) {
        await refundFreeGeneration(
          reservedUid
        );

        reservedTrial =
          false;
      }

      return NextResponse.json(
        {
          error:
            `Music provider error: ${providerMessage}`,
        },
        {
          status:
            providerResponse.status,
        }
      );
    }

    const audio =
      await providerResponse
        .arrayBuffer();

    const audioBuffer =
      Buffer.from(audio);

    const generationRef =
      adminDb
        .collection(
          "aiMusicGenerations"
        )
        .doc();

    const generationId =
      generationRef.id;

    const storagePath =
      `ai-music/${user.uid}/${generationId}.mp3`;

    const {
      adminBucket,
    } =
      await import(
        "../../../../lib/firebaseAdmin"
      );

    const storageFile =
      adminBucket.file(
        storagePath
      );

    await storageFile.save(
      audioBuffer,
      {
        resumable:
          false,

        metadata: {
          contentType:
            "audio/mpeg",
        },
      }
    );

    const [
      signedAudioUrl,
    ] =
      await storageFile
        .getSignedUrl({
          action:
            "read",

          expires:
            Date.now() +
            60 * 60 * 1000,
        });

    const generationCreatedAt =
      new Date()
        .toISOString();

    await generationRef.set({
      uid:
        user.uid,

      userEmail:
        user.email || "",

      prompt:
        typeof body.prompt === "string"
          ? body.prompt
          : "",

      genre:
        typeof body.genre === "string"
          ? body.genre
          : "",

      mood:
        typeof body.mood === "string"
          ? body.mood
          : "",

      bpm:
        Number(body.bpm) || 0,

      musicKey:
        typeof body.musicKey === "string"
          ? body.musicKey
          : "",

      duration:
        Number(body.duration) || 0,

      vocalMode:
        body.vocalMode === "vocals"
          ? "vocals"
          : "instrumental",

      accessMode:
        access.isOwner
          ? "owner"
          : access.premiumActive
            ? "premium"
            : "trial",

      mimeType:
        "audio/mpeg",

      sizeBytes:
        audioBuffer.length,

      storagePath,

      private:
        true,

      published:
        false,

      savedToMediaLibrary:
        false,

      mediaLibraryId:
        null,

      createdAt:
        generationCreatedAt,

      updatedAt:
        generationCreatedAt,
    });

    await adminDb
      .collection(
        "aiMusicUsage"
      )
      .doc(user.uid)
      .set(
        {
          uid:
            user.uid,

          totalSuccessfulGenerations:
            FieldValue.increment(
              1
            ),

          lastGeneratedAt:
            new Date()
              .toISOString(),

          updatedAt:
            new Date()
              .toISOString(),
        },
        { merge: true }
      );

    reservedPremium =
      false;

    reservedTrial =
      false;

    return NextResponse.json({
      success: true,

      audioUrl:
        signedAudioUrl,

      generationId,

      storagePath,

      isOwner:
        access.isOwner,

      premiumActive:
        access.premiumActive,

      accessMode:
        access.isOwner
          ? "owner"
          : access.premiumActive
            ? "premium"
            : "trial",

      freeRemaining:
        access.isOwner ||
        access.premiumActive
          ? access.freeRemaining
          : freeRemaining,

      freeTrialLimit:
        FREE_TRIAL_LIMIT,

      premiumCreditsRemaining,

      premiumCreditsLimit:
        PREMIUM_MONTHLY_CREDITS,

      premiumCreditPeriodEnd,

      premiumGenerationCost:
        access.isOwner
          ? 0
          : PREMIUM_GENERATION_COST,
    });
  } catch (error) {
    if (
      reservedPremium &&
      reservedUid
    ) {
      try {
        await refundPremiumGeneration(
          reservedUid
        );
      } catch (
        refundError
      ) {
        console.error(
          "AI MUSIC PREMIUM CREDIT REFUND ERROR",
          refundError
        );
      }
    }

    if (
      reservedTrial &&
      reservedUid
    ) {
      try {
        await refundFreeGeneration(
          reservedUid
        );
      } catch (
        refundError
      ) {
        console.error(
          "AI MUSIC TRIAL REFUND ERROR",
          refundError
        );
      }
    }

    const message =
      error instanceof Error
        ? error.message
        : "";

    if (
      message ===
      "AUTH_REQUIRED"
    ) {
      return NextResponse.json(
        {
          error:
            "Sign in to use the AI Music Generator.",
        },
        { status: 401 }
      );
    }

    if (
      message ===
      "AUTH_INVALID"
    ) {
      return NextResponse.json(
        {
          error:
            "Your sign-in session is invalid or expired.",
        },
        { status: 401 }
      );
    }

    if (
      message ===
      "FREE_TRIAL_EXHAUSTED"
    ) {
      return NextResponse.json(
        {
          error:
            "Your 2 free AI song generations have been used. An active SOLO BEATS PREMIUM subscription is required.",

          code:
            "SUBSCRIPTION_REQUIRED",
        },
        { status: 403 }
      );
    }

    if (
      message ===
      "PREMIUM_CREDITS_EXHAUSTED"
    ) {
      return NextResponse.json(
        {
          error:
            "Your monthly AI Music credits have been used. Please wait for your next monthly credit reset.",

          code:
            "PREMIUM_CREDITS_EXHAUSTED",

          premiumCreditsRemaining:
            0,
        },
        { status: 403 }
      );
    }

    console.error(
      "AI MUSIC GENERATION ERROR",
      error
    );

    return NextResponse.json(
      {
        error:
          message ||
          "AI music generation failed.",
      },
      { status: 500 }
    );
  }
}

