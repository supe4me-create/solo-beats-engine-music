"use client";

import Link from "next/link";
import {
  FormEvent,
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
  followingCount: number;
  postCount: number;
};

type Post = {
  id: string;
  username: string;
  displayName: string;
  photoURL: string;
  text: string;
  mediaURL: string;
  mediaType: string;
  mediaName: string;
  likeCount: number;
  commentCount: number;
  createdAt: string | null;
  hashtags: string[];
};

export default function ConnectSearchPage() {
  const [
    query,
    setQuery,
  ] = useState("");

  const [
    members,
    setMembers,
  ] = useState<Member[]>([]);

  const [
    posts,
    setPosts,
  ] = useState<Post[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    searched,
    setSearched,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  async function search(
    value: string
  ) {
    const next =
      value.trim();

    if (!next) {
      setMembers([]);
      setPosts([]);
      setSearched(false);
      return;
    }

    setQuery(next);
    setLoading(true);
    setError("");

    try {
      const response =
        await fetch(
          `/api/connect/discovery?q=${encodeURIComponent(
            next
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
            "Search failed."
        );
      }

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

      setSearched(true);

      window.history.replaceState(
        {},
        "",
        `/connect/search?q=${encodeURIComponent(
          next
        )}`
      );
    }
    catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Search failed."
      );
    }
    finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const initial =
      params.get("q") || "";

    if (initial) {
      setQuery(initial);
      void search(initial);
    }
  }, []);

  function submit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    void search(query);
  }

  const total =
    members.length +
    posts.length;

  return (
    <main className="min-h-screen px-4 pb-28 pt-12 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <section className="rounded-[2rem] border border-cyan-300/20 bg-gradient-to-br from-cyan-400/10 via-black to-violet-500/15 p-7 sm:p-10">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">
            SOLO CONNECT
          </p>

          <h1 className="mt-3 text-4xl font-black sm:text-6xl">
            SEARCH
          </h1>

          <p className="mt-4 text-white/60">
            Find members, artists,
            DJs, creators and posts.
          </p>

          <form
            onSubmit={submit}
            className="mt-7 flex flex-col gap-3 sm:flex-row"
          >
            <input
              autoFocus
              type="search"
              value={query}
              onChange={event =>
                setQuery(
                  event.target.value
                )
              }
              placeholder="Search people or posts..."
              className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black px-5 py-4 outline-none focus:border-cyan-300"
            />

            <button
              type="submit"
              disabled={
                loading ||
                !query.trim()
              }
              className="rounded-2xl bg-white px-7 py-4 font-black text-black disabled:opacity-40"
            >
              {loading
                ? "SEARCHING..."
                : "SEARCH"}
            </button>
          </form>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/connect"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-black"
            >
              CONNECT
            </Link>

            <Link
              href="/connect/discover"
              className="rounded-xl border border-violet-300/20 bg-violet-300/10 px-4 py-3 font-black text-violet-100"
            >
              DISCOVER
            </Link>
          </div>
        </section>

        {error ? (
          <p className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">
            {error}
          </p>
        ) : null}

        {searched ? (
          <section className="mt-7 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <p className="text-white/45">
                Results
              </p>
              <p className="mt-2 text-3xl font-black">
                {total}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <p className="text-white/45">
                Members
              </p>
              <p className="mt-2 text-3xl font-black">
                {members.length}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <p className="text-white/45">
                Posts
              </p>
              <p className="mt-2 text-3xl font-black">
                {posts.length}
              </p>
            </div>
          </section>
        ) : null}

        {members.length > 0 ? (
          <section className="mt-10">
            <h2 className="text-3xl font-black">
              PEOPLE
            </h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {members.map(member => (
                <Link
                  key={member.uid}
                  href={`/connect/profile/${member.username}`}
                  className="flex gap-4 rounded-3xl border border-white/10 bg-white/[0.035] p-5 hover:border-cyan-300/30"
                >
                  <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 font-black">
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

                  <div className="min-w-0">
                    <p className="truncate text-lg font-black">
                      {member.displayName ||
                        member.username}
                    </p>

                    <p className="text-sm text-cyan-300">
                      @{member.username}
                    </p>

                    {member.bio ? (
                      <p className="mt-2 line-clamp-2 text-sm text-white/50">
                        {member.bio}
                      </p>
                    ) : null}

                    <p className="mt-2 text-xs text-white/35">
                      {member.followerCount} followers
                      {" • "}
                      {member.postCount} posts
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {posts.length > 0 ? (
          <section className="mt-10">
            <h2 className="text-3xl font-black">
              POSTS
            </h2>

            <div className="mt-5 space-y-4">
              {posts.map(post => (
                <article
                  key={post.id}
                  className="rounded-3xl border border-white/10 bg-[#0b0b12] p-5"
                >
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/connect/profile/${post.username}`}
                      className="font-black"
                    >
                      {post.displayName ||
                        post.username}
                    </Link>

                    <span className="text-sm text-white/40">
                      @{post.username}
                    </span>
                  </div>

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
                        className="text-sm font-black text-cyan-300"
                      >
                        #{tag}
                      </Link>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-4">
                    <span className="text-xs text-white/40">
                      LIKE {post.likeCount}
                    </span>

                    <span className="text-xs text-white/40">
                      COMMENTS {post.commentCount}
                    </span>

                    <a
                      href={`/connect?post=${encodeURIComponent(
                        post.id
                      )}#post-${encodeURIComponent(
                        post.id
                      )}`}
                      className="rounded-xl bg-white px-4 py-2 text-sm font-black text-black"
                    >
                      OPEN POST
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {searched &&
        total === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-white/15 p-10 text-center text-white/50">
            No SOLO CONNECT results found.
          </div>
        ) : null}
      </div>
    </main>
  );
}