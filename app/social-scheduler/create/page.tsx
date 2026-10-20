"use client";

import Link from "next/link";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  useAuth,
} from "../../auth/AuthContext";

type PlatformKey =
  | "facebook"
  | "instagram"
  | "youtube"
  | "tiktok";

type PlatformStatus = {
  configured: boolean;
  connected: boolean;
};

type ConnectionsResponse = {
  success: boolean;
  accessActive?: boolean;
  planName?: string | null;
  allowedPlatforms?: string[];
  facebook?: PlatformStatus;
  instagram?: PlatformStatus;
  youtube?: PlatformStatus;
  tiktok?: PlatformStatus;
  error?: string;
};

type ScheduledPost = {
  id: string;
  postType: string;
  title: string;
  caption: string;
  mediaUrl: string;
  platforms: string[];
  scheduledFor: string | null;
  timezone: string;
  recurrence: string;
  status: string;
  lastError: string;
  platformStatus: Record<string, string>;
  publishedUrls: Record<string, string>;
};

const platformNames:
  Record<
    PlatformKey,
    string
  > = {
    facebook:
      "Facebook",
    instagram:
      "Instagram",
    youtube:
      "YouTube",
    tiktok:
      "TikTok",
  };

export default function CustomerCreatePostPage() {
  const {
    user,
    loading,
  } = useAuth();

  const [
    connections,
    setConnections,
  ] =
    useState<ConnectionsResponse | null>(
      null
    );

  const [
    posts,
    setPosts,
  ] =
    useState<ScheduledPost[]>([]);

  const [
    postType,
    setPostType,
  ] =
    useState<
      "text" |
      "image" |
      "video"
    >("text");

  // SOLO_CUSTOMER_POST_TITLE_V1
  const [
    title,
    setTitle,
  ] =
    useState("");

  const [
    caption,
    setCaption,
  ] =
    useState("");

  const [
    mediaUrl,
    setMediaUrl,
  ] =
    useState("");

  // SOLO_CUSTOMER_MEDIA_UPLOAD_V1
  const [
    mediaStoragePath,
    setMediaStoragePath,
  ] =
    useState("");

  const [
    mediaFileName,
    setMediaFileName,
  ] =
    useState("");

  const [
    mediaUploading,
    setMediaUploading,
  ] =
    useState(false);

  const [
    mediaUploadProgress,
    setMediaUploadProgress,
  ] =
    useState(0);

  // SOLO_CUSTOMER_VIDEO_MODE_V1
  const [
    videoMode,
    setVideoMode,
  ] =
    useState<
      "long" |
      "short"
    >("long");

  const [
    originalVideoUrl,
    setOriginalVideoUrl,
  ] =
    useState("");

  const [
    originalVideoStoragePath,
    setOriginalVideoStoragePath,
  ] =
    useState("");

  const [
    originalVideoFileName,
    setOriginalVideoFileName,
  ] =
    useState("");

    // SOLO_AUTO_BEST_PART_V1
  const [bestPartBusy, setBestPartBusy] = useState(false);
  const [bestPartMode, setBestPartMode] = useState<"auto" | "manual">("manual");
  const [bestPartReady, setBestPartReady] = useState(false);
  // SOLO_CUSTOMER_SHORT_MAKER_V1
  const [
    shortDuration,
    setShortDuration,
  ] =
    useState<
      15 |
      30 |
      60
    >(30);

  const [
    shortStartSeconds,
    setShortStartSeconds,
  ] =
    useState(0);

  const [
    shortBuilding,
    setShortBuilding,
  ] =
    useState(false);

  const [
    shortBuilt,
    setShortBuilt,
  ] =
    useState(false);

  const [
    selected,
    setSelected,
  ] =
    useState<PlatformKey[]>([]);

  const [
    scheduledFor,
    setScheduledFor,
  ] =
    useState("");

  const [
    recurrence,
    setRecurrence,
  ] =
    useState<
      "none" |
      "daily" |
      "weekly"
    >("none");

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    success,
    setSuccess,
  ] =
    useState("");

  const refresh =
    useCallback(
      async () => {
        if (!user) {
          return;
        }

        setRefreshing(true);
        setError("");

        try {
          const token =
            await user.getIdToken();

          const [
            connectionsResponse,
            postsResponse,
          ] =
            await Promise.all([
              fetch(
                "/api/social-scheduler/connections?ts=" +
                  Date.now(),
                {
                  headers: {
                    Authorization:
                      `Bearer ${token}`,
                  },
                  cache:
                    "no-store",
                }
              ),

              fetch(
                "/api/social-scheduler/posts?ts=" +
                  Date.now(),
                {
                  headers: {
                    Authorization:
                      `Bearer ${token}`,
                  },
                  cache:
                    "no-store",
                }
              ),
            ]);

          const connectionsData =
            await connectionsResponse.json();

          const postsData =
            await postsResponse.json();

          if (
            !connectionsResponse.ok ||
            !connectionsData.success
          ) {
            throw new Error(
              connectionsData.error ||
              "Social connections could not be loaded."
            );
          }

          if (
            !postsResponse.ok ||
            !postsData.success
          ) {
            throw new Error(
              postsData.error ||
              "Scheduled posts could not be loaded."
            );
          }

          setConnections(
            connectionsData
          );

          setPosts(
            Array.isArray(
              postsData.posts
            )
              ? postsData.posts
              : []
          );
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Scheduler data could not be loaded."
          );
        } finally {
          setRefreshing(false);
        }
      },
      [
        user,
      ]
    );

  useEffect(() => {
    if (
      loading ||
      !user
    ) {
      return;
    }

    void refresh();
  }, [
    loading,
    user,
    refresh,
  ]);

  async function uploadMedia(
    file: File
  ) {
    if (!user) {
      return;
    }

    if (
      postType !== "image" &&
      postType !== "video"
    ) {
      setError(
        "Choose IMAGE POST or VIDEO POST first."
      );
      return;
    }

    const isImage =
      file.type.startsWith(
        "image/"
      );

    const isVideo =
      file.type.startsWith(
        "video/"
      );

    if (
      postType === "image" &&
      !isImage
    ) {
      setError(
        "Choose an image file."
      );
      return;
    }

    if (
      postType === "video" &&
      !isVideo
    ) {
      setError(
        "Choose a video file."
      );
      return;
    }

    const maxBytes =
      postType === "image"
        ? 20 * 1024 * 1024
        : 250 * 1024 * 1024;

    if (
      file.size >
      maxBytes
    ) {
      setError(
        postType === "image"
          ? "Image must be 20 MB or smaller."
          : "Video must be 250 MB or smaller."
      );
      return;
    }

    setError("");
    setSuccess("");
    setMediaUploading(true);
    setMediaUploadProgress(0);

    const previousPath =
      mediaStoragePath;

    try {
      const {
        ref,
        uploadBytesResumable,
        getDownloadURL,
        deleteObject,
      } =
        await import(
          "firebase/storage"
        );

      const {
        firebaseStorage,
      } =
        await import(
          "../../../lib/firebaseClient"
        );

      const mediaId =
        crypto.randomUUID();

      const originalName =
        file.name ||
        (
          postType === "image"
            ? "image.jpg"
            : "video.mp4"
        );

      const safeName =
        originalName
          .replace(
            /[^a-zA-Z0-9._-]+/g,
            "-"
          )
          .replace(
            /-+/g,
            "-"
          )
          .slice(
            0,
            120
          );

      /*
       * Use the same established Storage area
       * already used successfully by the owner scheduler,
       * but isolate every upload by Firebase UID.
       */
      const storagePath =
        `social-promotions/device/${user.uid}/${mediaId}/customer-${safeName}`;

      const storageRef =
        ref(
          firebaseStorage,
          storagePath
        );

      const task =
        uploadBytesResumable(
          storageRef,
          file,
          {
            contentType:
              file.type,

            customMetadata: {
              source:
                "solo-beats-customer-social-scheduler",

              customerUid:
                user.uid,

              originalFileName:
                originalName,
            },
          }
        );

      await new Promise<void>(
        (
          resolve,
          reject
        ) => {
          task.on(
            "state_changed",

            snapshot => {
              const total =
                snapshot.totalBytes ||
                1;

              const percent =
                Math.round(
                  (
                    snapshot
                      .bytesTransferred /
                    total
                  ) *
                    100
                );

              setMediaUploadProgress(
                percent
              );
            },

            uploadError => {
              reject(
                uploadError
              );
            },

            () => {
              resolve();
            }
          );
        }
      );

      const downloadUrl =
        await getDownloadURL(
          task.snapshot.ref
        );

      setMediaUrl(
        downloadUrl
      );

      setMediaStoragePath(
        storagePath
      );

      setMediaFileName(
        originalName
      );

      if (
        postType === "video"
      ) {
        setOriginalVideoUrl(
          downloadUrl
        );

        setOriginalVideoStoragePath(
          storagePath
        );

        setOriginalVideoFileName(
          originalName
        );

        setVideoMode(
          "long"
        );
      }

      setShortBuilt(
        false
      );

      setShortStartSeconds(
        0
      );

      setMediaUploadProgress(
        100
      );

      setSuccess(
        `${
          postType === "image"
            ? "Image"
            : "Video"
        } uploaded and ready to schedule.`
      );

      if (
        previousPath &&
        previousPath !==
          storagePath
      ) {
        try {
          await deleteObject(
            ref(
              firebaseStorage,
              previousPath
            )
          );
        } catch (
          cleanupError
        ) {
          console.warn(
            "Previous customer media cleanup warning:",
            cleanupError
          );
        }
      }
    } catch (uploadError) {
      console.error(
        "CUSTOMER MEDIA UPLOAD ERROR:",
        uploadError
      );

      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Media could not be uploaded."
      );
    } finally {
      setMediaUploading(false);
    }
  }

  function changeVideoMode(
    mode:
      | "long"
      | "short"
  ) {
    setVideoMode(
      mode
    );

    setError("");
    setSuccess("");

    if (
      mode === "long" &&
      originalVideoUrl &&
      originalVideoStoragePath
    ) {
      setMediaUrl(
        originalVideoUrl
      );

      setMediaStoragePath(
        originalVideoStoragePath
      );

      setMediaFileName(
        originalVideoFileName
      );

      setShortBuilt(
        false
      );

      setSuccess(
        "LONG VIDEO SELECTED — THE FULL ORIGINAL VIDEO WILL BE SCHEDULED."
      );

      return;
    }

    if (
      mode === "short"
    ) {
      if (
        originalVideoUrl &&
        originalVideoStoragePath
      ) {
        setMediaUrl(
          originalVideoUrl
        );

        setMediaStoragePath(
          originalVideoStoragePath
        );

        setMediaFileName(
          originalVideoFileName
        );
      }

      setShortBuilt(
        false
      );

      setSuccess(
        "SHORT VIDEO SELECTED — CREATE THE SHORT BEFORE SCHEDULING."
      );
    }
  }

  async function autoPickBestPart() {
    if (!user || !originalVideoStoragePath) {
      setError("Upload your original long video first.");
      return;
    }

    setBestPartBusy(true);
    setBestPartReady(false);
    setError("");
    setSuccess("");

    try {
      const token = await user.getIdToken();

      const response = await fetch(
        "/api/social-scheduler/best-part",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            sourceStoragePath: originalVideoStoragePath,
            duration: shortDuration
          })
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Automatic analysis failed."
        );
      }

      setShortStartSeconds(result.startSeconds);
      setBestPartMode("auto");
      setBestPartReady(true);

      setSuccess(
        `BEST PART FOUND AT ${result.startSeconds} SECONDS. REVIEW THE START TIME, THEN CREATE SHORT.`
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to analyze this video."
      );
    } finally {
      setBestPartBusy(false);
    }
  }
  async function createShortFromVideo() {
    if (
      !user ||
      postType !== "video"
    ) {
      return;
    }

    if (
      !originalVideoStoragePath ||
      !originalVideoUrl
    ) {
      setError(
        "Upload a long video first."
      );

      return;
    }

    setShortBuilding(
      true
    );

    setError("");
    setSuccess("");

    try {
      const token =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/social-scheduler/create-short",
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Bearer ${token}`,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                sourceStoragePath:
                  originalVideoStoragePath,

                duration:
                  shortDuration,

                startSeconds:
                  shortStartSeconds,
              }),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ||
            "Short video could not be created."
        );
      }

      const short =
        result.short;

      if (
        !short?.videoUrl ||
        !short?.storagePath
      ) {
        throw new Error(
          "Short video output was incomplete."
        );
      }

      setMediaUrl(
        short.videoUrl
      );

      setMediaStoragePath(
        short.storagePath
      );

      setMediaFileName(
        short.fileName ||
          `customer-short-${shortDuration}s.mp4`
      );

      setShortBuilt(
        true
      );

      setMediaUploadProgress(
        100
      );

      setSuccess(
        `${shortDuration}-SECOND VERTICAL SHORT CREATED AND READY TO SCHEDULE.`
      );
    } catch (shortError) {
      console.error(
        "CUSTOMER SHORT ERROR:",
        shortError
      );

      setError(
        shortError instanceof Error
          ? shortError.message
          : "Short video could not be created."
      );
    } finally {
      setShortBuilding(
        false
      );
    }
  }

  async function removeMedia() {
    if (
      !mediaStoragePath
    ) {
      setMediaUrl("");
      setMediaFileName("");
      setMediaUploadProgress(0);
      return;
    }

    setError("");
    setSuccess("");
    setMediaUploading(true);

    try {
      const {
        ref,
        deleteObject,
      } =
        await import(
          "firebase/storage"
        );

      const {
        firebaseStorage,
      } =
        await import(
          "../../../lib/firebaseClient"
        );

      try {
        await deleteObject(
          ref(
            firebaseStorage,
            mediaStoragePath
          )
        );
      } catch (
        deleteError: any
      ) {
        if (
          deleteError?.code !==
          "storage/object-not-found"
        ) {
          throw deleteError;
        }
      }

      setMediaUrl("");
      setMediaStoragePath("");
      setMediaFileName("");
      setMediaUploadProgress(0);
      setShortBuilt(false);
      setShortStartSeconds(0);
      setVideoMode("long");
      setOriginalVideoUrl("");
      setOriginalVideoStoragePath("");
      setOriginalVideoFileName("");

      setSuccess(
        "Uploaded media removed."
      );
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Uploaded media could not be removed."
      );
    } finally {
      setMediaUploading(false);
    }
  }

  function togglePlatform(
    platform: PlatformKey
  ) {
    setSelected(
      current =>
        current.includes(
          platform
        )
          ? current.filter(
              item =>
                item !==
                platform
            )
          : [
              ...current,
              platform,
            ]
    );
  }

  async function submit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!user) {
      return;
    }

    if (
      postType === "video" &&
      videoMode === "short" &&
      !shortBuilt
    ) {
      setError(
        "Create the short video before scheduling."
      );

      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const token =
        await user.getIdToken();

      const schedule =
        new Date(
          scheduledFor
        );

      if (
        Number.isNaN(
          schedule.getTime()
        )
      ) {
        throw new Error(
          "Choose a valid schedule date and time."
        );
      }

      const response =
        await fetch(
          "/api/social-scheduler/posts",
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Bearer ${token}`,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                postType,
                title,
                caption,
                mediaUrl,
                mediaStoragePath,
                platforms:
                  selected,
                scheduledFor:
                  schedule.toISOString(),
                timezone:
                  Intl.DateTimeFormat()
                    .resolvedOptions()
                    .timeZone ||
                  "UTC",
                recurrence,
              }),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ||
          "Post could not be scheduled."
        );
      }

      setSuccess(
        "POST SCHEDULED SUCCESSFULLY."
      );

      setTitle("");
      setCaption("");
      setMediaUrl("");
      setMediaStoragePath("");
      setMediaFileName("");
      setMediaUploadProgress(0);
      setShortBuilt(false);
      setShortStartSeconds(0);
      setVideoMode("long");
      setOriginalVideoUrl("");
      setOriginalVideoStoragePath("");
      setOriginalVideoFileName("");
      setSelected([]);
      setScheduledFor("");
      setRecurrence("none");

      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Post could not be scheduled."
      );
    } finally {
      setBusy(false);
    }
  }

  async function cancelPost(
    postId: string
  ) {
    if (!user) {
      return;
    }

    const confirmed =
      window.confirm(
        "Cancel this scheduled post?"
      );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      const token =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/social-scheduler/posts",
          {
            method:
              "DELETE",

            headers: {
              Authorization:
                `Bearer ${token}`,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                postId,
              }),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ||
          "Post could not be cancelled."
        );
      }

      setSuccess(
        "SCHEDULED POST CANCELLED."
      );

      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Post could not be cancelled."
      );
    }
  }

  // ============================================================
  // SOLO_CUSTOMER_DELETE_OLD_POSTS_V1
  // Removes old scheduler history owned by this customer.
  // Does not delete already-published posts from social platforms.
  // ============================================================
  async function deletePost(
    postId: string
  ) {
    if (!user) {
      return;
    }

    const confirmed =
      window.confirm(
        "Delete this old post from your scheduler history?"
      );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      const token =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/social-scheduler/posts",
          {
            method:
              "DELETE",

            headers: {
              Authorization:
                `Bearer ${token}`,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                postId,
                action:
                  "delete",
              }),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ||
          "Post could not be deleted."
        );
      }

      setSuccess(
        "OLD POST DELETED."
      );

      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Post could not be deleted."
      );
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black p-8 text-white">
        Loading...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-black p-8 text-white">
        <h1 className="text-4xl font-black">
          Social Scheduler
        </h1>

        <Link
          href="/account?mode=signin"
          className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 font-black text-black"
        >
          SIGN IN
        </Link>
      </main>
    );
  }

  const allowed =
    connections
      ?.allowedPlatforms ||
    [];

  return (
    <main className="min-h-screen bg-black px-5 py-10 text-white">
      <div className="mx-auto max-w-6xl">

        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
              SOLO BEATS ENGINE MUSIC
            </div>

            <h1 className="mt-3 text-4xl font-black md:text-6xl">
              Create Post
            </h1>

            <p className="mt-4 max-w-3xl text-white/60">
              Create and schedule promotions using your connected social accounts.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/social-scheduler/connections"
              className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-5 py-3 text-sm font-black text-cyan-200"
            >
              SOCIAL CONNECTIONS
            </Link>

            <Link
              href="/social-scheduler"
              className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-black"
            >
              BACK TO SCHEDULER
            </Link>
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-500/10 p-5 text-red-200">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mt-6 rounded-2xl border border-green-400/30 bg-green-500/10 p-5 text-green-200">
            {success}
          </div>
        ) : null}

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">

          <form
            onSubmit={submit}
            className="rounded-3xl border border-white/10 bg-white/5 p-6"
          >
            <h2 className="text-2xl font-black">
              NEW SCHEDULED POST
            </h2>

            <div className="mt-6">
              <label className="text-sm font-black text-white/60">
                POST TYPE
              </label>

              <select
                value={postType}
                onChange={event =>
                  setPostType(
                    event.target
                      .value as
                      | "text"
                      | "image"
                      | "video"
                  )
                }
                className="mt-2 w-full rounded-xl border border-white/15 bg-black px-4 py-3 text-white"
              >
                <option value="text">
                  TEXT POST
                </option>

                <option value="image">
                  IMAGE POST
                </option>

                <option value="video">
                  VIDEO POST
                </option>
              </select>
            </div>

            <div className="mt-5">
              <label className="text-sm font-black text-white/60">
                TITLE
              </label>

              <input
                type="text"
                value={title}
                onChange={event =>
                  setTitle(
                    event.target.value
                  )
                }
                maxLength={200}
                placeholder="Enter post title..."
                className="mt-2 w-full rounded-xl border border-white/15 bg-black px-4 py-3 text-white"
              />
            </div>

            <div className="mt-5">
              <label className="text-sm font-black text-white/60">
                DESCRIPTION / CAPTION
              </label>

              <textarea
                value={caption}
                onChange={event =>
                  setCaption(
                    event.target.value
                  )
                }
                rows={7}
                placeholder="Write your promotion..."
                className="mt-2 w-full rounded-xl border border-white/15 bg-black px-4 py-3 text-white"
              />
            </div>

            {postType ===
            "video" ? (
              <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-5">

                <div className="text-sm font-black text-white/60">
                  VIDEO TYPE
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">

                  <button
                    type="button"
                    onClick={() =>
                      changeVideoMode(
                        "long"
                      )
                    }
                    className={
                      videoMode ===
                      "long"
                        ? "rounded-xl border border-cyan-300 bg-cyan-500/20 px-5 py-4 text-left text-sm font-black text-cyan-100"
                        : "rounded-xl border border-white/10 bg-black/30 px-5 py-4 text-left text-sm font-black text-white"
                    }
                  >
                    LONG VIDEO

                    <div className="mt-1 text-xs font-normal text-white/50">
                      Post the complete uploaded video
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      changeVideoMode(
                        "short"
                      )
                    }
                    className={
                      videoMode ===
                      "short"
                        ? "rounded-xl border border-fuchsia-300 bg-fuchsia-500/20 px-5 py-4 text-left text-sm font-black text-fuchsia-100"
                        : "rounded-xl border border-white/10 bg-black/30 px-5 py-4 text-left text-sm font-black text-white"
                    }
                  >
                    SHORT VIDEO

                    <div className="mt-1 text-xs font-normal text-white/50">
                      Create a 15, 30, or 60 second vertical short
                    </div>
                  </button>

                </div>

                <div className="mt-3 text-xs text-white/50">
                  {videoMode === "long"
                    ? "LONG VIDEO MODE — the entire uploaded video will be posted."
                    : shortBuilt
                      ? "SHORT VIDEO MODE — generated short is ready."
                      : "SHORT VIDEO MODE — generate a short before scheduling."}
                </div>

              </div>
            ) : null}

            {postType !==
            "text" ? (
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-5">

                <label className="text-sm font-black text-white/60">
                  {postType ===
                  "image"
                    ? "UPLOAD IMAGE"
                    : "UPLOAD VIDEO"}
                </label>

                <input
                  type="file"
                  accept={
                    postType ===
                    "image"
                      ? "image/*"
                      : "video/*"
                  }
                  disabled={
                    mediaUploading
                  }
                  onChange={event => {
                    const file =
                      event.target
                        .files?.[0];

                    if (file) {
                      void uploadMedia(
                        file
                      );
                    }

                    event.currentTarget.value =
                      "";
                  }}
                  className="mt-3 block w-full rounded-xl border border-white/15 bg-black px-4 py-3 text-sm text-white file:mr-4 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2 file:font-black file:text-black"
                />

                {mediaUploading ? (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs font-black text-cyan-200">
                      <span>
                        UPLOADING
                      </span>

                      <span>
                        {mediaUploadProgress}%
                      </span>
                    </div>

                    <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-cyan-300 transition-all"
                        style={{
                          width:
                            `${mediaUploadProgress}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                {mediaUrl ? (
                  <div className="mt-5 rounded-xl border border-green-400/20 bg-green-500/5 p-4">

                    <div className="text-xs font-black text-green-300">
                      READY TO SCHEDULE
                    </div>

                    {mediaFileName ? (
                      <div className="mt-2 break-all text-xs text-white/55">
                        {mediaFileName}
                      </div>
                    ) : null}

                    {postType ===
                    "image" ? (
                      <img
                        src={mediaUrl}
                        alt="Customer upload preview"
                        className="mt-4 max-h-96 w-full rounded-xl object-contain"
                      />
                    ) : (
                      <video
                        src={mediaUrl}
                        controls
                        preload="metadata"
                        className="mt-4 max-h-96 w-full rounded-xl bg-black"
                      />
                    )}

                    {postType ===
                    "video" &&
                    videoMode ===
                    "short" ? (
                      <div className="mt-5 rounded-2xl border border-fuchsia-400/25 bg-fuchsia-500/10 p-5">

                        <div className="text-xs font-black uppercase tracking-widest text-fuchsia-200">
                          CREATE SHORT FROM THIS VIDEO
                        </div>

                        <p className="mt-2 text-xs text-white/55">
                          Turn the uploaded long video into a vertical 1080×1920 social short.
                        </p>

                        <div className="mt-4 grid gap-4 sm:grid-cols-2">

                          <label>
                         <div className="mb-5 rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-4">
                           <div className="text-xs font-black text-cyan-200">
                             AUTO BEST PART PICK
                           </div>

                           <p className="mt-2 text-xs text-white/60">
                             Find a promising high-energy moment automatically.
                             You can still change START AT manually.
                           </p>

                           <div className="mt-3 grid grid-cols-2 gap-2">
                             <button
                               type="button"
                               disabled={bestPartBusy || shortBuilding}
                               onClick={() => {
                                 setBestPartMode("auto");
                                 setBestPartReady(false);
                                 void autoPickBestPart();
                               }}
                               className="rounded-xl border border-cyan-400/40 bg-cyan-500/20 px-3 py-3 text-xs font-black text-cyan-100 disabled:opacity-40"
                             >
                               {bestPartBusy ? "ANALYZING..." : "AUTO BEST PART PICK"}
                             </button>

                             <button
                               type="button"
                               disabled={bestPartBusy || shortBuilding}
                               onClick={() => {
                                 setBestPartMode("manual");
                                 setBestPartReady(false);
                               }}
                               className="rounded-xl border border-white/20 bg-black/40 px-3 py-3 text-xs font-black text-white disabled:opacity-40"
                             >
                               MANUAL PICK
                             </button>
                           </div>

                           <p className="mt-2 text-xs text-white/50">
                             MODE: {bestPartMode === "auto" ? "AUTO" : "MANUAL"}
                             {bestPartReady ? " — RECOMMENDATION READY" : ""}
                           </p>
                         </div>
                            <span className="text-xs font-black text-white/60">
                              SHORT LENGTH
                            </span>

                            <select
                              value={
                                shortDuration
                              }
                              onChange={event =>
                                setShortDuration(
                                  Number(
                                    event.target.value
                                  ) as
                                    | 15
                                    | 30
                                    | 60
                                )
                              }
                              disabled={
                                shortBuilding
                              }
                              className="mt-2 w-full rounded-xl border border-white/15 bg-black px-4 py-3 text-white"
                            >
                              <option value={15}>
                                15 SECONDS
                              </option>

                              <option value={30}>
                                30 SECONDS
                              </option>

                              <option value={60}>
                                60 SECONDS
                              </option>
                            </select>
                          </label>

                          <label>
                            <span className="text-xs font-black text-white/60">
                              START AT
                            </span>

                            <div className="mt-2 flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                max="3600"
                                step="1"
                                value={
                                  shortStartSeconds
                                }
                                onChange={event =>
                                  setShortStartSeconds(
                                    Math.max(
                                      0,
                                      Number(
                                        event.target.value
                                      ) || 0
                                    )
                                  )
                                }
                                disabled={
                                  shortBuilding
                                }
                                className="w-full rounded-xl border border-white/15 bg-black px-4 py-3 text-white"
                              />

                              <span className="text-xs font-black text-white/45">
                                SEC
                              </span>
                            </div>
                          </label>

                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            void createShortFromVideo()
                          }
                          disabled={
                            shortBuilding ||
                            mediaUploading
                          }
                          className="mt-4 w-full rounded-xl bg-fuchsia-500 px-5 py-4 text-sm font-black text-white disabled:opacity-40"
                        >
                          {shortBuilding
                            ? "CREATING SHORT..."
                            : shortBuilt
                              ? "CREATE ANOTHER SHORT"
                              : "CREATE SHORT"}
                        </button>

                        {shortBuilt ? (
                          <div className="mt-3 rounded-xl border border-green-400/25 bg-green-500/10 p-3 text-center text-xs font-black text-green-200">
                            SHORT READY — THIS VERSION WILL BE SCHEDULED
                          </div>
                        ) : null}

                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() =>
                        void removeMedia()
                      }
                      disabled={
                        mediaUploading ||
                        shortBuilding
                      }
                      className="mt-4 w-full rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-xs font-black text-red-200 disabled:opacity-40"
                    >
                      REMOVE UPLOADED MEDIA
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-6">
              <div className="text-sm font-black text-white/60">
                PLATFORMS
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {(
                  Object.keys(
                    platformNames
                  ) as PlatformKey[]
                ).map(
                  platform => {
                    const included =
                      allowed.includes(
                        platform
                      );

                    const platformData =
                      connections?.[
                        platform
                      ];

                    const connected =
                      platformData
                        ?.connected ===
                      true;

                    return (
                      <button
                        key={platform}
                        type="button"
                        disabled={
                          !included ||
                          !connected
                        }
                        onClick={() =>
                          togglePlatform(
                            platform
                          )
                        }
                        className={
                          selected.includes(
                            platform
                          )
                            ? "rounded-xl border border-cyan-300 bg-cyan-500/20 px-4 py-4 text-left font-black text-cyan-100"
                            : "rounded-xl border border-white/10 bg-black/30 px-4 py-4 text-left font-black text-white disabled:opacity-25"
                        }
                      >
                        <div>
                          {
                            platformNames[
                              platform
                            ]
                          }
                        </div>

                        <div className="mt-1 text-xs font-normal text-white/45">
                          {!included
                            ? "Not included in plan"
                            : connected
                              ? selected.includes(
                                  platform
                                )
                                ? "Selected"
                                : "Connected"
                              : "Not connected"}
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            <div className="mt-6">
              <label className="text-sm font-black text-white/60">
                SCHEDULE DATE & TIME
              </label>

              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={event =>
                  setScheduledFor(
                    event.target.value
                  )
                }
                required
                className="mt-2 w-full rounded-xl border border-white/15 bg-black px-4 py-3 text-white"
              />
            </div>

            <div className="mt-5">
              <label className="text-sm font-black text-white/60">
                RECURRING
              </label>

              <select
                value={recurrence}
                onChange={event =>
                  setRecurrence(
                    event.target
                      .value as
                      | "none"
                      | "daily"
                      | "weekly"
                  )
                }
                className="mt-2 w-full rounded-xl border border-white/15 bg-black px-4 py-3 text-white"
              >
                <option value="none">
                  DO NOT REPEAT
                </option>

                <option value="daily">
                  DAILY
                </option>

                <option value="weekly">
                  WEEKLY
                </option>
              </select>
            </div>

            <button
              type="submit"
              disabled={
                busy ||
                !connections
                  ?.accessActive ||
                (
                  postType === "video" &&
                  videoMode === "short" &&
                  !shortBuilt
                )
              }
              className="mt-7 w-full rounded-xl bg-white px-5 py-4 text-sm font-black text-black disabled:opacity-30"
            >
              {busy
                ? "SCHEDULING..."
                : postType === "video" &&
                    videoMode === "short" &&
                    !shortBuilt
                  ? "CREATE SHORT BEFORE SCHEDULING"
                  : videoMode === "short" &&
                      postType === "video"
                    ? "SCHEDULE SHORT VIDEO"
                    : postType === "video"
                      ? "SCHEDULE LONG VIDEO"
                      : "SCHEDULE POST"}
            </button>
          </form>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-black">
                SCHEDULED POSTS
              </h2>

              <button
                type="button"
                onClick={() =>
                  void refresh()
                }
                disabled={refreshing}
                className="rounded-xl border border-white/15 px-4 py-2 text-xs font-black disabled:opacity-40"
              >
                {refreshing
                  ? "REFRESHING..."
                  : "REFRESH"}
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {posts.length ===
              0 ? (
                <div className="rounded-xl border border-white/10 bg-black/30 p-5 text-sm text-white/50">
                  No scheduled posts yet.
                </div>
              ) : null}

              {posts.map(
                post => (
                  <article
                    key={post.id}
                    className="rounded-2xl border border-white/10 bg-black/30 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="font-black">
                        {post.postType.toUpperCase()}
                      </div>

                      <div className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-black text-cyan-200">
                        {post.status}
                      </div>
                    </div>

                    {post.title ? (
                      <div className="mt-3 text-lg font-black text-white">
                        {post.title}
                      </div>
                    ) : null}

                    {post.caption ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-white/70">
                        {post.caption}
                      </p>
                    ) : null}

                    <div className="mt-4 text-xs text-white/45">
                      Platforms:{" "}
                      {post.platforms
                        .map(
                          platform =>
                            platformNames[
                              platform as
                                PlatformKey
                            ] ||
                            platform
                        )
                        .join(", ")}
                    </div>

                    <div className="mt-2 text-xs text-white/45">
                      Scheduled:{" "}
                      {post.scheduledFor
                        ? new Date(
                            post.scheduledFor
                          ).toLocaleString()
                        : "—"}
                    </div>

                    <div className="mt-2 text-xs text-white/45">
                      Repeat:{" "}
                      {post.recurrence.toUpperCase()}
                    </div>

                    {/* PUBLISH FAILURE DETAILS */}
                    {post.status === "FAILED" ? (
                      <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/30 p-4">
                        <div className="text-xs font-black text-red-300">
                          PUBLISH FAILED
                        </div>

                        {post.lastError ? (
                          <div className="mt-2 text-sm text-red-100">
                            {post.lastError}
                          </div>
                        ) : (
                          <div className="mt-2 text-sm text-red-100">
                            Publishing failed. No detailed error was returned.
                          </div>
                        )}

                        {post.platformStatus &&
                        Object.keys(post.platformStatus).length > 0 ? (
                          <div className="mt-3 text-xs text-white/60">
                            {Object.entries(post.platformStatus)
                              .map(
                                ([platform, status]) =>
                                  `${platform}: ${status}`
                              )
                              .join(" • ")}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {post.status ===
                    "SCHEDULED" ? (
                      <button
                        type="button"
                        onClick={() =>
                          void cancelPost(
                            post.id
                          )
                        }
                        className="mt-4 w-full rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-xs font-black text-red-200"
                      >
                        CANCEL SCHEDULED POST
                      </button>
                    ) : null}

                    {post.status !==
                    "SCHEDULED" ? (
                      <button
                        type="button"
                        onClick={() =>
                          void deletePost(
                            post.id
                          )
                        }
                        className="mt-4 w-full rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs font-black text-red-200"
                      >
                        DELETE POST
                      </button>
                    ) : null}
                  </article>
                )
              )}
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}






