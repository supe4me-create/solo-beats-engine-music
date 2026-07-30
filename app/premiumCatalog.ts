import { albums } from "./store/albums";

export const premiumAlbumIds = [
  "reckoning",
  "full-speed",
  "night-terror",
  "reboot",
  "novafx",
] as const;

export const premiumAlbums = premiumAlbumIds
  .map((albumId) =>
    albums.find((album) => album.id === albumId)
  )
  .filter(
    (
      album
    ): album is NonNullable<typeof album> =>
      Boolean(album)
  );

