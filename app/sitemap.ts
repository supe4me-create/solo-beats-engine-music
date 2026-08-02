import type { MetadataRoute } from "next";

const baseUrl = "https://www.solobeatsenginemusic.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/albums",
    "/store",
    "/premium",
    "/premium/library",
    "/premium/radio",
    "/premium/tv",
    "/favorites",
    "/artist-promotion",
    "/business-advertising",
    "/search",
    "/albums/aworldbuiltonsound",
    "/albums/bass-king",
    "/albums/black-sea",
    "/albums/dark-horse",
    "/albums/invincible",
    "/albums/night-terror",
    "/albums/reckoning",
    "/albums/strange-feeling",
    "/albums/zombie-bassline",
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency:
      route === "" || route === "/store"
        ? "daily"
        : "weekly",
    priority:
      route === ""
        ? 1
        : route === "/store" ||
            route === "/premium" ||
            route === "/albums"
          ? 0.9
          : 0.7,
  }));
}
