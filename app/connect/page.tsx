"use client";

import Link from "next/link";
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";

import { useAuth } from "../auth/AuthContext";
import { firebaseStorage } from "../../lib/firebaseClient";

type Profile = {
  uid: string;
  username: string;
  displayName: string;
  bio: string;
  photoURL: string;
  photoPath?: string;
  followerCount: number;
  followingCount: number;
  postCount: number;
};

type Post = {
  id: string;
  authorUid: string;
  username: string;
  displayName: string;
  photoURL: string;
  text: string;
  mediaURL: string;
  mediaPath: string;
  mediaType: "" | "image" | "audio" | "video";
  mediaName: string;
  likeCount: number;
  commentCount: number;
  createdAt: string | null;
  liked: boolean;
};

type Comment = {
  id: string;
  uid: string;
  username: string;
  displayName: string;
  text: string;
  createdAt: string | null;
};

const LIMITS = {
  image: 25 * 1024 * 1024,
  audio: 100 * 1024 * 1024,
  video: 250 * 1024 * 1024,
};

function mediaKind(file: File): "image" | "audio" | "video" | "" {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  return "";
}

function cleanFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
}

function renderConnectText(text: string) {
  return text
    .split(/(#[a-zA-Z0-9_]+)/g)
    .map((part, index) => {
      if (/^#[a-zA-Z0-9_]+$/.test(part)) {
        const tag =
          part.slice(1).toLowerCase();

        return (
          <Link
            key={`${part}-${index}`}
            href={`/connect/hashtag/${encodeURIComponent(tag)}`}
            className="font-black text-cyan-300 hover:underline"
          >
            {part}
          </Link>
        );
      }

      return (
        <span key={`${index}-${part}`}>
          {part}
        </span>
      );
    });
}

async function shareConnectUrl(
  title: string,
  path: string
) {
  const url =
    `${window.location.origin}${path}`;

  try {
    if (
      typeof navigator.share === "function"
    ) {
      await navigator.share({
        title,
        text:
          "Check this out on SOLO CONNECT.",
        url,
      });

      return;
    }

    await navigator.clipboard.writeText(
      url
    );

    window.alert(
      "SOLO CONNECT link copied."
    );
  }
  catch (error) {
    if (
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        url
      );

      window.alert(
        "SOLO CONNECT link copied."
      );
    }
    catch {
      window.prompt(
        "Copy this SOLO CONNECT link:",
        url
      );
    }
  }
}

function MediaView({ post }: { post: Post }) {
  if (!post.mediaURL || !post.mediaType) return null;

  if (post.mediaType === "image") {
    return (
      <img
        src={post.mediaURL}
        alt={post.mediaName || "Post image"}
        className="mt-5 max-h-[620px] w-full rounded-2xl object-contain bg-black"
      />
    );
  }

  if (post.mediaType === "audio") {
    return (
      <div className="mt-5 rounded-2xl border border-white/10 bg-black/40 p-4">
        <p className="mb-3 truncate text-sm text-white/50">
          {post.mediaName || "Audio"}
        </p>
        <audio controls preload="metadata" className="w-full">
          <source src={post.mediaURL} />
        </audio>
      </div>
    );
  }

  return (
    <video
      controls
      preload="metadata"
      className="mt-5 max-h-[620px] w-full rounded-2xl bg-black"
      src={post.mediaURL}
    />
  );
}

export default function SoloConnectPage() {
  const { user, loading } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [postText, setPostText] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const [openComments, setOpenComments] = useState<Record<string, Comment[]>>({});
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editPostText, setEditPostText] = useState("");
  const [editMediaFile, setEditMediaFile] = useState<File | null>(null);
  const [removeEditMedia, setRemoveEditMedia] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState("");
  const [editingCommentText, setEditingCommentText] = useState("");

  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const editMediaInputRef = useRef<HTMLInputElement | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }

    const idToken = await user.getIdToken();
    const response = await fetch("/api/connect/profile", {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: "no-store",
    });

    const data = await response.json();

    if (response.ok && data.success) {
      setProfile(data.profile || null);

      if (data.profile) {
        setUsername(data.profile.username || "");
        setDisplayName(data.profile.displayName || user.displayName || "");
        setBio(data.profile.bio || "");
      } else {
        setDisplayName(user.displayName || "");
      }
    }
  }, [user]);

  const loadPosts = useCallback(async () => {
    const headers: Record<string, string> = {};

    if (user) {
      const idToken = await user.getIdToken();
      headers.Authorization = `Bearer ${idToken}`;
    }

    const response = await fetch("/api/connect/posts", {
      headers,
      cache: "no-store",
    });

    const data = await response.json();

    if (response.ok && data.success) {
      setPosts(Array.isArray(data.posts) ? data.posts : []);
    }
  }, [user]);

  useEffect(() => {
    void loadProfile();
    void loadPosts();
  }, [loadProfile, loadPosts]);

  // SOLO CONNECT NOTIFICATION DEEP LINK
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params =
      new URLSearchParams(
        window.location.search
      );

    const postId =
      params.get("post") || "";

    if (
      !postId ||
      !posts.some(post => post.id === postId)
    ) {
      return;
    }

    let cancelled = false;

    async function focusNotificationPost() {
      if (
        params.get("comments") === "1"
      ) {
        await loadComments(postId);
      }

      window.setTimeout(() => {
        if (cancelled) return;

        const element =
          document.getElementById(
            `post-${postId}`
          );

        if (!element) return;

        element.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });

        try {
          element.animate(
            [
              {
                outline:
                  "2px solid rgba(34,211,238,0.95)",
                boxShadow:
                  "0 0 0 rgba(34,211,238,0)",
              },
              {
                outline:
                  "2px solid rgba(34,211,238,0)",
                boxShadow:
                  "0 0 35px rgba(34,211,238,0.35)",
              },
              {
                outline:
                  "2px solid rgba(34,211,238,0)",
                boxShadow:
                  "0 0 0 rgba(34,211,238,0)",
              },
            ],
            {
              duration: 1800,
              easing: "ease-out",
            }
          );
        } catch {
          // Scrolling still works if animation is unavailable.
        }
      }, 150);
    }

    void focusNotificationPost();

    return () => {
      cancelled = true;
    };
  }, [posts]);

  useEffect(() => {
    return () => {
      if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    };
  }, [mediaPreview]);

  function chooseMedia(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;

    if (!file) {
      setMediaFile(null);
      setMediaPreview("");
      return;
    }

    const kind = mediaKind(file);

    if (!kind) {
      setError("Choose an image, audio file, or video.");
      event.target.value = "";
      return;
    }

    if (file.size > LIMITS[kind]) {
      const mb = Math.round(LIMITS[kind] / 1024 / 1024);
      setError(`${kind.toUpperCase()} files must be ${mb} MB or smaller.`);
      event.target.value = "";
      return;
    }

    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
    setError("");
  }

  async function uploadMedia(file: File, area: "posts" | "profile") {
    if (!user) throw new Error("Sign in required.");

    const kind = mediaKind(file);

    if (!kind) {
      throw new Error("Unsupported media type.");
    }

    const path =
      area === "profile"
        ? `solo-connect/${user.uid}/profile/${Date.now()}-${cleanFileName(file.name)}`
        : `solo-connect/${user.uid}/posts/${Date.now()}-${cleanFileName(file.name)}`;

    const storageRef = ref(firebaseStorage, path);

    return await new Promise<{
      mediaURL: string;
      mediaPath: string;
      mediaType: "image" | "audio" | "video";
      mediaName: string;
    }>((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, file, {
        contentType: file.type || undefined,
      });

      task.on(
        "state_changed",
        snapshot => {
          const progress =
            snapshot.totalBytes > 0
              ? Math.round(
                  (snapshot.bytesTransferred / snapshot.totalBytes) * 100
                )
              : 0;
          setUploadProgress(progress);
        },
        reject,
        async () => {
          try {
            const mediaURL = await getDownloadURL(task.snapshot.ref);
            resolve({
              mediaURL,
              mediaPath: path,
              mediaType: kind,
              mediaName: file.name,
            });
          } catch (uploadError) {
            reject(uploadError);
          }
        }
      );
    });
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

    setWorking(true);
    setError("");
    setMessage("");

    try {
      const idToken = await user.getIdToken();

      const response = await fetch("/api/connect/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          username,
          displayName,
          bio,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Profile could not be saved.");
      }

      setMessage("SOLO CONNECT profile saved.");
      await loadProfile();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Profile could not be saved."
      );
    } finally {
      setWorking(false);
    }
  }

  async function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user || !profile) return;

    if (!postText.trim() && !mediaFile) {
      setError("Add text or media before posting.");
      return;
    }

    setWorking(true);
    setError("");
    setMessage("");
    setUploadProgress(0);

    try {
      let media = {
        mediaURL: "",
        mediaPath: "",
        mediaType: "" as "" | "image" | "audio" | "video",
        mediaName: "",
      };

      if (mediaFile) {
        media = await uploadMedia(mediaFile, "posts");
      }

      const idToken = await user.getIdToken();

      const response = await fetch("/api/connect/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          text: postText,
          ...media,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Post could not be created.");
      }

      setPostText("");
      setMediaFile(null);
      setMediaPreview("");
      setUploadProgress(0);

      if (mediaInputRef.current) {
        mediaInputRef.current.value = "";
      }

      setMessage("Post published.");

      await loadPosts();
      await loadProfile();
    } catch (postError) {
      setError(
        postError instanceof Error
          ? postError.message
          : "Post could not be created."
      );
    } finally {
      setWorking(false);
    }
  }

  async function toggleLike(post: Post) {
    if (!user) {
      setError("Sign in to like posts.");
      return;
    }

    const idToken = await user.getIdToken();

    const response = await fetch("/api/connect/social", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        action: post.liked ? "unlike" : "like",
        postId: post.id,
      }),
    });

    if (response.ok) await loadPosts();
  }

  async function loadComments(postId: string) {
    const response = await fetch(
      `/api/connect/social?postId=${encodeURIComponent(postId)}`,
      { cache: "no-store" }
    );

    const data = await response.json();

    setOpenComments(current => ({
      ...current,
      [postId]: Array.isArray(data.comments) ? data.comments : [],
    }));
  }

  async function addComment(postId: string) {
    if (!user || !profile) {
      setError("Sign in and create your profile first.");
      return;
    }

    const text = commentText[postId] || "";
    if (!text.trim()) return;

    const idToken = await user.getIdToken();

    const response = await fetch("/api/connect/social", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        action: "comment",
        postId,
        text,
      }),
    });

    if (response.ok) {
      setCommentText(current => ({ ...current, [postId]: "" }));
      await loadComments(postId);
      await loadPosts();
    }
  }

  function beginEditPost(post: Post) {
    setEditingPost(post);
    setEditPostText(post.text);
    setEditMediaFile(null);
    setRemoveEditMedia(false);
    setError("");
  }

  async function savePostEdit() {
    if (!user || !editingPost) return;

    setWorking(true);
    setError("");
    setUploadProgress(0);

    try {
      let replacement:
        | {
            mediaURL: string;
            mediaPath: string;
            mediaType: "image" | "audio" | "video";
            mediaName: string;
          }
        | null = null;

      if (editMediaFile) {
        replacement = await uploadMedia(editMediaFile, "posts");
      }

      const idToken = await user.getIdToken();

      const response = await fetch("/api/connect/posts", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          postId: editingPost.id,
          text: editPostText,
          ...(replacement || {}),
          removeMedia: removeEditMedia && !replacement,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Post could not be updated.");
      }

      setEditingPost(null);
      setEditMediaFile(null);
      setRemoveEditMedia(false);
      setUploadProgress(0);

      if (editMediaInputRef.current) {
        editMediaInputRef.current.value = "";
      }

      await loadPosts();
      setMessage("Post updated.");
    } catch (editError) {
      setError(
        editError instanceof Error
          ? editError.message
          : "Post could not be updated."
      );
    } finally {
      setWorking(false);
    }
  }

  async function deletePost(post: Post) {
    if (!user) return;

    if (!window.confirm("Delete this post permanently?")) return;

    const idToken = await user.getIdToken();

    const response = await fetch(
      `/api/connect/posts?postId=${encodeURIComponent(post.id)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      setError(data.error || "Post could not be deleted.");
      return;
    }

    await loadPosts();
    await loadProfile();
    setMessage("Post deleted.");
  }

  async function saveCommentEdit(postId: string) {
    if (!user || !editingCommentId || !editingCommentText.trim()) return;

    const idToken = await user.getIdToken();

    const response = await fetch("/api/connect/social", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        commentId: editingCommentId,
        text: editingCommentText,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      setError(data.error || "Comment could not be updated.");
      return;
    }

    setEditingCommentId("");
    setEditingCommentText("");
    await loadComments(postId);
  }

  async function deleteComment(postId: string, commentId: string) {
    if (!user) return;

    if (!window.confirm("Delete this comment?")) return;

    const idToken = await user.getIdToken();

    const response = await fetch(
      `/api/connect/social?commentId=${encodeURIComponent(commentId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      setError(data.error || "Comment could not be deleted.");
      return;
    }

    await loadComments(postId);
    await loadPosts();
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center">

        Loading SOLO CONNECT...
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 pb-28 pt-12 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <section className="rounded-[2rem] border border-violet-400/20 bg-gradient-to-br from-violet-500/20 via-black to-cyan-500/10 p-7 sm:p-10">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">
            SOLO BEATS ENGINE MUSIC
          </p>

          <h1 className="mt-3 text-5xl font-black">SOLO CONNECT</h1>

          <p className="mt-4 max-w-2xl text-white/60">
            Connect with artists, listeners, DJs and creators. Share text,
            images, music and video with the SOLO BEATS community.
          </p>

          {profile ? (
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/connect/profile/${profile.username}`}
                className="rounded-xl bg-white px-5 py-3 font-black text-black"
              >
                My Profile
              </Link>

              <Link
                href="/connect/messages"
                className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-5 py-3 font-black text-cyan-100"
              >
                Messages
              </Link>

              <Link
                href="/connect/search"
                className="rounded-xl border border-violet-300/20 bg-violet-300/10 px-5 py-3 font-black text-violet-100"
              >
                Search
              </Link>

              <Link
                href="/connect/discover"
                className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-5 py-3 font-black text-emerald-100"
              >
                Discover
              </Link>

              <Link
                href="/connect/monetize"
                className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-5 py-3 font-black text-amber-100"
              >
                Monetize
              </Link>

              <span className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-white/70">
                @{profile.username}
              </span>
            </div>
          ) : null}
        </section>

        {!user ? (
          <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] p-7">
            <h2 className="text-2xl font-black">Join SOLO CONNECT</h2>
            <p className="mt-2 text-white/55">
              Sign in or create your SOLO BEATS account to post, follow
              members, like and comment.
            </p>
            <Link
              href="/account?mode=signin"
              className="mt-5 inline-flex rounded-xl bg-white px-5 py-3 font-black text-black"
            >
              Sign In
            </Link>
          </section>
        ) : !profile ? (
          <form
            onSubmit={saveProfile}
            className="mt-6 rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.05] p-7"
          >
            <h2 className="text-2xl font-black">Create your SOLO CONNECT profile</h2>

            <div className="mt-5 grid gap-4">
              <input
                required
                minLength={3}
                maxLength={24}
                value={username}
                onChange={event =>
                  setUsername(
                    event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
                  )
                }
                placeholder="username"
                className="rounded-xl border border-white/10 bg-black px-4 py-4"
              />

              <input
                value={displayName}
                onChange={event => setDisplayName(event.target.value)}
                placeholder="Display name"
                className="rounded-xl border border-white/10 bg-black px-4 py-4"
              />

              <textarea
                value={bio}
                maxLength={500}
                onChange={event => setBio(event.target.value)}
                placeholder="Tell the community about yourself..."
                className="min-h-28 rounded-xl border border-white/10 bg-black px-4 py-4"
              />

              <button
                type="submit"
                disabled={working}
                className="rounded-xl bg-emerald-300 px-5 py-4 font-black text-black disabled:opacity-50"
              >
                CREATE PROFILE
              </button>
            </div>
          </form>
        ) : (
          <form
            onSubmit={createPost}
            className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] p-6"
          >
            <textarea
              maxLength={3000}
              value={postText}
              onChange={event => setPostText(event.target.value)}
              placeholder="Share something with SOLO CONNECT..."
              className="min-h-32 w-full rounded-2xl border border-white/10 bg-black px-5 py-4 outline-none focus:border-violet-400"
            />

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => mediaInputRef.current?.click()}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-black"
              >
                ADD IMAGE / AUDIO / VIDEO
              </button>

              {mediaFile ? (
                <button
                  type="button"
                  onClick={() => {
                    setMediaFile(null);
                    setMediaPreview("");
                    if (mediaInputRef.current) mediaInputRef.current.value = "";
                  }}
                  className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 font-black text-red-200"
                >
                  REMOVE MEDIA
                </button>
              ) : null}
            </div>

            <input
              ref={mediaInputRef}
              type="file"
              accept="image/*,audio/*,video/*"
              onChange={chooseMedia}
              className="hidden"
            />

            {mediaFile && mediaPreview ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-4">
                <p className="mb-3 truncate text-sm text-white/55">
                  {mediaFile.name}
                </p>

                {mediaKind(mediaFile) === "image" ? (
                  <img
                    src={mediaPreview}
                    alt=""
                    className="max-h-80 w-full rounded-xl object-contain"
                  />
                ) : mediaKind(mediaFile) === "audio" ? (
                  <audio controls src={mediaPreview} className="w-full" />
                ) : (
                  <video
                    controls
                    src={mediaPreview}
                    className="max-h-80 w-full rounded-xl"
                  />
                )}
              </div>
            ) : null}

            {working && uploadProgress > 0 ? (
              <p className="mt-3 text-sm text-cyan-300">
                Uploading {uploadProgress}%
              </p>
            ) : null}

            <div className="mt-4 flex items-center justify-between gap-4">
              <span className="text-sm text-white/40">
                {postText.length} / 3000
              </span>

              <button
                type="submit"
                disabled={working || (!postText.trim() && !mediaFile)}
                className="rounded-xl bg-white px-6 py-3 font-black text-black disabled:opacity-40"
              >
                {working ? "WORKING..." : "POST"}
              </button>
            </div>
          </form>
        )}

        {message ? (
          <p className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-emerald-200">
            {message}
          </p>
        ) : null}

        {error ? (
          <p className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">
            {error}
          </p>
        ) : null}

        <section className="mt-8 space-y-5">
          {posts.map(post => (
            <article
              key={post.id}
              id={`post-${post.id}`}
              className="scroll-mt-24 rounded-3xl border border-white/10 bg-[#0b0b12] p-6"
            >
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 font-black">
                  {post.photoURL ? (
                    <img
                      src={post.photoURL}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (post.displayName || post.username || "SB")
                      .slice(0, 2)
                      .toUpperCase()
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/connect/profile/${post.username}`}
                    className="font-black hover:underline"
                  >
                    {post.displayName || post.username}
                  </Link>
                  <p className="text-sm text-white/40">@{post.username}</p>
                </div>

                <button
                  type="button"
                  aria-label="Share this SOLO CONNECT post"
                  onClick={() =>
                    void shareConnectUrl(
                      `${post.displayName || post.username} on SOLO CONNECT`,
                      `/connect?post=${encodeURIComponent(
                        post.id
                      )}#post-${encodeURIComponent(
                        post.id
                      )}`
                    )
                  }
                  className="rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-200"
                >
                  SHARE
                </button>

                {user && user.uid !== post.authorUid ? (
                  <Link
                    aria-label="Report this SOLO CONNECT post"
                    href={`/connect/report?type=post&postId=${encodeURIComponent(
                      post.id
                    )}&uid=${encodeURIComponent(
                      post.authorUid
                    )}&username=${encodeURIComponent(
                      post.username
                    )}`}
                    className="rounded-lg border border-red-400/20 px-3 py-2 text-xs font-black text-red-300"
                  >
                    REPORT
                  </Link>
                ) : null}

                {user?.uid === post.authorUid ? (
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/connect/promote?post=${encodeURIComponent(post.id)}`}
                      className="rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs font-black text-amber-200"
                    >
                      PROMOTE
                    </Link>

                    <button
                      type="button"
                      onClick={() => beginEditPost(post)}
                      className="rounded-lg border border-white/10 px-3 py-2 text-xs font-black"
                    >
                      EDIT
                    </button>

                    <button
                      type="button"
                      onClick={() => void deletePost(post)}
                      className="rounded-lg border border-red-400/20 px-3 py-2 text-xs font-black text-red-300"
                    >
                      DELETE
                    </button>
                  </div>
                ) : user ? (
                  <Link
                    href={`/connect/support?creator=${encodeURIComponent(post.authorUid)}`}
                    className="rounded-lg border border-pink-300/25 bg-pink-300/10 px-3 py-2 text-xs font-black text-pink-200"
                  >
                    SUPPORT CREATOR
                  </Link>
                ) : null}
              </div>

              {post.text ? (
                <p className="mt-5 whitespace-pre-wrap text-lg leading-8 text-white/90">
                  {renderConnectText(post.text)}
                </p>
              ) : null}

              <MediaView post={post} />

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void toggleLike(post)}
                  className={`rounded-xl border px-4 py-2 text-sm font-black ${
                    post.liked
                      ? "border-red-400/30 bg-red-400/15 text-red-200"
                      : "border-white/10 bg-white/5 text-white/70"
                  }`}
                >
                  LIKE {post.likeCount}
                </button>

                <button
                  type="button"
                  onClick={() => void loadComments(post.id)}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white/70"
                >
                  COMMENTS {post.commentCount}
                </button>
              </div>

              {openComments[post.id] ? (
                <div className="mt-5 border-t border-white/10 pt-5">
                  <div className="space-y-3">
                    {openComments[post.id].map(comment => (
                      <div
                        key={comment.id}
                        className="rounded-xl bg-white/[0.04] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/connect/profile/${comment.username}`}
                              className="font-black"
                            >
                              {comment.displayName || comment.username}
                            </Link>

                            {editingCommentId === comment.id ? (
                              <div className="mt-3 flex gap-2">
                                <input
                                  value={editingCommentText}
                                  onChange={event =>
                                    setEditingCommentText(event.target.value)
                                  }
                                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black px-3 py-2"
                                />
                                <button
                                  type="button"
                                  onClick={() => void saveCommentEdit(post.id)}
                                  className="rounded-xl bg-white px-3 py-2 text-xs font-black text-black"
                                >
                                  SAVE
                                </button>
                              </div>
                            ) : (
                              <p className="mt-1 text-sm text-white/75">
                                {comment.text}
                              </p>
                            )}
                          </div>

                          {user?.uid === comment.uid ? (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCommentId(comment.id);
                                  setEditingCommentText(comment.text);
                                }}
                                className="text-xs font-black text-cyan-300"
                              >
                                EDIT
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void deleteComment(post.id, comment.id)
                                }
                                className="text-xs font-black text-red-300"
                              >
                                DELETE
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>

                  {user && profile ? (
                    <div className="mt-4 flex gap-2">
                      <input
                        value={commentText[post.id] || ""}
                        onChange={event =>
                          setCommentText(current => ({
                            ...current,
                            [post.id]: event.target.value,
                          }))
                        }
                        placeholder="Write a comment..."
                        className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black px-4 py-3"
                      />
                      <button
                        type="button"
                        onClick={() => void addComment(post.id)}
                        className="rounded-xl bg-white px-4 py-3 font-black text-black"
                      >
                        SEND
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}

          {posts.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center text-white/45">
              No SOLO CONNECT posts yet.
            </div>
          ) : null}
        </section>
      </div>

      {editingPost ? (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#101018] p-6">
            <h2 className="text-2xl font-black">EDIT POST</h2>

            <textarea
              maxLength={3000}
              value={editPostText}
              onChange={event => setEditPostText(event.target.value)}
              className="mt-4 min-h-32 w-full rounded-xl border border-white/10 bg-black p-4"
            />

            {editingPost.mediaURL && !removeEditMedia ? (
              <MediaView post={editingPost} />
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => editMediaInputRef.current?.click()}
                className="rounded-xl border border-white/10 px-4 py-3 font-black"
              >
                REPLACE / ADD MEDIA
              </button>

              {editingPost.mediaURL ? (
                <button
                  type="button"
                  onClick={() => {
                    setRemoveEditMedia(true);
                    setEditMediaFile(null);
                  }}
                  className="rounded-xl border border-red-400/20 px-4 py-3 font-black text-red-300"
                >
                  REMOVE CURRENT MEDIA
                </button>
              ) : null}
            </div>

            <input
              ref={editMediaInputRef}
              type="file"
              accept="image/*,audio/*,video/*"
              className="hidden"
              onChange={event => {
                const file = event.target.files?.[0] || null;
                if (!file) return;

                const kind = mediaKind(file);

                if (!kind || file.size > LIMITS[kind]) {
                  setError("That file type or size is not allowed.");
                  event.target.value = "";
                  return;
                }

                setEditMediaFile(file);
                setRemoveEditMedia(false);
              }}
            />

            {editMediaFile ? (
              <p className="mt-3 text-sm text-cyan-300">
                New media: {editMediaFile.name}
              </p>
            ) : null}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingPost(null);
                  setEditMediaFile(null);
                  setRemoveEditMedia(false);
                }}
                className="rounded-xl border border-white/10 px-5 py-3 font-black"
              >
                CANCEL
              </button>

              <button
                type="button"
                disabled={working}
                onClick={() => void savePostEdit()}
                className="rounded-xl bg-white px-5 py-3 font-black text-black disabled:opacity-50"
              >
                SAVE CHANGES
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}