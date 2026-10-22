"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";

type Member = {
  uid: string;
  username: string;
  displayName: string;
  bio: string;
  photoURL: string;
  followerCount: number;
  postCount: number;
};

type Post = {
  id: string;
  username: string;
  displayName: string;
  text: string;
  mediaURL: string;
  mediaType: string;
  likeCount: number;
  commentCount: number;
  hashtags: string[];
  isPromoted: boolean;
  promotionActiveUntil: string | null;
  promotionPackageName: string;
};

type Trend = {
  tag: string;
  count: number;
};

export default function DiscoverPage() {
  const [
    members,
    setMembers,
  ] = useState<Member[]>([]);

  const [
    posts,
    setPosts,
  ] = useState<Post[]>([]);

  const [
    trends,
    setTrends,
  ] = useState<Trend[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response =
          await fetch(
            "/api/connect/discovery",
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
              "Discovery could not load."
          );
        }

        if (cancelled) return;

        setMembers(
          Array.isArray(
            data.members
          )
            ? data.members
            : []
        );

        setPosts(
          Array.isArray(
            data.posts
          )
            ? data.posts
            : []
        );

        setTrends(
          Array.isArray(
            data.trendingHashtags
          )
            ? data.trendingHashtags
            : []
        );
      }
      catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Discovery could not load."
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
  }, []);

  return (
    <main className="min-h-screen px-4 pb-28 pt-12 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-[2rem] border border-violet-400/20 bg-gradient-to-br from-violet-500/20 via-black to-cyan-400/10 p-7 sm:p-10">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">
            SOLO CONNECT
          </p>

          <h1 className="mt-3 text-4xl font-black sm:text-6xl">
            DISCOVER
          </h1>

          <p className="mt-4 max-w-2xl text-white/60">
            Find creators, recent
            community posts and trending
            conversations.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/connect"
              className="rounded-xl bg-white px-5 py-3 font-black text-black"
            >
              CONNECT
            </Link>

            <Link
              href="/connect/search"
              className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-5 py-3 font-black text-cyan-100"
            >
              SEARCH
            </Link>
          </div>
        </section>

        {loading ? (
          <p className="mt-8 text-white/50">
            Loading discovery...
          </p>
        ) : null}

        {error ? (
          <p className="mt-8 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">
            {error}
          </p>
        ) : null}

        {trends.length > 0 ? (
          <section className="mt-10">
            <h2 className="text-3xl font-black">
              TRENDING HASHTAGS
            </h2>

            <div className="mt-5 flex flex-wrap gap-3">
              {trends.map(item => (
                <Link
                  key={item.tag}
                  href={`/connect/hashtag/${encodeURIComponent(
                    item.tag
                  )}`}
                  className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-5 py-3 font-black text-cyan-200"
                >
                  #{item.tag}
                  <span className="ml-2 text-white/40">
                    {item.count}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {members.length > 0 ? (
          <section className="mt-12">
            <h2 className="text-3xl font-black">
              DISCOVER PEOPLE
            </h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {members.map(member => (
                <Link
                  key={member.uid}
                  href={`/connect/profile/${member.username}`}
                  className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 hover:border-violet-300/30"
                >
                  <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 font-black">
                    {member.photoURL ? (
                      <img
                        src={member.photoURL}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      (
                        member.displayName ||
                        member.username ||
                        "SB"
                      )
                        .slice(0, 2)
                        .toUpperCase()
                    )}
                  </div>

                  <p className="mt-4 text-xl font-black">
                    {member.displayName ||
                      member.username}
                  </p>

                  <p className="text-cyan-300">
                    @{member.username}
                  </p>

                  {member.bio ? (
                    <p className="mt-3 line-clamp-3 text-sm text-white/50">
                      {member.bio}
                    </p>
                  ) : null}

                  <p className="mt-4 text-xs text-white/35">
                    {member.followerCount} followers
                    {" • "}
                    {member.postCount} posts
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {posts.length > 0 ? (
          <section className="mt-12">
            <h2 className="text-3xl font-black">
              RECENT POSTS
            </h2>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              {posts.map(post => (
                <article
                  key={post.id}
                  className="rounded-3xl border border-white/10 bg-[#0b0b12] p-5"
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
                    <p className="mt-4 whitespace-pre-wrap text-white/80">
                      {post.text}
                    </p>
                  ) : null}

                  {post.mediaType === "image" &&
                  post.mediaURL ? (
                    <img
                      src={post.mediaURL}
                      alt=""
                      className="mt-4 max-h-72 w-full rounded-2xl object-contain bg-black"
                    />
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {post.hashtags.map(tag => (
                      <Link
                        key={tag}
                        href={`/connect/hashtag/${encodeURIComponent(
                          tag
                        )}`}
                        className="font-black text-cyan-300"
                      >
                        #{tag}
                      </Link>
                    ))}
                  </div>

                  <a
                    href={`/connect?post=${encodeURIComponent(
                      post.id
                    )}#post-${encodeURIComponent(
                      post.id
                    )}`}
                    className="mt-5 inline-flex rounded-xl bg-white px-4 py-2 font-black text-black"
                  >
                    OPEN POST
                  </a>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}