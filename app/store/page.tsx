"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  PayPalButtons,
  PayPalScriptProvider,
} from "@paypal/react-paypal-js";
import { albums } from "./albums";
import { firebaseAuth } from "../../lib/firebaseClient";
import { useFavorites } from "../favorites/useFavorites";
import { usePlayer } from "../player/usePlayer";
import type { PlayerTrack } from "../player/types";

type CartItem = {
  id: string;
  type: "album" | "track";
  title: string;
  albumTitle: string;
  price: number;
  cover: string;
};

type DownloadAccess = {
  itemId: string;
  itemType: "album" | "track";
  title: string;
  fileName: string;
  downloadUrl: string;
  expiresAt: string;
};

type PayPalPurchasedItem = {
  name?: string;
  itemType?: "album" | "track" | null;
  itemId?: string | null;
};

type SavedPurchase = {
  orderId: string;
  captureId: string;
  purchasedItems: CartItem[];
};


type PromotedCampaign = {
  submissionId: string;
  artistName: string;
  songTitle: string;
  genre: string;
  description: string;
  socialLink: string | null;
  youtubeLink: string | null;
  artworkUrl: string | null;
  songUrl: string | null;
  sponsoredLabel: string;
  scheduleStartDate: string;
  scheduleEndDate: string;
};


type SponsoredBusinessCampaign = {
  submissionId: string;
  businessName: string;
  campaignName: string;
  campaignGoal: string;
  headline: string;
  description: string;
  callToAction: string;
  businessWebsite: string | null;
  youtubeLink: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  sponsoredLabel: string;
  scheduleStartDate: string | null;
  scheduleEndDate: string | null;
};

function getPromotionYouTubeEmbedUrl(
  value: string | null
): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    let videoId = "";

    if (url.hostname === "youtu.be") {
      videoId =
        url.pathname
          .replace(/^\//, "")
          .split("/")[0] || "";
    } else {
      videoId =
        url.searchParams.get("v") ||
        url.pathname
          .split("/")
          .filter(Boolean)
          .pop() ||
        "";
    }

    if (!videoId) return null;

    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(
      videoId
    )}`;
  } catch {
    return null;
  }
}

function PromotedPlacement({
  title,
  campaigns,
}: {
  title: string;
  campaigns: PromotedCampaign[];
}) {
  if (campaigns.length === 0) {
    return null;
  }

  return (
    <section className="mt-8 overflow-hidden rounded-[2rem] border border-fuchsia-300/20 bg-gradient-to-br from-fuchsia-700/20 via-black/40 to-cyan-500/10 p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-fuchsia-300">
            Promoted Music
          </p>
          <h2 className="mt-2 text-3xl font-black">
            {title}
          </h2>
        </div>

        <Link
          href="/artist-promotion"
          className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 font-black"
        >
          Promote Your Music
        </Link>
      </div>

      <div className="mt-6 grid gap-6">
        {campaigns.map((campaign) => {
          const embedUrl =
            getPromotionYouTubeEmbedUrl(
              campaign.youtubeLink
            );

          return (
            <article
              key={campaign.submissionId}
              className="grid gap-6 rounded-2xl border border-white/10 bg-black/30 p-5 lg:grid-cols-[220px_minmax(0,1fr)]"
            >
              {campaign.artworkUrl ? (
                <img
                  src={campaign.artworkUrl}
                  alt={`${campaign.songTitle} artwork`}
                  className="aspect-square w-full rounded-2xl object-cover"
                />
              ) : (
                <div className="grid aspect-square place-items-center rounded-2xl border border-white/10 bg-black/30 text-white/35">
                  Artwork unavailable
                </div>
              )}

              <div className="min-w-0">
                <span className="inline-flex rounded-full border border-fuchsia-300/25 bg-fuchsia-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-fuchsia-200">
                  {campaign.sponsoredLabel || "Promoted"}
                </span>

                <p className="mt-4 text-sm font-black uppercase tracking-[0.16em] text-cyan-300">
                  {campaign.artistName}
                </p>

                <h3 className="mt-2 text-3xl font-black">
                  {campaign.songTitle}
                </h3>

                <p className="mt-2 text-white/45">
                  {campaign.genre}
                </p>

                <p className="mt-4 max-w-3xl leading-7 text-white/60">
                  {campaign.description}
                </p>

                {embedUrl ? (
                  <div className="mt-5 aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
                    <iframe
                      src={embedUrl}
                      title={`${campaign.songTitle} promotional video`}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                ) : campaign.songUrl ? (
                  <audio
                    controls
                    preload="metadata"
                    src={campaign.songUrl}
                    className="mt-5 w-full"
                  />
                ) : null}

                {campaign.socialLink ? (
                  <a
                    href={campaign.socialLink}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 inline-flex rounded-xl bg-white px-5 py-3 font-black text-black"
                  >
                    Visit Artist
                  </a>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}



function SponsoredBusinessPlacement({
  title,
  campaigns,
}: {
  title: string;
  campaigns: SponsoredBusinessCampaign[];
}) {
  if (campaigns.length === 0) {
    return null;
  }

  return (
    <section className="mt-8 overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-gradient-to-br from-cyan-700/20 via-black/40 to-violet-500/10 p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">
            Sponsored Business
          </p>

          <h2 className="mt-2 text-3xl font-black">
            {title}
          </h2>
        </div>

        <Link
          href="/business-advertising"
          className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 font-black"
        >
          Advertise Your Business
        </Link>
      </div>

      <div className="mt-6 grid gap-6">
        {campaigns.map((campaign) => {
          const embedUrl =
            getPromotionYouTubeEmbedUrl(
              campaign.youtubeLink
            );

          return (
            <article
              key={campaign.submissionId}
              className="grid gap-6 rounded-2xl border border-white/10 bg-black/30 p-5 lg:grid-cols-[260px_minmax(0,1fr)]"
            >
              {campaign.imageUrl ? (
                <img
                  src={campaign.imageUrl}
                  alt={`${campaign.campaignName} advertisement`}
                  className="aspect-square w-full rounded-2xl object-cover"
                />
              ) : (
                <div className="grid aspect-square place-items-center rounded-2xl border border-white/10 bg-black/30 text-center text-white/35">
                  Sponsored creative
                </div>
              )}

              <div className="min-w-0">
                <span className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-cyan-100">
                  {campaign.sponsoredLabel || "Sponsored"}
                </span>

                <p className="mt-4 text-sm font-black uppercase tracking-[0.16em] text-emerald-300">
                  {campaign.businessName}
                </p>

                <h3 className="mt-2 text-3xl font-black">
                  {campaign.headline}
                </h3>

                <p className="mt-2 text-white/45">
                  {campaign.campaignName}
                </p>

                <p className="mt-4 max-w-3xl leading-7 text-white/60">
                  {campaign.description}
                </p>

                {embedUrl ? (
                  <div className="mt-5 aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
                    <iframe
                      src={embedUrl}
                      title={`${campaign.campaignName} sponsored video`}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                ) : campaign.videoUrl ? (
                  <video
                    controls
                    preload="metadata"
                    src={campaign.videoUrl}
                    className="mt-5 aspect-video w-full rounded-2xl bg-black"
                  />
                ) : null}

                <div className="mt-5 flex flex-wrap gap-3">
                  {campaign.businessWebsite ? (
                    <a
                      href={campaign.businessWebsite}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-xl bg-white px-5 py-3 font-black text-black"
                    >
                      {campaign.callToAction || "Learn More"}
                    </a>
                  ) : null}

                  <Link
                    href="/business-advertising"
                    className="inline-flex rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-black"
                  >
                    Get Sponsored
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

const CART_STORAGE_KEY = "solo-beats-store-cart";
const PURCHASE_STORAGE_KEY =
  "solo-beats-last-completed-purchase";

const paypalClientId = (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "").replace(/\s+/g, "");

async function getAccountAuthorizationHeaders(): Promise<
  Record<string, string>
> {
  const currentUser = firebaseAuth.currentUser;

  if (!currentUser) {
    return {};
  }

  const idToken = await currentUser.getIdToken();

  return {
    Authorization: `Bearer ${idToken}`,
  };
}

export default function StorePage() {
  const { isFavorite, toggleFavorite } = useFavorites();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [openAlbumId, setOpenAlbumId] = useState<
    string | null
  >(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutMessage, setCheckoutMessage] =
    useState("");
  const [checkoutError, setCheckoutError] =
    useState("");
  const [paymentComplete, setPaymentComplete] =
    useState(false);
  const [downloads, setDownloads] = useState<
    DownloadAccess[]
  >([]);
  const [savedPurchase, setSavedPurchase] =
    useState<SavedPurchase | null>(null);
  const [restoreOrderId, setRestoreOrderId] =
    useState("");
  const [restoringPurchase, setRestoringPurchase] =
    useState(false);
  const [generatingDownloads, setGeneratingDownloads] =
    useState(false);
  const [promotedCampaigns, setPromotedCampaigns] =
    useState<PromotedCampaign[]>([]);
  const [businessCampaigns, setBusinessCampaigns] =
    useState<SponsoredBusinessCampaign[]>([]);

  const {
    currentTrack,
    queue: playerQueue,
    currentIndex: currentTrackIndex,
    isPlaying,
    playQueue,
    togglePlay,
  } = usePlayer();

  useEffect(() => {
    let cancelled = false;

    async function loadPromotedCampaigns() {
      try {
        const response = await fetch(
          "/api/promotions/active?placement=store",
          {
            cache: "no-store",
          }
        );

        const contentType =
          response.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) {
          throw new Error(
            "The promoted-music service returned an invalid response."
          );
        }

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.error ||
              "Promoted music could not be loaded."
          );
        }

        if (!cancelled) {
          setPromotedCampaigns(
            Array.isArray(data.promotions)
              ? data.promotions
              : []
          );
        }
      } catch (error) {
        console.error(
          "Featured in the Store promotions could not be loaded:",
          error
        );
      }
    }

    void loadPromotedCampaigns();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSponsoredBusinessCampaigns() {
      try {
        const response = await fetch(
          "/api/business-advertising/active?placement=store",
          {
            cache: "no-store",
          }
        );

        const contentType =
          response.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) {
          throw new Error(
            "The business advertising service returned an invalid response."
          );
        }

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.error ||
              "Sponsored business campaigns could not be loaded."
          );
        }

        if (!cancelled) {
          setBusinessCampaigns(
            Array.isArray(data.campaigns)
              ? data.campaigns
              : []
          );
        }
      } catch (error) {
        console.error(
          "Sponsored Store campaigns could not be loaded:",
          error
        );
      }
    }

    void loadSponsoredBusinessCampaigns();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      const savedCart =
        localStorage.getItem(CART_STORAGE_KEY);

      if (savedCart) {
        const parsedCart = JSON.parse(savedCart);

        if (Array.isArray(parsedCart)) {
          setCart(parsedCart);
        }
      }

      const storedPurchase =
        localStorage.getItem(PURCHASE_STORAGE_KEY);

      if (storedPurchase) {
        const parsedPurchase = JSON.parse(
          storedPurchase
        ) as SavedPurchase;

        if (
          parsedPurchase &&
          typeof parsedPurchase.orderId === "string" &&
          typeof parsedPurchase.captureId === "string" &&
          Array.isArray(parsedPurchase.purchasedItems)
        ) {
          setSavedPurchase(parsedPurchase);
          setRestoreOrderId(parsedPurchase.orderId);
        }
      }
    } catch (error) {
      console.error(
        "Could not load saved store information:",
        error
      );
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify(cart)
      );
    } catch (error) {
      console.error("Could not save cart:", error);
    }
  }, [cart]);

  const filteredAlbums = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return albums;
    }

    return albums.filter((album) => {
      const albumMatches =
        album.title.toLowerCase().includes(query) ||
        album.artist.toLowerCase().includes(query) ||
        album.genre.toLowerCase().includes(query);

      const trackMatches = album.tracks.some((track) =>
        track.title.toLowerCase().includes(query)
      );

      return albumMatches || trackMatches;
    });
  }, [search]);

  const cartTotal = useMemo(
    () =>
      cart.reduce(
        (total, item) => total + item.price,
        0
      ),
    [cart]
  );

  function createAlbumQueue(
    albumId: string
  ): PlayerTrack[] {
    const album = albums.find(
      (item) => item.id === albumId
    );

    if (!album) {
      return [];
    }

    return album.tracks
      .filter((track) => Boolean(track.preview))
      .map((track) => ({
        id: track.id,
        title: track.title,
        artist: album.artist,
        albumTitle: album.title,
        cover: album.cover,
        audio: track.preview,
        trackNumber: track.number,
      }));
  }

  function playAlbum(
    albumId: string,
    startTrackId?: string
  ) {
    const nextQueue = createAlbumQueue(albumId);

    if (nextQueue.length === 0) {
      return;
    }

    const requestedIndex = startTrackId
      ? nextQueue.findIndex(
          (track) => track.id === startTrackId
        )
      : 0;

    playQueue(
      nextQueue,
      requestedIndex >= 0 ? requestedIndex : 0
    );
  }

  function playTrack(
    albumId: string,
    trackId: string
  ) {
    const nextQueue = createAlbumQueue(albumId);
    const trackIndex = nextQueue.findIndex(
      (track) => track.id === trackId
    );

    if (trackIndex === -1) {
      return;
    }

    if (currentTrack?.id === trackId) {
      togglePlay();
      return;
    }

    playQueue(nextQueue, trackIndex);
  }

  function saveCompletedPurchase(
    purchase: SavedPurchase
  ) {
    setSavedPurchase(purchase);
    setRestoreOrderId(purchase.orderId);

    try {
      localStorage.setItem(
        PURCHASE_STORAGE_KEY,
        JSON.stringify(purchase)
      );
    } catch (error) {
      console.error(
        "Could not save completed purchase:",
        error
      );
    }
  }

  function resetCheckoutStatus() {
    setPaymentComplete(false);
    setCheckoutMessage("");
    setCheckoutError("");
    setDownloads([]);
  }

  function addAlbumToCart(albumId: string) {
    const album = albums.find((item) => item.id === albumId);

    if (!album || album.status !== "released") {
      return;
    }

    const cartId = `album-${album.id}`;

    resetCheckoutStatus();
    setCheckoutMessage(`${album.title} was added to your cart.`);
    setCartOpen(true);

    setCart((currentCart) => {
      const alreadyAdded = currentCart.some(
        (item) => item.id === cartId
      );

      if (alreadyAdded) {
        return currentCart;
      }

      return [
        ...currentCart,
        {
          id: cartId,
          type: "album",
          title: `${album.title} - Full Album`,
          albumTitle: album.title,
          price: album.albumPrice,
          cover: album.cover,
        },
      ];
    });
  }

  function addTrackToCart(
    albumId: string,
    trackId: string
  ) {
    const album = albums.find(
      (item) => item.id === albumId
    );

    if (
      !album ||
      album.status !== "released"
    ) {
      return;
    }

    const track = album.tracks.find(
      (item) => item.id === trackId
    );

    if (!track) {
      return;
    }

    const cartId = `track-${track.id}`;

    const alreadyAdded = cart.some(
      (item) => item.id === cartId
    );

    if (alreadyAdded) {
      setCartOpen(true);
      return;
    }

    resetCheckoutStatus();

    setCart((currentCart) => [
      ...currentCart,
      {
        id: cartId,
        type: "track",
        title: track.title,
        albumTitle: album.title,
        price: track.price,
        cover: album.cover,
      },
    ]);

    setCartOpen(true);
  }

  function removeFromCart(itemId: string) {
    setCheckoutMessage("");
    setCheckoutError("");
    setDownloads([]);

    setCart((currentCart) =>
      currentCart.filter(
        (item) => item.id !== itemId
      )
    );
  }

  function clearCart() {
    setCart([]);
    resetCheckoutStatus();

    try {
      localStorage.removeItem(CART_STORAGE_KEY);
    } catch (error) {
      console.error(
        "Could not clear saved cart:",
        error
      );
    }
  }

  function findCartItemFromPurchase(
    purchasedItem: PayPalPurchasedItem
  ): CartItem | null {
    if (
      !purchasedItem.itemId ||
      !purchasedItem.itemType
    ) {
      return null;
    }

    if (purchasedItem.itemType === "album") {
      const album = albums.find(
        (item) =>
          item.id === purchasedItem.itemId
      );

      if (!album) {
        return null;
      }

      return {
        id: `album-${album.id}`,
        type: "album",
        title: `${album.title} - Full Album`,
        albumTitle: album.title,
        price: album.albumPrice,
        cover: album.cover,
      };
    }

    for (const album of albums) {
      const track = album.tracks.find(
        (item) =>
          item.id === purchasedItem.itemId
      );

      if (track) {
        return {
          id: `track-${track.id}`,
          type: "track",
          title: track.title,
          albumTitle: album.title,
          price: track.price,
          cover: album.cover,
        };
      }
    }

    return null;
  }

  async function createPayPalOrder() {
    if (cart.length === 0) {
      const message =
        "Your shopping cart is empty.";

      setCheckoutError(message);
      throw new Error(message);
    }

    setCheckoutMessage(
      "Creating your secure PayPal order..."
    );
    setCheckoutError("");
    setDownloads([]);

    const response = await fetch(
      "/api/paypal/create-order",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: cart.map((item) => ({
            id: item.id,
            type: item.type,
          })),
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || !data.orderId) {
      const message =
        data.error ||
        "PayPal could not create your order. Please try again.";

      setCheckoutMessage("");
      setCheckoutError(message);
      throw new Error(message);
    }

    setCheckoutMessage("");

    return data.orderId as string;
  }

  async function requestDownload(
    orderId: string,
    captureId: string,
    cartItem: CartItem
  ): Promise<DownloadAccess> {
    const itemId =
      cartItem.type === "album"
        ? cartItem.id.replace(/^album-/, "")
        : cartItem.id.replace(/^track-/, "");

    const response = await fetch("/api/download", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderId,
        captureId,
        itemId,
      }),
    });

    const data = await response.json();

    if (
      !response.ok ||
      !data.success ||
      !data.downloadUrl
    ) {
      throw new Error(
        data.error ||
          `Download access could not be generated for ${cartItem.title}.`
      );
    }

    return {
      itemId,
      itemType: cartItem.type,
      title:
        data.title ||
        (cartItem.type === "album"
          ? cartItem.albumTitle
          : cartItem.title),
      fileName: data.fileName,
      downloadUrl: data.downloadUrl,
      expiresAt: data.expiresAt,
    };
  }
    async function generateDownloadLinks(
    purchase: SavedPurchase
  ) {
    if (purchase.purchasedItems.length === 0) {
      setCheckoutError(
        "No purchased music items were found for this order."
      );
      return;
    }

    setGeneratingDownloads(true);
    setCheckoutError("");
    setCheckoutMessage(
      "Generating fresh secure download links..."
    );
    setDownloads([]);

    const generatedDownloads: DownloadAccess[] = [];
    const downloadErrors: string[] = [];

    try {
      for (const purchasedItem of purchase.purchasedItems) {
        try {
          const download = await requestDownload(
            purchase.orderId,
            purchase.captureId,
            purchasedItem
          );

          generatedDownloads.push(download);
        } catch (error) {
          downloadErrors.push(
            error instanceof Error
              ? error.message
              : `Download access failed for ${purchasedItem.title}.`
          );
        }
      }

      setDownloads(generatedDownloads);
      setPaymentComplete(true);
      setCartOpen(true);

      if (generatedDownloads.length === 1) {
        setCheckoutMessage(
          `Purchase restored successfully. Order ${purchase.orderId} is completed. Your fresh secure download link is ready below and expires after 60 minutes.`
        );
      } else if (generatedDownloads.length > 1) {
        setCheckoutMessage(
          `Purchase restored successfully. Order ${purchase.orderId} is completed. Your ${generatedDownloads.length} fresh secure download links are ready below and expire after 60 minutes.`
        );
      } else {
        setCheckoutMessage(
          `Order ${purchase.orderId} was found, but no download links could be generated.`
        );
      }

      if (downloadErrors.length > 0) {
        setCheckoutError(
          `There was a delivery problem: ${downloadErrors.join(
            " "
          )}`
        );
      }
    } finally {
      setGeneratingDownloads(false);
    }
  }

  async function restorePurchaseByOrderId() {
    const cleanOrderId = restoreOrderId.trim();

    if (!cleanOrderId) {
      setCheckoutError(
        "Enter your completed PayPal order ID."
      );
      return;
    }

    setRestoringPurchase(true);
    setCheckoutError("");
    setCheckoutMessage(
      "Checking your completed PayPal purchase..."
    );
    setDownloads([]);

    try {
      const accountHeaders =
        await getAccountAuthorizationHeaders();

      const response = await fetch(
        "/api/paypal/capture-order",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...accountHeaders,
          },
          body: JSON.stringify({
            orderId: cleanOrderId,
          }),
        }
      );

      const data = await response.json();

      if (
        !response.ok ||
        !data.success ||
        !data.captureId
      ) {
        throw new Error(
          data.error ||
            "The completed purchase could not be restored."
        );
      }

      const purchasedItems = Array.isArray(data.items)
        ? data.items
            .map((item: PayPalPurchasedItem) =>
              findCartItemFromPurchase(item)
            )
            .filter(
              (
                item: CartItem | null
              ): item is CartItem => item !== null
            )
        : [];

      if (purchasedItems.length === 0) {
        throw new Error(
          "The purchase was found, but its music items could not be matched to the current store catalog."
        );
      }

      const restoredPurchase: SavedPurchase = {
        orderId: data.orderId,
        captureId: data.captureId,
        purchasedItems,
      };

      saveCompletedPurchase(restoredPurchase);
      await generateDownloadLinks(restoredPurchase);
    } catch (error) {
      setCheckoutMessage("");

      setCheckoutError(
        error instanceof Error
          ? error.message
          : "The completed purchase could not be restored."
      );
    } finally {
      setRestoringPurchase(false);
    }
  }

  async function capturePayPalOrder(
    orderId: string
  ) {
    setCheckoutMessage(
      "Confirming your payment..."
    );
    setCheckoutError("");
    setDownloads([]);

    const purchasedCart = [...cart];

    const accountHeaders =
      await getAccountAuthorizationHeaders();

    const response = await fetch(
      "/api/paypal/capture-order",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...accountHeaders,
        },
        body: JSON.stringify({
          orderId,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      const message =
        data.error ||
        "Your payment could not be confirmed. Please contact support.";

      setCheckoutMessage("");
      setCheckoutError(message);
      throw new Error(message);
    }

    const confirmedOrderId =
      data.orderId as string;

    const captureId =
      data.captureId as string | null;

    const generatedDownloads: DownloadAccess[] = [];
    const downloadErrors: string[] = [];

    if (captureId) {
      const completedPurchase: SavedPurchase = {
        orderId: confirmedOrderId,
        captureId,
        purchasedItems: purchasedCart,
      };

      saveCompletedPurchase(completedPurchase);

      for (const purchasedItem of purchasedCart) {
        try {
          const download = await requestDownload(
            confirmedOrderId,
            captureId,
            purchasedItem
          );

          generatedDownloads.push(download);
        } catch (error) {
          downloadErrors.push(
            error instanceof Error
              ? error.message
              : `Download access failed for ${purchasedItem.title}.`
          );
        }
      }
    } else if (purchasedCart.length > 0) {
      downloadErrors.push(
        "PayPal confirmed the payment, but the payment capture ID was not returned."
      );
    }

    setDownloads(generatedDownloads);
    setPaymentComplete(true);

    let successMessage =
      `Payment successful! Order ${confirmedOrderId} has been completed.`;

    if (data.accountLinked) {
      successMessage +=
        " This purchase has also been added to your My Music account.";
    }

    if (generatedDownloads.length === 1) {
      successMessage +=
        " Your secure music download is ready below. The link expires after 60 minutes.";
    }

    if (generatedDownloads.length > 1) {
      successMessage +=
        ` Your ${generatedDownloads.length} secure music downloads are ready below. The links expire after 60 minutes.`;
    }

    if (
      generatedDownloads.length === 0 &&
      downloadErrors.length === 0
    ) {
      successMessage +=
        " Your payment was confirmed.";
    }

    setCheckoutMessage(successMessage);

    if (downloadErrors.length > 0) {
      setCheckoutError(
        `Your payment was successful, but there was a delivery problem: ${downloadErrors.join(
          " "
        )}`
      );
    }

    setCart([]);

    try {
      localStorage.removeItem(CART_STORAGE_KEY);
    } catch (error) {
      console.error(
        "Could not clear saved cart:",
        error
      );
    }
  }

  return (
    <main className="store-page">
<section className="hero">
        <p className="eyebrow">
          OFFICIAL DIGITAL MUSIC STORE
        </p>

        <h1>
          Buy music directly from Solo Beats
        </h1>

        <p className="hero-description">
          Preview albums and tracks, add music to one
          universal cart and complete your entire
          purchase with one secure PayPal checkout.
        </p>

        <div className="search-wrapper">
          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search albums, genres or tracks..."
            aria-label="Search the music store"
          />
        </div>

        <div className="restore-purchase-card">
          <h2>Already purchased?</h2>

          <p>
            Enter your PayPal order ID to generate a
            fresh secure download link without paying
            again.
          </p>

          <div className="restore-purchase-row">
            <input
              type="text"
              value={restoreOrderId}
              onChange={(event) =>
                setRestoreOrderId(
                  event.target.value
                )
              }
              placeholder="Enter PayPal order ID"
              aria-label="PayPal order ID"
            />

            <button
              type="button"
              className="primary-button"
              disabled={restoringPurchase}
              onClick={restorePurchaseByOrderId}
            >
              {restoringPurchase
                ? "Restoring..."
                : "Restore Purchase"}
            </button>
          </div>

          {savedPurchase && (
            <button
              type="button"
              className="secondary-button saved-download-button"
              disabled={generatingDownloads}
              onClick={() =>
                generateDownloadLinks(
                  savedPurchase
                )
              }
            >
              {generatingDownloads
                ? "Generating Links..."
                : "Generate New Download Links"}
            </button>
          )}

          {checkoutError && !cartOpen && (
            <p className="checkout-error">
              {checkoutError}
            </p>
          )}
        </div>
      </section>

        <SponsoredBusinessPlacement
          title="Sponsored in the Store"
          campaigns={businessCampaigns}
        />

        <PromotedPlacement
          title="Featured in the Store"
          campaigns={promotedCampaigns}
        />

      <section className="catalog-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              MUSIC CATALOG
            </p>

            <h2>
              {filteredAlbums.length}{" "}
              {filteredAlbums.length === 1
                ? "Album"
                : "Albums"}
            </h2>
          </div>

          {search && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => setSearch("")}
            >
              Clear Search
            </button>
          )}
        </div>

        {filteredAlbums.length === 0 ? (
          <div className="empty-state">
            <h3>No music found</h3>

            <p>
              Try searching for another album, genre
              or track title.
            </p>
          </div>
        ) : (
          <div className="album-grid">
            {filteredAlbums.map((album) => {
              const isOpen =
                openAlbumId === album.id;

              const canPurchase =
                album.status === "released";

              const albumInCart = cart.some(
                (item) =>
                  item.id === `album-${album.id}`
              );

              const albumIsCurrent =
                currentTrack?.albumTitle === album.title;

              const albumIsFavorite = isFavorite(
                album.title
              );

              return (
                <article
                  className={`album-card ${
                    albumIsCurrent
                      ? "currently-playing"
                      : ""
                  }`}
                  key={album.id}
                >
                  <div className="cover-wrapper">
                    <button
                      type="button"
                      className={`store-favorite-button ${
                        albumIsFavorite ? "active" : ""
                      }`}
                      onClick={() =>
                        toggleFavorite(album.title)
                      }
                      aria-label={
                        albumIsFavorite
                          ? `Remove ${album.title} from favorites`
                          : `Add ${album.title} to favorites`
                      }
                      title={
                        albumIsFavorite
                          ? "Remove from Favorites"
                          : "Add to Favorites"
                      }
                    >
                      {albumIsFavorite ? "\u2665" : "\u2661"}
                    </button>

                    <img
                      src={album.cover}
                      alt={`${album.title} album cover`}
                      className="album-cover"
                    />

                    <span
                      className={`status-badge ${album.status}`}
                    >
                      {canPurchase
                        ? "Released"
                        : "Coming Soon"}
                    </span>

                    {albumIsCurrent && (
                      <span className="active-album-badge">
                        {isPlaying
                          ? "Now Playing"
                          : "Paused"}
                      </span>
                    )}
                  </div>

                  <div className="album-content">
                    <div className="album-meta">
                      <span>{album.genre}</span>
                      <span>{album.year}</span>

                      <span>
                        {album.tracks.length} Tracks
                      </span>
                    </div>

                    <h3>{album.title}</h3>

                    <p className="artist">
                      {album.artist}
                    </p>

                    <p className="description">
                      {album.description}
                    </p>

                    <div className="album-player-actions">
                      <button
                        type="button"
                        className="album-play-button"
                        onClick={() => {
                          if (
                            albumIsCurrent &&
                            currentTrack
                          ) {
                            togglePlay();
                          } else {
                            playAlbum(album.id);
                          }
                        }}
                        disabled={
                          album.tracks.length === 0
                        }
                      >
                        <span className="album-play-icon">
                          {albumIsCurrent && isPlaying ? "\u23F8" : "\u25B6"}
                        </span>

                        <span>
                          <strong>
                            {albumIsCurrent &&
                            isPlaying
                              ? "Pause Album"
                              : albumIsCurrent
                                ? "Resume Album"
                                : "Play Album"}
                          </strong>

                          <small>
                            Listen to{" "}
                            {album.tracks.length}{" "}
                            track previews
                          </small>
                        </span>
                      </button>

                      {albumIsCurrent &&
                        currentTrack && (
                          <div className="now-playing-album">
                            <span className="playing-indicator">
                              {isPlaying
                                ? "NOW PLAYING"
                                : "PAUSED"}
                            </span>

                            <strong>
                              {currentTrack.title}
                            </strong>

                            <small>
                              Track{" "}
                              {currentTrackIndex + 1}{" "}
                              of {playerQueue.length}
                            </small>
                          </div>
                        )}
                    </div>

                    <div className="price-row">
                      <div>
                        <span className="price-label">
                          Full album
                        </span>

                        <strong>
                          $
                          {album.albumPrice.toFixed(
                            2
                          )}
                        </strong>
                      </div>

                      <div>
                        <span className="price-label">
                          Each track
                        </span>

                        <strong>
                          $
                          {album.trackPrice.toFixed(
                            2
                          )}
                        </strong>
                      </div>
                    </div>

                    <div className="album-actions">
                      <button
                        type="button"
                        className="primary-button"
                        disabled={!canPurchase}
                        onClick={() =>
                          addAlbumToCart(album.id)
                        }
                      >
                        {!canPurchase
                          ? "Coming Soon"
                          : albumInCart
                            ? "Album in Cart"
                            : "Add Album to Cart"}
                      </button>

                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                          setOpenAlbumId(
                            isOpen
                              ? null
                              : album.id
                          )
                        }
                      >
                        {isOpen
                          ? "Hide Tracks"
                          : "View Tracks"}
                      </button>

                      <Link
                        href={album.pageLink}
                        className="secondary-button link-button"
                      >
                        Album Page
                      </Link>
                    </div>

                    {isOpen && (
                      <div className="track-list">
                        <div className="track-list-heading">
                          <h4>
                            {album.title} Tracklist
                          </h4>

                          <span>
                            {album.tracks.length}{" "}
                            tracks
                          </span>
                        </div>

                        {album.tracks.map(
                          (track) => {
                            const trackInCart =
                              cart.some(
                                (item) =>
                                  item.id ===
                                  `track-${track.id}`
                              );

                            const trackIsCurrent =
                              currentTrack?.id ===
                              track.id;

                            return (
                              <div
                                className={`track-row ${
                                  trackIsCurrent
                                    ? "current-track-row"
                                    : ""
                                }`}
                                key={track.id}
                              >
                                <span className="track-number">
                                  {String(
                                    track.number
                                  ).padStart(
                                    2,
                                    "0"
                                  )}
                                </span>

                                <div className="track-information">
                                  <strong>
                                    {track.title}
                                  </strong>

                                  <button
                                    type="button"
                                    className={`track-play-button ${
                                      trackIsCurrent
                                        ? "active"
                                        : ""
                                    }`}
                                    onClick={() =>
                                      playTrack(
                                        album.id,
                                        track.id
                                      )
                                    }
                                    disabled={
                                      !track.preview
                                    }
                                  >
                                    <span>{trackIsCurrent && isPlaying ? "\u23F8" : "\u25B6"}</span>

                                    {trackIsCurrent
                                      ? isPlaying
                                        ? "Playing"
                                        : "Resume"
                                      : "Play Preview"}
                                  </button>
                                </div>

                                <span className="track-price">
                                  $
                                  {track.price.toFixed(
                                    2
                                  )}
                                </span>

                                <button
                                  type="button"
                                  className="small-cart-button"
                                  disabled={
                                    !canPurchase
                                  }
                                  onClick={() =>
                                    addTrackToCart(
                                      album.id,
                                      track.id
                                    )
                                  }
                                >
                                  {!canPurchase
                                    ? "Soon"
                                    : trackInCart
                                      ? "Added"
                                      : "Add"}
                                </button>
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      {cartOpen && (
        <div
          className="cart-overlay"
          onClick={() => setCartOpen(false)}
          role="presentation"
        >
          <aside
            className="cart-panel"
            onClick={(event) => event.stopPropagation()}
            aria-label="Shopping cart"
          >
            <div className="cart-header">
              <div>
                <p className="eyebrow">YOUR ORDER</p>
                <h2>Shopping Cart</h2>
              </div>

              <button
                type="button"
                className="close-button"
                onClick={() => setCartOpen(false)}
                aria-label="Close shopping cart"
              >
                {"\u00D7"}</button>
            </div>

            {paymentComplete ? (
              <div className="payment-success">
                <div className="success-icon">{"\u2713"}</div>

                <h3>Payment Confirmed</h3>

                <p>
                  Thank you for supporting Solo Beats.
                  Your purchase has been securely
                  confirmed.
                </p>

                {checkoutMessage && (
                  <p className="checkout-message">
                    {checkoutMessage}
                  </p>
                )}

                {downloads.length > 0 && (
                  <div className="download-list">
                    <h4>Your Secure Downloads</h4>

                    {downloads.map((download) => (
                      <a
                        key={`${download.itemType}-${download.itemId}`}
                        href={download.downloadUrl}
                        className="download-button"
                        target="_blank"
                        rel="noopener noreferrer"
                        download={download.fileName}
                      >
                        <span>
                          {download.itemType === "album"
                            ? "Download Album"
                            : "Download Track"}
                        </span>

                        <strong>
                          {download.title}
                        </strong>

                        <small>
                          {download.fileName}
                        </small>
                      </a>
                    ))}

                    <p className="download-expiry">
                      These secure links expire after
                      60 minutes. Download your files
                      now.
                    </p>

                    {savedPurchase && (
                      <button
                        type="button"
                        className="secondary-button regenerate-button"
                        disabled={
                          generatingDownloads
                        }
                        onClick={() =>
                          generateDownloadLinks(
                            savedPurchase
                          )
                        }
                      >
                        {generatingDownloads
                          ? "Generating..."
                          : "Generate New Download Links"}
                      </button>
                    )}
                  </div>
                )}

                {checkoutError && (
                  <p className="checkout-error">
                    {checkoutError}
                  </p>
                )}

                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    setPaymentComplete(false);
                    setCheckoutMessage("");
                    setCheckoutError("");
                    setDownloads([]);
                    setCartOpen(false);
                  }}
                >
                  Continue Shopping
                </button>
              </div>
            ) : cart.length === 0 ? (
              <div className="empty-cart">
                <h3>Your cart is empty</h3>

                <p>
                  Add a released album or individual
                  track to begin your order.
                </p>

                <div className="cart-restore-section">
                  <h4>
                    Restore a completed purchase
                  </h4>

                  <input
                    type="text"
                    value={restoreOrderId}
                    onChange={(event) =>
                      setRestoreOrderId(
                        event.target.value
                      )
                    }
                    placeholder="PayPal order ID"
                  />

                  <button
                    type="button"
                    className="primary-button"
                    disabled={restoringPurchase}
                    onClick={
                      restorePurchaseByOrderId
                    }
                  >
                    {restoringPurchase
                      ? "Restoring..."
                      : "Restore Purchase"}
                  </button>

                  {savedPurchase && (
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={
                        generatingDownloads
                      }
                      onClick={() =>
                        generateDownloadLinks(
                          savedPurchase
                        )
                      }
                    >
                      {generatingDownloads
                        ? "Generating..."
                        : "Generate New Download Links"}
                    </button>
                  )}
                </div>

                {checkoutMessage && (
                  <p className="checkout-message">
                    {checkoutMessage}
                  </p>
                )}

                {checkoutError && (
                  <p className="checkout-error">
                    {checkoutError}
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="cart-items">
                  {cart.map((item) => (
                    <div
                      className="cart-item"
                      key={item.id}
                    >
                      <img
                        src={item.cover}
                        alt={`${item.albumTitle} cover`}
                      />

                      <div className="cart-item-information">
                        <span className="item-type">
                          {item.type === "album"
                            ? "Full Album"
                            : "Track"}
                        </span>

                        <strong>
                          {item.title}
                        </strong>

                        <small>
                          {item.albumTitle}
                        </small>
                      </div>

                      <div className="cart-item-actions">
                        <strong>
                          ${item.price.toFixed(2)}
                        </strong>

                        <button
                          type="button"
                          onClick={() =>
                            removeFromCart(item.id)
                          }
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="cart-summary">
                  <div className="total-row">
                    <span>Total</span>

                    <strong>
                      ${cartTotal.toFixed(2)}
                    </strong>
                  </div>

                  <div className="paypal-checkout-area">
                    {!paypalClientId ? (
                      <p className="checkout-error">
                        PayPal Client ID is missing.
                        Check your .env.local file and
                        restart the server.
                      </p>
                    ) : (
                      <PayPalScriptProvider
                        options={{
                          clientId:
                            paypalClientId,
                          currency: "USD",
                          intent: "capture",
                        }}
                      >
                        <PayPalButtons
                          style={{
                            layout: "vertical",
                            shape: "pill",
                            label: "paypal",
                            height: 48,
                          }}
                          disabled={
                            cart.length === 0
                          }
                          forceReRender={[
                            cart
                              .map(
                                (item) => item.id
                              )
                              .sort()
                              .join("|"),
                            cartTotal.toFixed(2),
                          ]}
                          createOrder={async () =>
                            createPayPalOrder()
                          }
                          onApprove={async (data) => {
                            await capturePayPalOrder(
                              data.orderID
                            );
                          }}
                          onCancel={() => {
                            setCheckoutMessage("");
                            setCheckoutError(
                              "The PayPal checkout was cancelled. No payment was taken."
                            );
                          }}
                          onError={(error) => {
                            console.error(
                              "PayPal button error:",
                              error
                            );

                            setCheckoutMessage("");

                            setCheckoutError(
                              "PayPal encountered an error. Please try again."
                            );
                          }}
                        />
                      </PayPalScriptProvider>
                    )}

                    {checkoutMessage &&
                      !paymentComplete && (
                        <p className="checkout-message">
                          {checkoutMessage}
                        </p>
                      )}

                    {checkoutError &&
                      !paymentComplete && (
                        <p className="checkout-error">
                          {checkoutError}
                        </p>
                      )}
                  </div>

                  <button
                    type="button"
                    className="clear-cart-button"
                    onClick={clearCart}
                  >
                    Clear Cart
                  </button>

                  <p className="checkout-note">
                    Payments are securely processed
                    through PayPal. Your card and
                    PayPal login information are never
                    stored by Solo Beats Engine Music.
                  </p>
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      <footer>
        <p>
          Â© 2026 Solo Beats Engine Music. All rights
          reserved.
        </p>

        <p className="copyright-notice">
          All music, recordings, artwork and content
          are protected by copyright. Unauthorized
          copying, redistribution, resale, uploading
          or commercial use is prohibited.
        </p>
      </footer>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .store-page {
          min-height: 100vh;
          padding-bottom: 170px;
          color: #ffffff;
          background:
            radial-gradient(
              circle at top left,
              rgba(89, 46, 255, 0.22),
              transparent 35%
            ),
            radial-gradient(
              circle at top right,
              rgba(0, 174, 255, 0.13),
              transparent 32%
            ),
            #070711;
        }

        .topbar {
          position: sticky;
          top: 0;
          z-index: 30;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 20px
            clamp(20px, 5vw, 80px);
          border-bottom: 1px solid
            rgba(255, 255, 255, 0.09);
          background: rgba(7, 7, 17, 0.88);
          backdrop-filter: blur(18px);
        }

        .brand {
          color: #ffffff;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-decoration: none;
        }

        .navigation {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .navigation a {
          color: #c9c9d8;
          text-decoration: none;
          font-weight: 700;
        }

        .navigation a:hover,
        .navigation .active-link {
          color: #ffffff;
        }

        .cart-button {
          border: 1px solid
            rgba(255, 255, 255, 0.25);
          border-radius: 999px;
          padding: 11px 18px;
          color: #090912;
          background: #ffffff;
          font-weight: 900;
          cursor: pointer;
        }

        .hero {
          padding: 90px
            clamp(20px, 7vw, 110px) 65px;
          text-align: center;
        }

        .eyebrow {
          margin: 0 0 12px;
          color: #b6a7ff;
          font-size: 0.78rem;
          font-weight: 900;
          letter-spacing: 0.2em;
        }

        .hero h1 {
          max-width: 850px;
          margin: 0 auto;
          font-size: clamp(
            2.5rem,
            7vw,
            5.8rem
          );
          line-height: 0.98;
          letter-spacing: -0.055em;
        }

        .hero-description {
          max-width: 720px;
          margin: 26px auto 0;
          color: #b7b7c8;
          font-size: 1.08rem;
          line-height: 1.8;
        }

        .search-wrapper,
        .restore-purchase-card {
          max-width: 680px;
          margin: 28px auto 0;
        }

        .search-wrapper input,
        .restore-purchase-row input,
        .cart-restore-section input {
          width: 100%;
          border: 1px solid
            rgba(255, 255, 255, 0.16);
          border-radius: 18px;
          padding: 18px 20px;
          color: #ffffff;
          background: rgba(
            255,
            255,
            255,
            0.07
          );
          font: inherit;
          outline: none;
        }

        .restore-purchase-card {
          border: 1px solid
            rgba(255, 255, 255, 0.12);
          border-radius: 22px;
          padding: 22px;
          background: rgba(
            255,
            255,
            255,
            0.045
          );
        }

        .restore-purchase-card h2 {
          margin: 0;
          font-size: 1.5rem;
        }

        .restore-purchase-card p {
          color: #aaaabe;
          line-height: 1.6;
        }

        .restore-purchase-row {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr) auto;
          gap: 12px;
        }

        .saved-download-button {
          margin-top: 12px;
        }

        .catalog-section {
          padding: 35px
            clamp(20px, 5vw, 80px) 100px;
        }

        .section-heading {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 20px;
          max-width: 1300px;
          margin: 0 auto 28px;
        }

        .section-heading h2 {
          margin: 0;
          font-size: clamp(
            2rem,
            4vw,
            3.2rem
          );
        }

        .album-grid {
          display: grid;
          gap: 24px;
          max-width: 1300px;
          margin: 24px auto 0;
        }

        .album-card {
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 36px;
          align-items: center;
          overflow: hidden;
          border: 1px solid
            rgba(255, 255, 255, 0.1);
          border-radius: 28px;
          background: rgba(
            255,
            255,
            255,
            0.045
          );
          box-shadow: 0 30px 90px
            rgba(0, 0, 0, 0.28);
          transition:
            border-color 0.25s ease,
            box-shadow 0.25s ease,
            transform 0.25s ease;
        }

        .album-card.currently-playing {
          border-color:
            rgba(169, 146, 255, 0.78);
          box-shadow:
            0 30px 100px
              rgba(0, 0, 0, 0.35),
            0 0 42px
              rgba(105, 75, 255, 0.28);
          transform: translateY(-2px);
        }

        .cover-wrapper {
          position: relative;
          width: 100%;
          aspect-ratio: 1 / 1;
          align-self: start;
          overflow: hidden;
          background: #101020;
        }

        .store-favorite-button {
          position: absolute;
          top: 18px;
          right: 18px;
          z-index: 5;
          display: grid;
          width: 46px;
          height: 46px;
          place-items: center;
          border: 1px solid rgba(255, 255, 255, 0.24);
          border-radius: 50%;
          color: #ffffff;
          background: rgba(8, 8, 20, 0.78);
          font-size: 1.45rem;
          line-height: 1;
          cursor: pointer;
          backdrop-filter: blur(10px);
          transition:
            transform 0.2s ease,
            border-color 0.2s ease,
            color 0.2s ease,
            background 0.2s ease;
        }

        .store-favorite-button:hover {
          transform: scale(1.08);
          border-color: rgba(255, 105, 180, 0.8);
          color: #ff8fc7;
        }

        .store-favorite-button.active {
          border-color: rgba(255, 105, 180, 0.85);
          color: #ffffff;
          background: #f42f8c;
          box-shadow: 0 10px 26px rgba(244, 47, 140, 0.35);
        }

        .album-cover {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
          .status-badge {
          position: absolute;
          top: 18px;
          left: 18px;
          border: 1px solid
            rgba(255, 255, 255, 0.24);
          border-radius: 999px;
          padding: 8px 12px;
          background: rgba(8, 8, 20, 0.78);
          font-size: 0.75rem;
          font-weight: 900;
          text-transform: uppercase;
          backdrop-filter: blur(10px);
        }

        .status-badge.upcoming {
          color: #ffd98f;
        }

        .status-badge.released {
          color: #9dffb5;
        }

        .active-album-badge {
          position: absolute;
          right: 18px;
          bottom: 18px;
          border: 1px solid
            rgba(157, 255, 181, 0.55);
          border-radius: 999px;
          padding: 8px 12px;
          color: #9dffb5;
          background: rgba(7, 15, 12, 0.85);
          font-size: 0.7rem;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          backdrop-filter: blur(10px);
        }

        .album-content {
          min-width: 0;
          padding: clamp(25px, 4vw, 50px);
        }

        .album-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 18px;
        }

        .album-meta span {
          border: 1px solid
            rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          padding: 7px 11px;
          color: #c9c4e7;
          font-size: 0.75rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        .album-content h3 {
          margin: 0;
          overflow-wrap: anywhere;
          font-size: clamp(
            2.2rem,
            5vw,
            4.4rem
          );
          letter-spacing: -0.045em;
        }

        .artist {
          margin: 8px 0 0;
          color: #b8a7ff;
          font-weight: 900;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }

        .description {
          max-width: 780px;
          margin: 22px 0;
          color: #b8b8c9;
          line-height: 1.75;
        }

        .album-player-actions {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 14px;
          margin: 8px 0 24px;
        }

        .album-play-button {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 240px;
          border: 1px solid
            rgba(182, 167, 255, 0.38);
          border-radius: 18px;
          padding: 14px 18px;
          color: #ffffff;
          background: linear-gradient(
            135deg,
            rgba(105, 75, 255, 0.28),
            rgba(0, 174, 255, 0.12)
          );
          cursor: pointer;
          text-align: left;
          transition:
            transform 0.2s ease,
            border-color 0.2s ease,
            background 0.2s ease;
        }

        .album-play-button:hover {
          transform: translateY(-2px);
          border-color:
            rgba(182, 167, 255, 0.75);
          background: linear-gradient(
            135deg,
            rgba(105, 75, 255, 0.4),
            rgba(0, 174, 255, 0.18)
          );
        }

        .album-play-icon {
          display: grid;
          width: 44px;
          height: 44px;
          flex: 0 0 auto;
          place-items: center;
          border-radius: 50%;
          color: #080810;
          background: #ffffff;
          font-size: 1rem;
        }

        .album-play-button > span:last-child {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .album-play-button strong {
          font-size: 0.98rem;
        }

        .album-play-button small {
          color: #b8b8c9;
          font-size: 0.75rem;
        }

        .now-playing-album {
          display: flex;
          min-width: 0;
          flex-direction: column;
          gap: 4px;
        }

        .now-playing-album strong,
        .now-playing-album small {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .now-playing-album small {
          color: #9696a8;
          font-size: 0.76rem;
        }

        .playing-indicator {
          color: #9dffb5;
          font-size: 0.68rem;
          font-weight: 900;
          letter-spacing: 0.14em;
        }

        .price-row {
          display: flex;
          flex-wrap: wrap;
          gap: 30px;
          margin-bottom: 25px;
        }

        .price-row div {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .price-label {
          color: #8f8fa1;
          font-size: 0.8rem;
          text-transform: uppercase;
        }

        .price-row strong {
          font-size: 1.25rem;
        }

        .album-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .primary-button,
        .secondary-button,
        .link-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 48px;
          border-radius: 999px;
          padding: 12px 19px;
          font: inherit;
          font-weight: 900;
          text-decoration: none;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .primary-button {
          border: none;
          color: #090912;
          background: #ffffff;
        }

        .secondary-button,
        .link-button {
          border: 1px solid
            rgba(255, 255, 255, 0.18);
          color: #ffffff;
          background: rgba(
            255,
            255,
            255,
            0.055
          );
        }

        .primary-button:hover,
        .secondary-button:hover,
        .link-button:hover {
          transform: translateY(-1px);
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .track-list {
          margin-top: 34px;
          overflow: hidden;
          border: 1px solid
            rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          background: rgba(0, 0, 0, 0.22);
        }

        .track-list-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 20px;
          border-bottom: 1px solid
            rgba(255, 255, 255, 0.09);
        }

        .track-list-heading h4 {
          margin: 0;
          font-size: 1.25rem;
        }

        .track-list-heading span {
          color: #9696a8;
          font-size: 0.8rem;
        }

        .track-row {
          display: grid;
          grid-template-columns:
            44px minmax(0, 1fr)
            75px 72px;
          align-items: center;
          gap: 14px;
          padding: 16px 20px;
          border-bottom: 1px solid
            rgba(255, 255, 255, 0.075);
          transition:
            background 0.2s ease,
            border-color 0.2s ease;
        }

        .track-row:last-child {
          border-bottom: none;
        }

        .track-row.current-track-row {
          border-color:
            rgba(169, 146, 255, 0.28);
          background:
            rgba(105, 75, 255, 0.12);
        }

        .track-number {
          color: #858596;
          font-size: 0.82rem;
          font-weight: 900;
        }

        .track-information {
          min-width: 0;
        }

        .track-information strong {
          display: block;
          margin-bottom: 9px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .track-play-button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          width: fit-content;
          min-width: 120px;
          border: 1px solid
            rgba(255, 255, 255, 0.15);
          border-radius: 999px;
          padding: 8px 13px;
          color: #d8d8e4;
          background: rgba(
            255,
            255,
            255,
            0.055
          );
          font: inherit;
          font-size: 0.77rem;
          font-weight: 800;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .track-play-button:hover,
        .track-play-button.active {
          border-color:
            rgba(182, 167, 255, 0.75);
          color: #ffffff;
          background:
            rgba(105, 75, 255, 0.25);
        }

        .track-play-button span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 14px;
          font-size: 0.68rem;
        }

        .track-price {
          color: #ffffff;
          font-weight: 900;
        }

        .small-cart-button {
          border: 1px solid
            rgba(255, 255, 255, 0.16);
          border-radius: 999px;
          padding: 9px 12px;
          color: #ffffff;
          background: rgba(
            255,
            255,
            255,
            0.07
          );
          font-weight: 800;
          cursor: pointer;
        }

        .empty-state {
          max-width: 1300px;
          margin: 0 auto;
          border: 1px solid
            rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          padding: 70px 25px;
          text-align: center;
          background: rgba(
            255,
            255,
            255,
            0.04
          );
        }

        .cart-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          justify-content: flex-end;
          background: rgba(0, 0, 0, 0.72);
          backdrop-filter: blur(8px);
        }

        .cart-panel {
          width: min(100%, 520px);
          height: 100%;
          overflow-y: auto;
          padding: 28px;
          background: #0c0c18;
          box-shadow: -25px 0 80px
            rgba(0, 0, 0, 0.45);
        }

        .cart-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding-bottom: 22px;
          border-bottom: 1px solid
            rgba(255, 255, 255, 0.1);
        }

        .cart-header h2 {
          margin: 0;
          font-size: 2rem;
        }

        .close-button {
          border: none;
          color: #ffffff;
          background: transparent;
          font-size: 2.4rem;
          cursor: pointer;
        }

        .empty-cart,
        .payment-success {
          padding: 65px 10px;
          text-align: center;
        }

        .cart-restore-section {
          display: grid;
          gap: 12px;
          margin-top: 28px;
          border: 1px solid
            rgba(255, 255, 255, 0.1);
          border-radius: 18px;
          padding: 18px;
          background: rgba(
            255,
            255,
            255,
            0.04
          );
        }

        .cart-items {
          padding: 12px 0;
        }

        .cart-item {
          display: grid;
          grid-template-columns:
            72px minmax(0, 1fr) auto;
          gap: 14px;
          align-items: center;
          padding: 16px 0;
          border-bottom: 1px solid
            rgba(255, 255, 255, 0.08);
        }

        .cart-item img {
          width: 72px;
          height: 72px;
          border-radius: 12px;
          object-fit: cover;
        }

        .cart-item-information {
          display: flex;
          min-width: 0;
          flex-direction: column;
          gap: 3px;
        }

        .cart-item-information strong,
        .cart-item-information small {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .item-type {
          color: #ad9eff;
          font-size: 0.7rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .cart-item-actions {
          display: flex;
          align-items: flex-end;
          flex-direction: column;
          gap: 8px;
        }

        .cart-item-actions button {
          border: none;
          padding: 0;
          color: #ff8a8a;
          background: transparent;
          cursor: pointer;
        }

        .cart-summary {
          padding-top: 22px;
        }

        .total-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
          font-size: 1.25rem;
        }

        .clear-cart-button {
          width: 100%;
          margin-top: 10px;
          border: 1px solid
            rgba(255, 255, 255, 0.15);
          border-radius: 999px;
          padding: 15px 18px;
          color: #ffffff;
          background: transparent;
          font: inherit;
          font-weight: 900;
          cursor: pointer;
        }

        .checkout-note {
          margin-top: 17px;
          color: #8f8fa0;
          font-size: 0.82rem;
          line-height: 1.6;
          text-align: center;
        }

        .checkout-message,
        .checkout-error {
          margin-top: 14px;
          border-radius: 12px;
          padding: 12px;
          font-size: 0.9rem;
          line-height: 1.5;
          text-align: center;
        }

        .checkout-message {
          border: 1px solid
            rgba(96, 255, 153, 0.3);
          color: #a8ffc4;
          background:
            rgba(54, 190, 105, 0.1);
        }

        .checkout-error {
          border: 1px solid
            rgba(255, 88, 88, 0.35);
          color: #ffaaaa;
          background:
            rgba(255, 61, 61, 0.1);
        }

        .success-icon {
          display: grid;
          width: 78px;
          height: 78px;
          margin: 0 auto;
          place-items: center;
          border-radius: 50%;
          color: #08120c;
          background: #79ffa6;
          font-size: 2.8rem;
          font-weight: 900;
        }

        .download-list {
          display: grid;
          gap: 12px;
          margin-top: 24px;
          text-align: left;
        }

        .download-list h4 {
          margin: 0 0 4px;
          text-align: center;
          font-size: 1.2rem;
        }

        .download-button {
          display: flex;
          flex-direction: column;
          gap: 3px;
          border: 1px solid
            rgba(121, 255, 166, 0.38);
          border-radius: 16px;
          padding: 16px;
          color: #ffffff;
          background:
            rgba(121, 255, 166, 0.08);
          text-decoration: none;
        }

        .download-button span {
          color: #79ffa6;
          font-size: 0.75rem;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .download-button small {
          color: #9d9dae;
          overflow-wrap: anywhere;
        }

        .download-expiry {
          margin: 4px 0 0;
          color: #ffd98f !important;
          font-size: 0.8rem;
          text-align: center;
        }

        .regenerate-button {
          width: 100%;
        }

        .universal-player {
          position: fixed;
          right: 18px;
          bottom: 18px;
          left: 18px;
          z-index: 90;
          display: grid;
          grid-template-columns:
            minmax(230px, 0.9fr)
            minmax(390px, 1.6fr)
            minmax(290px, 1fr);
          align-items: center;
          gap: 26px;
          max-width: 1500px;
          min-height: 118px;
          margin: 0 auto;
          border: 1px solid
            rgba(255, 255, 255, 0.17);
          border-radius: 26px;
          padding: 16px 20px;
          background: linear-gradient(
            135deg,
            rgba(20, 18, 43, 0.97),
            rgba(8, 8, 19, 0.98)
          );
          box-shadow:
            0 22px 75px
              rgba(0, 0, 0, 0.65),
            0 0 40px
              rgba(87, 54, 255, 0.15);
          backdrop-filter: blur(26px);
        }

        .universal-player audio {
          display: none;
        }

        .universal-player-track {
          display: flex;
          min-width: 0;
          align-items: center;
          gap: 14px;
        }

        .universal-player-track img {
          width: 78px;
          height: 78px;
          flex: 0 0 auto;
          border-radius: 15px;
          object-fit: cover;
          box-shadow: 0 10px 28px
            rgba(0, 0, 0, 0.4);
        }

        .universal-player-track-text {
          display: flex;
          min-width: 0;
          flex-direction: column;
          gap: 4px;
        }

        .universal-player-track-text span {
          color: #ad9eff;
          font-size: 0.66rem;
          font-weight: 900;
          letter-spacing: 0.14em;
        }

        .universal-player-track-text strong,
        .universal-player-track-text small {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .universal-player-track-text strong {
          font-size: 1rem;
        }

        .universal-player-track-text small {
          color: #9d9daf;
          font-size: 0.76rem;
        }

        .universal-player-center {
          display: flex;
          min-width: 0;
          flex-direction: column;
          gap: 12px;
        }

        .universal-player-controls {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
        }

        .universal-player-controls button,
        .close-player-button,
        .mute-button {
          display: grid;
          width: 38px;
          height: 38px;
          flex: 0 0 auto;
          place-items: center;
          border: none;
          border-radius: 50%;
          color: #ffffff;
          background: rgba(
            255,
            255,
            255,
            0.075
          );
          font-size: 1rem;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .universal-player-controls button:hover,
        .close-player-button:hover,
        .mute-button:hover {
          background: rgba(
            255,
            255,
            255,
            0.16
          );
          transform: scale(1.05);
        }

        .universal-player-controls
          .main-play-button {
          width: 52px;
          height: 52px;
          color: #090912;
          background: #ffffff;
          font-size: 1rem;
        }

        .player-mode-button.enabled {
          border: 1px solid
            rgba(121, 255, 166, 0.48);
          color: #9dffb5;
          background:
            rgba(121, 255, 166, 0.12);
        }

        .universal-player-progress {
          display: grid;
          grid-template-columns:
            42px minmax(0, 1fr) 42px;
          align-items: center;
          gap: 10px;
        }

        .universal-player-progress span {
          color: #9696a8;
          font-size: 0.7rem;
          text-align: center;
        }

        .universal-player-progress input,
        .volume-control input {
          width: 100%;
          accent-color: #a992ff;
          cursor: pointer;
        }

        .universal-player-options {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 13px;
        }

        .autoplay-button {
          border: 1px solid
            rgba(255, 255, 255, 0.13);
          border-radius: 999px;
          padding: 9px 12px;
          color: #9696a8;
          background: rgba(
            255,
            255,
            255,
            0.04
          );
          font-size: 0.65rem;
          font-weight: 900;
          letter-spacing: 0.06em;
          cursor: pointer;
        }

        .autoplay-button.enabled {
          border-color:
            rgba(121, 255, 166, 0.38);
          color: #9dffb5;
          background:
            rgba(121, 255, 166, 0.08);
        }

        .volume-control {
          display: grid;
          grid-template-columns:
            38px minmax(75px, 1fr) 40px;
          width: 175px;
          align-items: center;
          gap: 7px;
        }

        .mute-button {
          font-size: 0.85rem;
        }

        .volume-percent {
          color: #9696a8;
          font-size: 0.67rem;
          text-align: right;
        }

        .close-player-button {
          font-size: 1.6rem;
        }
          footer {
          padding: 30px 20px;
          border-top: 1px solid
            rgba(255, 255, 255, 0.08);
          color: #858596;
          text-align: center;
        }

        .copyright-notice {
          max-width: 850px;
          margin: 12px auto 0;
          font-size: 0.78rem;
          line-height: 1.6;
        }

        @media (max-width: 1050px) {
          .universal-player {
            grid-template-columns:
              minmax(220px, 0.9fr)
              minmax(340px, 1.5fr);
          }

          .universal-player-options {
            grid-column: 1 / -1;
            justify-content: center;
          }
        }

        @media (max-width: 900px) {
          .topbar {
            align-items: flex-start;
            flex-direction: column;
          }

          .navigation {
            width: 100%;
            overflow-x: auto;
          }

          .album-card {
            grid-template-columns: 1fr;
            gap: 0;
          }

          .cover-wrapper {
            width: 100%;
            max-width: none;
            aspect-ratio: 1 / 1;
          }

          .album-cover {
            min-height: auto;
            aspect-ratio: 1 / 1;
          }

          .universal-player {
            grid-template-columns:
              minmax(0, 1fr) auto;
            gap: 14px;
          }

          .universal-player-center {
            grid-column: 1 / -1;
            grid-row: 2;
          }

          .universal-player-options {
            grid-column: auto;
            justify-content: flex-end;
          }

          .autoplay-button,
          .volume-control {
            display: none;
          }
        }

        @media (max-width: 650px) {
          .store-page {
            padding-bottom: 215px;
          }

          .hero {
            padding-top: 60px;
          }

          .restore-purchase-row {
            grid-template-columns: 1fr;
          }

          .section-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .album-content {
            padding: 24px 18px;
          }

          .album-content h3 {
            font-size: clamp(
              2rem,
              12vw,
              3rem
            );
          }

          .album-player-actions {
            align-items: stretch;
            flex-direction: column;
          }

          .album-play-button {
            width: 100%;
            min-width: 0;
          }

          .track-row {
            grid-template-columns:
              34px minmax(0, 1fr) auto;
            gap: 10px;
            padding: 14px 12px;
          }

          .track-price {
            display: none;
          }

          .track-play-button {
            min-width: 105px;
            padding: 7px 10px;
          }

          .cart-item {
            grid-template-columns:
              58px minmax(0, 1fr);
          }

          .cart-item img {
            width: 58px;
            height: 58px;
          }

          .cart-item-actions {
            grid-column: 2;
            align-items: flex-start;
            flex-direction: row;
            justify-content: space-between;
          }

          .universal-player {
            right: 8px;
            bottom: 8px;
            left: 8px;
            grid-template-columns:
              minmax(0, 1fr) auto;
            min-height: 190px;
            border-radius: 20px;
            padding: 12px;
          }

          .universal-player-track img {
            width: 58px;
            height: 58px;
            border-radius: 11px;
          }

          .universal-player-track-text strong {
            font-size: 0.9rem;
          }

          .universal-player-track-text small {
            max-width: 190px;
          }

          .universal-player-center {
            grid-column: 1 / -1;
          }

          .universal-player-controls {
            gap: 9px;
          }

          .universal-player-controls button,
          .close-player-button {
            width: 34px;
            height: 34px;
          }

          .universal-player-controls
            .main-play-button {
            width: 46px;
            height: 46px;
          }

          .universal-player-progress {
            grid-template-columns:
              34px minmax(0, 1fr) 34px;
            gap: 6px;
          }

          .universal-player-options {
            justify-content: flex-end;
          }

          .active-album-badge {
            right: 12px;
            bottom: 12px;
          }
        }

        @media (max-width: 430px) {
          .navigation {
            gap: 13px;
          }

          .cart-button {
            padding: 9px 14px;
          }

          .universal-player {
            min-height: 198px;
          }

          .universal-player-track-text small {
            max-width: 145px;
          }

          .universal-player-controls {
            justify-content: space-between;
          }

          .track-row {
            grid-template-columns:
              30px minmax(0, 1fr) 58px;
          }

          .small-cart-button {
            padding: 8px 10px;
          }
        }
      `}</style>
    </main>
  );
}






