"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";
import {
  useParams,
} from "next/navigation";

type Post = {
  id: string;
  username: string;
  displayName: string;
  text: string;
  mediaURL: string;
  mediaType: string;
  mediaName: string;
  likeCount: number;
  commentCount: number;
  hashtags: string[];
};

export default function HashtagPage() {
  const params =
    useParams<{
      tag: string;
    }>();

  const tag =
    decodeURIComponent(
      String(
        params?.tag || ""
      )
    )
      .replace(/^#/, "")
      .toLowerCase();

  const [
    posts,
    setPosts,
  ] = useState<Post[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    if (!tag) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const response =
          await fetch(
            `/api/connect/discovery?tag=${encodeURIComponent(
              tag
            )}`,
            {
              cache: "no-store",
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              "Hashtag could not load."
          );
        }

        if (!cancelled) {
          setPosts(
            Array.isArray(
              data.posts
            )
              ? data.posts
              : []
          );
        }
      }
      catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Hashtag could not load."
          );
        }
      }
      finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [tag]);

  return (
    <main className="min-h-screen px-4 pb-28 pt-12 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <section className="rounded-[2rem] border border-cyan-300/20 bg-gradient-to-br from-cyan-400/10 via-black to-violet-500/15 p-7 sm:p-10">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">
            SOLO CONNECT HASHTAG
          </p>

          <h1 className="mt-3 break-words text-4xl font-black sm:text-6xl">
            #{tag}
          </h1>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/connect"
              className="rounded-xl bg-white px-5 py-3 font-black text-black"
            >
              CONNECT
            </Link>

            <Link
              href="/connect/discover"
              className="rounded-xl border border-violet-300/20 bg-violet-300/10 px-5 py-3 font-black text-violet-100"
            >
              DISCOVER
            </Link>
          </div>
        </section>

        {loading ? (
          <p className="mt-8 text-white/50">
            Loading posts...
          </p>
        ) : null}

        {error ? (
          <p className="mt-8 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">
            {error}
          </p>
        ) : null}

        {!loading &&
        !error &&
        posts.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-white/15 p-10 text-center text-white/50">
            No posts use #{tag} yet.
          </div>
        ) : null}

        <section className="mt-8 space-y-5">
          {posts.map(post => (
            <article
              key={post.id}
              className="rounded-3xl border border-white/10 bg-[#0b0b12] p-6"
            >
              <Link
                href={`/connect/profile/${post.username}`}
                className="font-black hover:underline"
              >
                {post.displayName ||
                  post.username}
              </Link>

              <p className="text-sm text-white/40">
                @{post.username}
              </p>

              {post.text ? (
                <p className="mt-4 whitespace-pre-wrap text-white/85">
                  {post.text}
                </p>
              ) : null}

              {post.mediaType === "image" &&
              post.mediaURL ? (
                <img
                  src={post.mediaURL}
                  alt=""
                  className="mt-4 max-h-[520px] w-full rounded-2xl object-contain bg-black"
                />
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                {post.hashtags.map(item => (
                  <Link
                    key={item}
                    href={`/connect/hashtag/${encodeURIComponent(
                      item
                    )}`}
                    className={
                      item === tag
                        ? "font-black text-cyan-200 underline"
                        : "font-black text-violet-300"
                    }
                  >
                    #{item}
                  </Link>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-4">
                <span className="text-sm text-white/40">
                  LIKE {post.likeCount}
                </span>

                <span className="text-sm text-white/40">
                  COMMENTS {post.commentCount}
                </span>

                <a
                  href={`/connect?post=${encodeURIComponent(
                    post.id
                  )}#post-${encodeURIComponent(
                    post.id
                  )}`}
                  className="rounded-xl bg-white px-4 py-2 font-black text-black"
                >
                  OPEN POST
                </a>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}