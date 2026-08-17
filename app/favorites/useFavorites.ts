"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

const FAVORITES_STORAGE_KEY =
  "solo-beats-favorites";

const FAVORITES_EVENT =
  "solo-beats-favorites-changed";

function normalizeFavoriteTitle(
  value: string
) {
  return value.trim().toLowerCase();
}

function cleanFavorites(
  values: unknown[]
) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const title = value.trim();

    if (!title) {
      continue;
    }

    const key =
      normalizeFavoriteTitle(title);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(title);
  }

  return result;
}

function readFavorites() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const saved =
      window.localStorage.getItem(
        FAVORITES_STORAGE_KEY
      );

    if (!saved) {
      return [];
    }

    const parsed = JSON.parse(saved);

    return Array.isArray(parsed)
      ? cleanFavorites(parsed)
      : [];
  } catch {
    return [];
  }
}

function writeFavorites(
  favorites: string[]
) {
  const cleaned =
    cleanFavorites(favorites);

  window.localStorage.setItem(
    FAVORITES_STORAGE_KEY,
    JSON.stringify(cleaned)
  );

  window.dispatchEvent(
    new Event(FAVORITES_EVENT)
  );
}

export function useFavorites() {
  const [favorites, setFavorites] =
    useState<string[]>([]);

  const [loaded, setLoaded] =
    useState(false);

  useEffect(() => {
    function syncFavorites() {
      const next =
        readFavorites();

      setFavorites(next);
      setLoaded(true);
    }

    syncFavorites();

    window.addEventListener(
      "storage",
      syncFavorites
    );

    window.addEventListener(
      FAVORITES_EVENT,
      syncFavorites
    );

    return () => {
      window.removeEventListener(
        "storage",
        syncFavorites
      );

      window.removeEventListener(
        FAVORITES_EVENT,
        syncFavorites
      );
    };
  }, []);

  const toggleFavorite =
    useCallback(
      (albumTitle: string) => {
        const title =
          albumTitle.trim();

        if (!title) {
          return;
        }

        const key =
          normalizeFavoriteTitle(
            title
          );

        const current =
          readFavorites();

        const exists =
          current.some(
            (savedTitle) =>
              normalizeFavoriteTitle(
                savedTitle
              ) === key
          );

        const next = exists
          ? current.filter(
              (savedTitle) =>
                normalizeFavoriteTitle(
                  savedTitle
                ) !== key
            )
          : [...current, title];

        writeFavorites(next);
      },
      []
    );

  const removeFavorite =
    useCallback(
      (albumTitle: string) => {
        const key =
          normalizeFavoriteTitle(
            albumTitle
          );

        const next =
          readFavorites().filter(
            (savedTitle) =>
              normalizeFavoriteTitle(
                savedTitle
              ) !== key
          );

        writeFavorites(next);
      },
      []
    );

  const clearFavorites =
    useCallback(() => {
      writeFavorites([]);
    }, []);

  const isFavorite =
    useCallback(
      (albumTitle: string) => {
        const key =
          normalizeFavoriteTitle(
            albumTitle
          );

        return favorites.some(
          (savedTitle) =>
            normalizeFavoriteTitle(
              savedTitle
            ) === key
        );
      },
      [favorites]
    );

  return {
    favorites,
    loaded,
    count: favorites.length,
    isFavorite,
    toggleFavorite,
    removeFavorite,
    clearFavorites,
  };
}
