import { NextResponse } from "next/server";

import {
  adminDb,
} from "../../../../lib/firebaseAdmin";

export const dynamic = "force-dynamic";

function clean(
  value: unknown,
  max = 5000
) {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
}

function normalize(
  value: unknown
) {
  return clean(
    value,
    5000
  ).toLowerCase();
}

function toIso(
  value: unknown
) {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (
      value as {
        toDate?: unknown;
      }
    ).toDate === "function"
  ) {
    return (
      value as {
        toDate: () => Date;
      }
    )
      .toDate()
      .toISOString();
  }

  return null;
}

function mediaType(
  value: unknown
) {
  const next =
    clean(
      value,
      20
    );

  return [
    "image",
    "audio",
    "video",
  ].includes(next)
    ? next
    : "";
}

function hashtags(
  text: string
) {
  const matches =
    text.match(
      /#[a-zA-Z0-9_]+/g
    ) || [];

  return Array.from(
    new Set(
      matches
        .map(tag =>
          tag
            .slice(1)
            .toLowerCase()
        )
        .filter(Boolean)
    )
  );
}

export async function GET(
  request: Request
) {
  try {
    const url =
      new URL(request.url);

    const query =
      clean(
        url.searchParams.get("q"),
        100
      );

    const requestedTag =
      clean(
        url.searchParams.get("tag"),
        60
      )
        .replace(/^#/, "")
        .toLowerCase();

    const [
      profileSnapshot,
      postSnapshot,
    ] =
      await Promise.all([
        adminDb
          .collection(
            "soloConnectProfiles"
          )
          .limit(250)
          .get(),

        adminDb
          .collection(
            "soloConnectPosts"
          )
          .orderBy(
            "createdAt",
            "desc"
          )
          .limit(250)
          .get(),
      ]);

    const allMembers =
      profileSnapshot.docs
        .map(document => {
          const data =
            document.data() ||
            {};

          return {
            uid:
              document.id,

            username:
              clean(
                data.username,
                24
              ),

            displayName:
              clean(
                data.displayName,
                100
              ),

            bio:
              clean(
                data.bio,
                500
              ),

            photoURL:
              clean(
                data.photoURL,
                4000
              ),

            followerCount:
              Math.max(
                0,
                Number(
                  data.followerCount ||
                    0
                )
              ),

            followingCount:
              Math.max(
                0,
                Number(
                  data.followingCount ||
                    0
                )
              ),

            postCount:
              Math.max(
                0,
                Number(
                  data.postCount ||
                    0
                )
              ),
          };
        })
        .filter(
          member =>
            member.username
        );

    const now =
      Date.now();

    const allPosts =
      postSnapshot.docs
        .map(document => {
          const data =
            document.data() ||
            {};

          const text =
            clean(
              data.text,
              3000
            );

          const promotionActiveUntil =
            toIso(
              data.promotionActiveUntil
            );

          const isPromoted =
            Boolean(
              promotionActiveUntil &&
              new Date(
                promotionActiveUntil
              ).getTime() >
                now
            );

          return {
            id:
              document.id,

            authorUid:
              clean(
                data.authorUid,
                128
              ),

            username:
              clean(
                data.username,
                24
              ),

            displayName:
              clean(
                data.displayName,
                100
              ),

            photoURL:
              clean(
                data.photoURL,
                4000
              ),

            text,

            mediaURL:
              clean(
                data.mediaURL,
                4000
              ),

            mediaType:
              mediaType(
                data.mediaType
              ),

            mediaName:
              clean(
                data.mediaName,
                255
              ),

            likeCount:
              Math.max(
                0,
                Number(
                  data.likeCount ||
                    0
                )
              ),

            commentCount:
              Math.max(
                0,
                Number(
                  data.commentCount ||
                    0
                )
              ),

            createdAt:
              toIso(
                data.createdAt
              ),

            hashtags:
              hashtags(text),

            isPromoted,

            promotionActiveUntil,

            promotionPackageName:
              clean(
                data.promotionPackageName,
                100
              ),
          };
        });

    const hashtagCounts =
      new Map<
        string,
        number
      >();

    for (
      const post
      of allPosts
    ) {
      for (
        const tag
        of post.hashtags
      ) {
        hashtagCounts.set(
          tag,
          (
            hashtagCounts.get(
              tag
            ) ||
            0
          ) + 1
        );
      }
    }

    const trendingHashtags =
      Array.from(
        hashtagCounts.entries()
      )
        .map(
          ([tag, count]) => ({
            tag,
            count,
          })
        )
        .sort(
          (a, b) =>
            b.count -
              a.count ||
            a.tag.localeCompare(
              b.tag
            )
        )
        .slice(
          0,
          20
        );

    let members =
      allMembers;

    let posts =
      allPosts;

    if (query) {
      const search =
        normalize(query);

      members =
        allMembers
          .filter(member =>
            [
              member.username,
              member.displayName,
              member.bio,
            ].some(value =>
              normalize(
                value
              ).includes(
                search
              )
            )
          )
          .sort(
            (a, b) => {
              const aName =
                normalize(
                  a.username
                );

              const bName =
                normalize(
                  b.username
                );

              if (
                aName ===
                  search &&
                bName !==
                  search
              ) {
                return -1;
              }

              if (
                bName ===
                  search &&
                aName !==
                  search
              ) {
                return 1;
              }

              return (
                b.followerCount -
                a.followerCount
              );
            }
          )
          .slice(
            0,
            40
          );

      posts =
        allPosts
          .filter(post =>
            [
              post.username,
              post.displayName,
              post.text,
              post.mediaName,
              post.hashtags.join(
                " "
              ),
            ].some(value =>
              normalize(
                value
              ).includes(
                search
              )
            )
          )
          .slice(
            0,
            60
          );
    }
    else if (
      requestedTag
    ) {
      members = [];

      posts =
        allPosts
          .filter(post =>
            post.hashtags.includes(
              requestedTag
            )
          )
          .slice(
            0,
            100
          );
    }
    else {
      members =
        allMembers
          .sort(
            (a, b) =>
              b.followerCount -
                a.followerCount ||
              b.postCount -
                a.postCount
          )
          .slice(
            0,
            12
          );

      posts =
        [...allPosts]
          .sort(
            (a, b) => {
              if (
                a.isPromoted !==
                b.isPromoted
              ) {
                return a.isPromoted
                  ? -1
                  : 1;
              }

              if (
                a.isPromoted &&
                b.isPromoted
              ) {
                return (
                  new Date(
                    b.promotionActiveUntil ||
                      0
                  ).getTime() -
                  new Date(
                    a.promotionActiveUntil ||
                      0
                  ).getTime()
                );
              }

              return String(
                b.createdAt ||
                  ""
              ).localeCompare(
                String(
                  a.createdAt ||
                    ""
                )
              );
            }
          )
          .slice(
            0,
            30
          );
    }

    return NextResponse.json({
      success:
        true,

      query,

      tag:
        requestedTag,

      members,

      posts,

      trendingHashtags,
    });
  }
  catch (error) {
    console.error(
      "SOLO CONNECT DISCOVERY:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          "SOLO CONNECT discovery could not be loaded.",
      },
      {
        status:
          500,
      }
    );
  }
}