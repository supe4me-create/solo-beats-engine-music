import { NextResponse } from "next/server";

import {
  adminDb,
} from "../../../../lib/firebaseAdmin";

export const dynamic = "force-dynamic";

function clean(
  value: unknown,
  max = 3000
) {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
}

function normalize(value: unknown) {
  return clean(value, 5000).toLowerCase();
}

function toIso(value: unknown) {
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

function mediaType(value: unknown) {
  const type = clean(value, 20);

  return [
    "image",
    "audio",
    "video",
  ].includes(type)
    ? type
    : "";
}

export async function GET(
  request: Request
) {
  try {
    const url = new URL(request.url);

    const query = clean(
      url.searchParams.get("q"),
      100
    );

    const search =
      normalize(query);

    if (!search) {
      return NextResponse.json({
        success: true,
        query: "",
        members: [],
        posts: [],
      });
    }

    const [
      profileSnapshot,
      postSnapshot,
    ] = await Promise.all([
      adminDb
        .collection(
          "soloConnectProfiles"
        )
        .limit(150)
        .get(),

      adminDb
        .collection(
          "soloConnectPosts"
        )
        .orderBy(
          "createdAt",
          "desc"
        )
        .limit(150)
        .get(),
    ]);

    const members =
      profileSnapshot.docs
        .map(document => {
          const data =
            document.data() || {};

          return {
            uid: document.id,
            username: clean(
              data.username,
              24
            ),
            displayName: clean(
              data.displayName,
              100
            ),
            bio: clean(
              data.bio,
              500
            ),
            photoURL: clean(
              data.photoURL,
              4000
            ),
            followerCount:
              Math.max(
                0,
                Number(
                  data.followerCount || 0
                )
              ),
            postCount:
              Math.max(
                0,
                Number(
                  data.postCount || 0
                )
              ),
          };
        })
        .filter(member =>
          [
            member.username,
            member.displayName,
            member.bio,
          ].some(value =>
            normalize(value)
              .includes(search)
          )
        )
        .sort((a, b) => {
          const aUsername =
            normalize(a.username);

          const bUsername =
            normalize(b.username);

          if (
            aUsername === search &&
            bUsername !== search
          ) {
            return -1;
          }

          if (
            bUsername === search &&
            aUsername !== search
          ) {
            return 1;
          }

          if (
            aUsername.startsWith(
              search
            ) &&
            !bUsername.startsWith(
              search
            )
          ) {
            return -1;
          }

          if (
            bUsername.startsWith(
              search
            ) &&
            !aUsername.startsWith(
              search
            )
          ) {
            return 1;
          }

          return aUsername.localeCompare(
            bUsername
          );
        })
        .slice(0, 30);

    const posts =
      postSnapshot.docs
        .map(document => {
          const data =
            document.data() || {};

          return {
            id: document.id,
            authorUid: clean(
              data.authorUid,
              128
            ),
            username: clean(
              data.username,
              24
            ),
            displayName: clean(
              data.displayName,
              100
            ),
            photoURL: clean(
              data.photoURL,
              4000
            ),
            text: clean(
              data.text,
              3000
            ),
            mediaURL: clean(
              data.mediaURL,
              4000
            ),
            mediaType:
              mediaType(
                data.mediaType
              ),
            mediaName: clean(
              data.mediaName,
              255
            ),
            likeCount:
              Math.max(
                0,
                Number(
                  data.likeCount || 0
                )
              ),
            commentCount:
              Math.max(
                0,
                Number(
                  data.commentCount || 0
                )
              ),
            createdAt:
              toIso(
                data.createdAt
              ),
          };
        })
        .filter(post =>
          [
            post.username,
            post.displayName,
            post.text,
            post.mediaName,
          ].some(value =>
            normalize(value)
              .includes(search)
          )
        )
        .slice(0, 50);

    return NextResponse.json({
      success: true,
      query,
      members,
      posts,
    });
  } catch (error) {
    console.error(
      "SOLO CONNECT SEARCH:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "SOLO CONNECT search could not be completed.",
      },
      {
        status: 500,
      }
    );
  }
}