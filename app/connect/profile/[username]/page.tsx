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
import { useParams, useRouter } from "next/navigation";
import {
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";

import { useAuth } from "../../../auth/AuthContext";
import { firebaseStorage } from "../../../../lib/firebaseClient";

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
  text: string;
  mediaURL: string;
  mediaPath: string;
  mediaType: "" | "image" | "audio" | "video";
  mediaName: string;
  likeCount: number;
  commentCount: number;
  createdAt: string | null;
};

const MAX_PROFILE_PHOTO = 10 * 1024 * 1024;

function cleanFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
}

async function shareConnectProfile(
  title: string,
  username: string
) {
  const url =
    `${window.location.origin}/connect/profile/${encodeURIComponent(
      username
    )}`;

  try {
    if (
      typeof navigator.share === "function"
    ) {
      await navigator.share({
        title,
        text:
          "Check out this creator on SOLO CONNECT.",
        url,
      });

      return;
    }

    await navigator.clipboard.writeText(
      url
    );

    window.alert(
      "Creator profile link copied."
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
        "Creator profile link copied."
      );
    }
    catch {
      window.prompt(
        "Copy this creator profile link:",
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
      <audio controls preload="metadata" className="mt-5 w-full">
        <source src={post.mediaURL} />
      </audio>
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

export default function ConnectProfilePage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const routeUsername = String(params?.username || "").toLowerCase();
  const { user } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [following, setFollowing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState("");
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoadingProfile(true);

    try {
      const profileResponse = await fetch(
        `/api/connect/profile?username=${encodeURIComponent(routeUsername)}`,
        { cache: "no-store" }
      );

      const profileData = await profileResponse.json();
      const loadedProfile: Profile | null = profileData.profile || null;

      setProfile(loadedProfile);

      const postsResponse = await fetch(
        `/api/connect/posts?username=${encodeURIComponent(routeUsername)}`,
        { cache: "no-store" }
      );

      const postsData = await postsResponse.json();

      setPosts(Array.isArray(postsData.posts) ? postsData.posts : []);

      if (user) {
        const idToken = await user.getIdToken();

        const mineResponse = await fetch("/api/connect/profile", {
          headers: { Authorization: `Bearer ${idToken}` },
          cache: "no-store",
        });

        const mineData = await mineResponse.json();
        setMyProfile(mineData.profile || null);

        if (loadedProfile && loadedProfile.uid !== user.uid) {
          const followResponse = await fetch(
            `/api/connect/social?followerUid=${encodeURIComponent(
              user.uid
            )}&followingUid=${encodeURIComponent(loadedProfile.uid)}`,
            { cache: "no-store" }
          );

          const followData = await followResponse.json();
          setFollowing(followData.following === true);
        } else {
          setFollowing(false);
        }
      } else {
        setMyProfile(null);
        setFollowing(false);
      }
    } finally {
      setLoadingProfile(false);
    }
  }, [routeUsername, user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (profile) {
      setEditUsername(profile.username);
      setEditDisplayName(profile.displayName);
      setEditBio(profile.bio);
    }
  }, [profile]);

  useEffect(() => {
    return () => {
      if (profilePhotoPreview) URL.revokeObjectURL(profilePhotoPreview);
    };
  }, [profilePhotoPreview]);

  async function toggleFollow() {
    if (!user || !profile || profile.uid === user.uid) return;

    if (!myProfile) {
      setError("Create your SOLO CONNECT profile first.");
      return;
    }

    setError("");

    const idToken = await user.getIdToken();

    const response = await fetch("/api/connect/social", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        action: following ? "unfollow" : "follow",
        targetUid: profile.uid,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      setError(data.error || "Follow action failed.");
      return;
    }

    await load();
  }

  function chooseProfilePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Profile photo must be an image.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_PROFILE_PHOTO) {
      setError("Profile photo must be 10 MB or smaller.");
      event.target.value = "";
      return;
    }

    if (profilePhotoPreview) URL.revokeObjectURL(profilePhotoPreview);

    setProfilePhoto(file);
    setProfilePhotoPreview(URL.createObjectURL(file));
    setRemovePhoto(false);
    setError("");
  }

  async function uploadProfilePhoto(file: File) {
    if (!user) throw new Error("Sign in required.");

    const path = `solo-connect/${user.uid}/profile/${Date.now()}-${cleanFileName(
      file.name
    )}`;

    const storageRef = ref(firebaseStorage, path);

    return await new Promise<{ photoURL: string; photoPath: string }>(
      (resolve, reject) => {
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
              const photoURL = await getDownloadURL(task.snapshot.ref);
              resolve({ photoURL, photoPath: path });
            } catch (uploadError) {
              reject(uploadError);
            }
          }
        );
      }
    );
  }

  async function saveProfileEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user || !profile || user.uid !== profile.uid) return;

    setSaving(true);
    setError("");
    setMessage("");
    setUploadProgress(0);

    try {
      let uploaded: { photoURL: string; photoPath: string } | null = null;

      if (profilePhoto) {
        uploaded = await uploadProfilePhoto(profilePhoto);
      }

      const idToken = await user.getIdToken();

      const response = await fetch("/api/connect/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          username: editUsername,
          displayName: editDisplayName,
          bio: editBio,
          ...(uploaded || {}),
          removePhoto: removePhoto && !uploaded,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Profile could not be updated.");
      }

      setEditingProfile(false);
      setProfilePhoto(null);
      setProfilePhotoPreview("");
      setRemovePhoto(false);
      setUploadProgress(0);
      setMessage("Profile updated.");

      if (data.username !== routeUsername) {
        router.replace(`/connect/profile/${data.username}`);
        return;
      }

      await load();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Profile could not be updated."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deletePost(post: Post) {
    if (!user || user.uid !== post.authorUid) return;
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

    setMessage("Post deleted.");
    await load();
  }

  if (loadingProfile) {
    return (
      <main className="grid min-h-screen place-items-center">
        Loading profile...
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen px-6 py-20">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.035] p-10">
          SOLO CONNECT profile not found.
        </div>
      </main>
    );
  }

  const ownProfile = user?.uid === profile.uid;

  return (
    <main className="min-h-screen px-4 pb-28 pt-12 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/connect"
          className="text-sm font-black text-cyan-300"
        >
          â† SOLO CONNECT
        </Link>

        <section className="mt-5 rounded-[2rem] border border-white/10 bg-gradient-to-br from-violet-500/20 via-black to-cyan-400/10 p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 text-3xl font-black">
              {profile.photoURL ? (
                <img
                  src={profile.photoURL}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                (profile.displayName || profile.username || "SB")
                  .slice(0, 2)
                  .toUpperCase()
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="text-4xl font-black">
                {profile.displayName || profile.username}
              </h1>

              <p className="mt-1 text-white/50">@{profile.username}</p>

              {profile.bio ? (
                <p className="mt-4 max-w-2xl leading-7 text-white/70">
                  {profile.bio}
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-4 text-sm">
                <span>
                  <strong>{profile.postCount}</strong> Posts
                </span>
                <span>
                  <strong>{profile.followerCount}</strong> Followers
                </span>
                <span>
                  <strong>{profile.followingCount}</strong> Following
                </span>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  aria-label="Share this SOLO CONNECT profile"
                  onClick={() =>
                    void shareConnectProfile(
                      `${profile.displayName || profile.username} on SOLO CONNECT`,
                      profile.username
                    )
                  }
                  className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-6 py-3 font-black text-cyan-200"
                >
                  SHARE PROFILE
                </button>
              </div>

              {!ownProfile && user ? (
                <Link
                  aria-label="Report this SOLO CONNECT profile"
                  href={`/connect/report?type=profile&uid=${encodeURIComponent(
                    profile.uid
                  )}&username=${encodeURIComponent(
                    profile.username
                  )}`}
                  className="mt-5 inline-flex rounded-xl border border-red-400/20 px-6 py-3 font-black text-red-300"
                >
                  REPORT / BLOCK
                </Link>
              ) : null}

              {ownProfile ? (
                <button
                  type="button"
                  onClick={() => setEditingProfile(value => !value)}
                  className="mt-5 rounded-xl bg-white px-6 py-3 font-black text-black"
                >
                  {editingProfile ? "CLOSE EDITOR" : "EDIT PROFILE"}
                </button>
              ) : user ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleFollow()}
                    className="rounded-xl bg-white px-6 py-3 font-black text-black"
                  >
                    {following ? "UNFOLLOW" : "FOLLOW"}
                  </button>

                  <Link
                    href={`/connect/messages?to=${profile.uid}`}
                    className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-6 py-3 font-black text-cyan-100"
                  >
                    MESSAGE
                  </Link>
                </div>
              ) : null}
            </div>
          </div>

          {ownProfile && editingProfile ? (
            <form
              onSubmit={saveProfileEdit}
              className="mt-8 grid gap-4 border-t border-white/10 pt-6"
            >
              <input
                required
                minLength={3}
                maxLength={24}
                value={editUsername}
                onChange={event =>
                  setEditUsername(
                    event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
                  )
                }
                placeholder="Username"
                className="rounded-xl border border-white/10 bg-black px-4 py-4"
              />

              <input
                value={editDisplayName}
                onChange={event => setEditDisplayName(event.target.value)}
                placeholder="Display name"
                className="rounded-xl border border-white/10 bg-black px-4 py-4"
              />

              <textarea
                maxLength={500}
                value={editBio}
                onChange={event => setEditBio(event.target.value)}
                placeholder="Bio"
                className="min-h-28 rounded-xl border border-white/10 bg-black px-4 py-4"
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="rounded-xl border border-white/10 px-4 py-3 font-black"
                >
                  CHANGE PROFILE PHOTO
                </button>

                {profile.photoURL ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRemovePhoto(true);
                      setProfilePhoto(null);
                      setProfilePhotoPreview("");
                    }}
                    className="rounded-xl border border-red-400/20 px-4 py-3 font-black text-red-300"
                  >
                    REMOVE PHOTO
                  </button>
                ) : null}
              </div>

              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={chooseProfilePhoto}
                className="hidden"
              />

              {profilePhotoPreview ? (
                <img
                  src={profilePhotoPreview}
                  alt=""
                  className="h-32 w-32 rounded-full object-cover"
                />
              ) : null}

              {saving && uploadProgress > 0 ? (
                <p className="text-sm text-cyan-300">
                  Uploading {uploadProgress}%
                </p>
              ) : null}

              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-emerald-300 px-5 py-4 font-black text-black disabled:opacity-50"
              >
                {saving ? "SAVING..." : "SAVE PROFILE"}
              </button>
            </form>
          ) : null}
        </section>

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

        <section className="mt-8 space-y-4">
          <h2 className="text-2xl font-black">Posts</h2>

          {posts.map(post => (
            <article
              key={post.id}
              className="rounded-3xl border border-white/10 bg-[#0b0b12] p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  {post.text ? (
                    <p className="whitespace-pre-wrap text-lg leading-8 text-white/90">
                      {post.text}
                    </p>
                  ) : null}
                </div>

                {ownProfile && post.authorUid === user?.uid ? (
                  <button
                    type="button"
                    onClick={() => void deletePost(post)}
                    className="rounded-lg border border-red-400/20 px-3 py-2 text-xs font-black text-red-300"
                  >
                    DELETE
                  </button>
                ) : null}
              </div>

              <MediaView post={post} />

              <div className="mt-4 flex gap-4 text-sm text-white/45">
                <span>Likes {post.likeCount}</span>
                <span>Comments {post.commentCount}</span>
              </div>
            </article>
          ))}

          {posts.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-white/45">
              No posts yet.
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}