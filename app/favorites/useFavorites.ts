"use client";

import { useCallback, useEffect, useState } from "react";

const FAVORITES_STORAGE_KEY = "solo-beats-favorites";
const FAVORITES_EVENT = "solo-beats-favorites-changed";

function readFavorites() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const saved = window.localStorage.getItem(FAVORITES_STORAGE_KEY);

    if (!saved) {
      return [];
    }

    const parsed = JSON.parse(saved);

    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function writeFavorites(favorites: string[]) {
  window.localStorage.setItem(
    FAVORITES_STORAGE_KEY,
    JSON.stringify(favorites)
  );

  window.dispatchEvent(new Event(FAVORITES_EVENT));
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    function syncFavorites() {
      setFavorites(readFavorites());
      setLoaded(true);
    }

    syncFavorites();

    window.addEventListener("storage", syncFavorites);
    window.addEventListener(FAVORITES_EVENT, syncFavorites);

    return () => {
      window.removeEventListener("storage", syncFavorites);
      window.removeEventListener(FAVORITES_EVENT, syncFavorites);
    };
  }, []);

  const toggleFavorite = useCallback((albumTitle: string) => {
    const current = readFavorites();

    const next = current.includes(albumTitle)
      ? current.filter((title) => title !== albumTitle)
      : [...current, albumTitle];

    writeFavorites(next);
  }, []);

  const removeFavorite = useCallback((albumTitle: string) => {
    const next = readFavorites().filter((title) => title !== albumTitle);
    writeFavorites(next);
  }, []);

  const clearFavorites = useCallback(() => {
    writeFavorites([]);
  }, []);

  const isFavorite = useCallback(
    (albumTitle: string) => favorites.includes(albumTitle),
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
