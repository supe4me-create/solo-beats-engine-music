"use client";

import Link from "next/link";
import {
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import { firebaseAuth } from "../../lib/firebaseClient";

type CampaignDuration =
  | "7"
  | "14"
  | "30";

type CampaignGoal =
  | "brand_awareness"
  | "website_traffic"
  | "video_views"
  | "product_promotion"
  | "event_promotion"
  | "app_promotion"
  | "other";

type Placement =
  | "homepage"
  | "store"
  | "radio"
  | "tv";

export default function BusinessAdvertisingPage() {
  const [user, setUser] =
    useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] =
    useState(true);

  const [businessName, setBusinessName] =
    useState("");
  const [contactName, setContactName] =
    useState("");
  const [businessEmail, setBusinessEmail] =
    useState("");
  const [businessWebsite, setBusinessWebsite] =
    useState("");
  const [campaignName, setCampaignName] =
    useState("");
  const [campaignGoal, setCampaignGoal] =
    useState<CampaignGoal>(
      "brand_awareness"
    );
  const [headline, setHeadline] =
    useState("");
  const [description, setDescription] =
    useState("");
  const [callToAction, setCallToAction] =
    useState("Learn More");
  const [targetAudience, setTargetAudience] =
    useState("");
  const [targetGenre, setTargetGenre] =
    useState("");
  const [duration, setDuration] =
    useState<CampaignDuration>("7");
  const [preferredStartDate, setPreferredStartDate] =
    useState("");
  const [youtubeLink, setYoutubeLink] =
    useState("");
  const [imageFile, setImageFile] =
    useState<File | null>(null);
  const [videoFile, setVideoFile] =
    useState<File | null>(null);

  const [videoMediaId, setVideoMediaId] =
    useState("");

  const [placements, setPlacements] =
    useState<Placement[]>([
      "homepage",
    ]);

  const placementPackagePrices: Record<number, number> = {
    1: 25,
    2: 45,
    3: 60,
    4: 75,
  };
  const durationMultipliers: Record<CampaignDuration, number> = {
    "7": 1,
    "14": 2,
    "30": 3.5,
  };
  const placementPackagePrice =
    placementPackagePrices[placements.length] || 0;
  const packagePrice =
    placementPackagePrice * durationMultipliers[duration];

  const [submitting, setSubmitting] =
    useState(false);
  const [successMessage, setSuccessMessage] =
    useState("");
  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const incomingVideoMediaId =
      params.get("videoMediaId");

    if (incomingVideoMediaId) {
      setVideoMediaId(
        incomingVideoMediaId
      );
    }
  }, []);

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        firebaseAuth,
        (currentUser) => {
          setUser(currentUser);
          setBusinessEmail(
            currentUser?.email || ""
          );
          setLoadingAuth(false);
        }
      );

    return unsubscribe;
  }, []);

  function togglePlacement(
    placement: Placement
  ) {
    setPlacements((current) =>
      current.includes(placement)
        ? current.filter(
            (item) =>
              item !== placement
          )
        : [...current, placement]
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const form =
      event.currentTarget;

    if (!user) {
      setErrorMessage(
        "You must sign in before submitting a business advertising campaign."
      );
      return;
    }

    if (
      !imageFile &&
      !videoFile &&
      !youtubeLink.trim() &&
      !videoMediaId.trim()
    ) {
      setErrorMessage(
        "Add an advertising image, a video file, a YouTube video link, or attach a Video Manager creative."
      );
      return;
    }

    if (placements.length === 0) {
      setErrorMessage(
        "Choose at least one advertising placement."
      );
      return;
    }

    if (
      imageFile &&
      imageFile.size >
        10 * 1024 * 1024
    ) {
      setErrorMessage(
        "The advertising image exceeds the 10 MB limit."
      );
      return;
    }

    if (
      videoFile &&
      videoFile.size >
        250 * 1024 * 1024
    ) {
      setErrorMessage(
        "The promotional video exceeds the 250 MB limit."
      );
      return;
    }

    setSubmitting(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const idToken =
        await user.getIdToken();

      const fileInfo = (
        file: File | null
      ) =>
        file
          ? {
              name: file.name,
              type: file.type,
              size: file.size,
            }
          : null;

      const submissionData = {
        businessName,
        contactName,
        businessEmail,
        businessWebsite,
        campaignName,
        campaignGoal,
        headline,
        description,
        callToAction,
        targetAudience,
        targetGenre,
        duration,
        budget: packagePrice.toFixed(2),
        baseBudget: placementPackagePrice.toFixed(2),
        preferredStartDate,
        youtubeLink,
        placements,

        videoMediaId:
          videoMediaId || null,
        imageFile:
          fileInfo(imageFile),
        videoFile:
          fileInfo(videoFile),
      };

      const prepareResponse =
        await fetch(
          "/api/business-advertising/submit",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${idToken}`,
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              action: "prepare",
              ...submissionData,
            }),
          }
        );

      const prepareText =
        await prepareResponse.text();

      let prepared: {
        success?: boolean;
        error?: string;
        submissionId?: string;
        imageStoragePath?:
          string | null;
        videoStoragePath?:
          string | null;
        imageUploadUrl?:
          string | null;
        videoUploadUrl?:
          string | null;
      };

      try {
        prepared =
          JSON.parse(prepareText);
      } catch {
        throw new Error(
          prepareResponse.status ===
            413
            ? "The selected files are too large to submit."
            : "The business advertising service returned an invalid response."
        );
      }

      if (
        !prepareResponse.ok ||
        !prepared.success ||
        !prepared.submissionId
      ) {
        throw new Error(
          prepared.error ||
            "The business advertising submission could not be prepared."
        );
      }

      if (
        imageFile &&
        prepared.imageUploadUrl
      ) {
        const imageUpload =
          await fetch(
            prepared.imageUploadUrl,
            {
              method: "PUT",
              headers: {
                "Content-Type":
                  imageFile.type,
              },
              body: imageFile,
            }
          );

        if (!imageUpload.ok) {
          throw new Error(
            "The advertising image could not be uploaded."
          );
        }
      }

      if (
        videoFile &&
        prepared.videoUploadUrl
      ) {
        const videoUpload =
          await fetch(
            prepared.videoUploadUrl,
            {
              method: "PUT",
              headers: {
                "Content-Type":
                  videoFile.type,
              },
              body: videoFile,
            }
          );

        if (!videoUpload.ok) {
          throw new Error(
            "The promotional video could not be uploaded."
          );
        }
      }

      const response = await fetch(
        "/api/business-advertising/submit",
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${idToken}`,
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            action: "finalize",
            ...submissionData,
            submissionId:
              prepared.submissionId,
            imageStoragePath:
              prepared.imageStoragePath,
            videoStoragePath:
              prepared.videoStoragePath,
          }),
        }
      );

      const responseText =
        await response.text();

      let data: {
        success?: boolean;
        error?: string;
      };

      try {
        data =
          JSON.parse(responseText);
      } catch {
        throw new Error(
          "The business advertising service returned an invalid response."
        );
      }

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "The business advertising submission could not be completed."
        );
      }

      setSuccessMessage(
        "Your business advertising campaign was received and is waiting for owner review."
      );

      setBusinessName("");
      setContactName("");
      setBusinessEmail(
        user.email || ""
      );
      setBusinessWebsite("");
      setCampaignName("");
      setCampaignGoal(
        "brand_awareness"
      );
      setHeadline("");
      setDescription("");
      setCallToAction(
        "Learn More"
      );
      setTargetAudience("");
      setTargetGenre("");
      setDuration("7");
      setPreferredStartDate("");
      setYoutubeLink("");
      setImageFile(null);
      setVideoFile(null);
      setPlacements([
        "homepage",
      ]);

      form.reset();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The business advertising submission could not be completed."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingAuth) {
    return (
      <main className="min-h-screen px-5 pb-32 pt-52 sm:px-8">
        <section className="mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-white/[0.035] p-10 text-center">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">
            Business Advertising
          </p>
          <h1 className="mt-3 text-4xl font-black">
            Loading...
          </h1>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 pb-40 pt-52 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[2.5rem] border border-cyan-300/20 bg-gradient-to-br from-cyan-700/25 via-black/50 to-violet-500/20 p-8 shadow-2xl sm:p-12">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-300">
            Reach Music Fans
          </p>

          <h1 className="mt-4 text-5xl font-black sm:text-7xl">
            Business Advertising
          </h1>

          <p className="mt-5 max-w-4xl text-lg leading-8 text-white/60">
            Submit an image or video advertising campaign for possible sponsored placement across SOLO BEATS ENGINE MUSIC. Every campaign is reviewed before payment and publishing.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            {[
              "Homepage",
              "Store",
              "Premium Radio",
              "Premium TV",
              "YouTube Video Links",
              "Uploaded Video Ads",
            ].map((label) => (
              <span
                key={label}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white/70"
              >
                {label}
              </span>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <form
            onSubmit={handleSubmit}
            className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 sm:p-8"
          >
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-300">
                Campaign Submission
              </p>
              <h2 className="mt-2 text-3xl font-black">
                Submit your advertisement
              </h2>
            </div>

            {!user ? (
              <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-5 text-amber-100">
                <p className="font-black">
                  Sign in required
                </p>
                <p className="mt-2 text-sm">
                  You must sign in before submitting a business advertising campaign.
                </p>
                <Link
                  href="/account"
                  className="mt-4 inline-flex rounded-xl bg-white px-4 py-3 font-black text-black"
                >
                  Open Account
                </Link>
              </div>
            ) : null}

            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <Field
                label="Business name"
                value={businessName}
                onChange={
                  setBusinessName
                }
                required
              />
              <Field
                label="Contact name"
                value={contactName}
                onChange={
                  setContactName
                }
                required
              />
              <Field
                label="Business email"
                type="email"
                value={businessEmail}
                onChange={
                  setBusinessEmail
                }
                required
              />
              <Field
                label="Business website"
                type="url"
                value={businessWebsite}
                onChange={
                  setBusinessWebsite
                }
                placeholder="https://"
                required
              />
              {videoMediaId ? (
                <div className="sm:col-span-2 rounded-2xl border border-violet-300/20 bg-violet-300/10 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-200">
                    AI Video Attached
                  </p>

                  <p className="mt-2 text-sm text-white/60">
                    This campaign will use the AI-generated video selected from Video Manager.
                  </p>

                  <p className="mt-3 break-all rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold text-white/75">
                    {videoMediaId}
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      setVideoMediaId("")
                    }
                    className="mt-3 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-black text-white hover:bg-white/10"
                  >
                    Remove Selected Video
                  </button>
                </div>
              ) : null}

              <Field
                label="Campaign name"
                value={campaignName}
                onChange={
                  setCampaignName
                }
                required
              />

              <label className="grid gap-2">
                <span className="text-sm font-black text-white/70">
                  Campaign goal
                </span>
                <select
                  value={campaignGoal}
                  onChange={(event) =>
                    setCampaignGoal(
                      event.target
                        .value as CampaignGoal
                    )
                  }
                  className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 outline-none focus:border-cyan-400"
                >
                  <option value="brand_awareness">
                    Brand awareness
                  </option>
                  <option value="website_traffic">
                    Website traffic
                  </option>
                  <option value="video_views">
                    Video views
                  </option>
                  <option value="product_promotion">
                    Product promotion
                  </option>
                  <option value="event_promotion">
                    Event promotion
                  </option>
                  <option value="app_promotion">
                    App promotion
                  </option>
                  <option value="other">
                    Other
                  </option>
                </select>
              </label>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Field
                label="Ad headline"
                value={headline}
                onChange={setHeadline}
                maxLength={90}
                required
              />
              <Field
                label="Call-to-action text"
                value={callToAction}
                onChange={
                  setCallToAction
                }
                maxLength={30}
                required
              />
            </div>

            <label className="mt-5 grid gap-2">
              <span className="text-sm font-black text-white/70">
                Campaign description
              </span>
              <textarea
                required
                maxLength={800}
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value
                  )
                }
                rows={5}
                className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 outline-none focus:border-cyan-400"
              />
            </label>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Field
                label="Target audience"
                value={targetAudience}
                onChange={
                  setTargetAudience
                }
                placeholder="Example: electronic music fans, creators, local businesses"
              />
              <Field
                label="Preferred music genre"
                value={targetGenre}
                onChange={
                  setTargetGenre
                }
                placeholder="Example: Electronic, Hip-Hop, All Genres"
              />
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-3">
              <label className="grid gap-2">
                <span className="text-sm font-black text-white/70">
                  Campaign duration
                </span>
                <select
                  value={duration}
                  onChange={(event) =>
                    setDuration(
                      event.target
                        .value as CampaignDuration
                    )
                  }
                  className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 outline-none focus:border-cyan-400"
                >
                  <option value="7">
                    7 days
                  </option>
                  <option value="14">
                    14 days
                  </option>
                  <option value="30">
                    30 days
                  </option>
                </select>
              </label>

              <Field
                label="Preferred start date"
                type="date"
                value={
                  preferredStartDate
                }
                onChange={
                  setPreferredStartDate
                }
              />
            </div>

            <fieldset className="mt-6">
              <legend className="text-sm font-black text-white/70">
                Requested placements
              </legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {[
                  [
                    "homepage",
                    "Homepage",
                  ],
                  [
                    "store",
                    "Store",
                  ],
                  [
                    "radio",
                    "Premium Radio",
                  ],
                  [
                    "tv",
                    "Premium TV",
                  ],
                ].map(
                  ([value, label]) => {
                    const placement =
                      value as Placement;
                    const selected =
                      placements.includes(
                        placement
                      );

                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          togglePlacement(
                            placement
                          )
                        }
                        className={`rounded-2xl border px-4 py-4 text-left font-black transition ${
                          selected
                            ? "border-cyan-300 bg-cyan-300/15 text-cyan-100"
                            : "border-white/10 bg-black/25 text-white/55"
                        }`}
                      >
                        {selected
                          ? "✓ "
                          : ""}
                        {label}
                      </button>
                    );
                  }
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-fuchsia-300/20 bg-fuchsia-300/10 p-4">
                <div>
                  <p className="font-black text-fuchsia-100">
                    {placements.length} of 4 placements selected
                  </p>
                  <p className="mt-1 text-sm text-white/65">
                    One approved ad will run across every selected placement.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setPlacements([
                      "homepage",
                      "store",
                      "radio",
                      "tv",
                    ])
                  }
                  className="rounded-xl border border-fuchsia-200/30 bg-fuchsia-300/15 px-4 py-3 font-black text-fuchsia-100"
                >
                  Select All 4
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                  Estimated campaign package
                </p>
                <p className="mt-2 text-3xl font-black text-white">
                  ${packagePrice.toFixed(2)}
                </p>
                <p className="mt-2 text-sm text-white/65">
                  {placements.length === 1
                    ? "$25 for one placement"
                    : placements.length === 2
                      ? "$45 for two placements"
                      : placements.length === 3
                        ? "$60 for three placements"
                        : "$75 for all four placements"} for 7 days. Duration multiplier: {duration === "7" ? "1×" : duration === "14" ? "2×" : "3.5×"}. This locked platform price is charged at checkout.
                </p>
              </div>
            </fieldset>

            <label className="mt-5 grid gap-2">
              <span className="text-sm font-black text-white/70">
                YouTube promotional video link
              </span>
              <input
                type="url"
                value={youtubeLink}
                onChange={(event) =>
                  setYoutubeLink(
                    event.target.value
                  )
                }
                placeholder="https://www.youtube.com/watch?v=..."
                className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 outline-none focus:border-cyan-400"
              />
              <span className="text-xs text-white/35">
                Optional. Add an approved YouTube commercial, product video, or campaign video.
              </span>
            </label>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-black text-white/70">
                  Advertising image
                </span>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/*"
                  onChange={(event) =>
                    setImageFile(
                      event.target
                        .files?.[0] ||
                        null
                    )
                  }
                  className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-sm"
                />
                <span className="text-xs text-white/35">
                  JPG, PNG, or WEBP. Maximum 10 MB.
                </span>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black text-white/70">
                  Promotional video
                </span>
                <input
                  type="file"
                  accept=".mp4,.webm,.mov,video/*"
                  onChange={(event) =>
                    setVideoFile(
                      event.target
                        .files?.[0] ||
                        null
                    )
                  }
                  className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-sm"
                />
                <span className="text-xs text-white/35">
                  MP4, WEBM, or MOV. Maximum 250 MB.
                </span>
              </label>
            </div>

            <p className="mt-4 text-sm text-white/40">
              At least one creative is required: an image, uploaded video, or YouTube video link.
            </p>

            {successMessage ? (
              <p className="mt-6 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-emerald-200">
                {successMessage}
              </p>
            ) : null}

            {errorMessage ? (
              <p className="mt-6 rounded-2xl border border-red-300/20 bg-red-300/10 p-4 text-red-200">
                {errorMessage}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={
                submitting ||
                !user
              }
              className="mt-7 rounded-2xl bg-white px-6 py-4 font-black text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? "Submitting..."
                : "Submit Campaign for Review"}
            </button>
          </form>

          <aside className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-300">
              How It Works
            </p>

            <div className="mt-6 grid gap-4">
              <InfoCard
                number="1"
                title="Submit"
                text="Provide your business, campaign, audience, placement, duration, and creative details."
              />
              <InfoCard
                number="2"
                title="Owner Review"
                text="The campaign is reviewed for quality, suitability, safety, and placement availability."
              />
              <InfoCard
                number="3"
                title="Pricing & Payment"
                text="Approved campaigns receive final pricing before payment."
              />
              <InfoCard
                number="4"
                title="Sponsored Placement"
                text="Paid campaigns are scheduled and clearly labeled Sponsored."
              />
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  maxLength,
  min,
  step,
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  min?: string;
  step?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-black text-white/70">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        min={min}
        step={step}
        className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 outline-none focus:border-cyan-400"
      />
    </label>
  );
}

function InfoCard({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-white text-sm font-black text-black">
        {number}
      </div>
      <h3 className="mt-4 text-xl font-black">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-white/50">
        {text}
      </p>
    </article>
  );
}



