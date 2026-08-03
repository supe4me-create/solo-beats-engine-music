import type { MetadataRoute } from "next";

const baseUrl = "https://www.solobeatsenginemusic.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    { path: "", priority: 1, changeFrequency: "daily" as const },
    { path: "/albums", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/store", priority: 0.95, changeFrequency: "daily" as const },
    { path: "/premium", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/premium/library", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/premium/radio", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/premium/tv", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/artist-promotion", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/business-advertising", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/albums/aworldbuiltonsound", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/albums/bass-king", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/albums/black-sea", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/albums/dark-horse", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/albums/invincible", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/albums/night-terror", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/albums/reckoning", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/albums/strange-feeling", priority: 0.85, changeFrequency: "weekly" as const },
    { path: "/albums/zombie-bassline", priority: 0.7, changeFrequency: "weekly" as const },
  ];

  const lastModified = new Date();

  return routes.map((route) => ({
    url: `${baseUrl}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}