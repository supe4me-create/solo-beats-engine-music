"use client";

import Link from "next/link";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import {
  firebaseAuth,
  googleProvider,
} from "../../lib/firebaseClient";

type Mode = "signin" | "register";

type MyMusicPurchase = {
  orderId: string;
  items: Array<{
    itemType: "album" | "track";
    itemId: string;
    name: string;
  }>;
};

type PremiumStatus = {
  success: boolean;
  premiumActive: boolean;
  status: string | null;
  subscriptionId: string | null;
  planId: string | null;
  startTime: string | null;
  nextBillingTime: string | null;
  subscriberEmail: string | null;
  environment: "sandbox" | "live";
};

function getFriendlyError(error: unknown) {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "";

  const messages: Record<string, string> = {
    "auth/email-already-in-use":
      "An account already exists with this email address.",
    "auth/invalid-credential":
      "The email address or password is incorrect.",
    "auth/invalid-email":
      "Please enter a valid email address.",
    "auth/missing-password":
      "Please enter your password.",
    "auth/popup-closed-by-user":
      "Google sign-in was closed before it finished.",
    "auth/popup-blocked":
      "Your browser blocked the Google sign-in window. Please allow popups and try again.",
    "auth/too-many-requests":
      "Too many attempts were made. Please wait a moment and try again.",
    "auth/weak-password":
      "Use a password with at least 6 characters.",
  };

  if (messages[code]) {
    return messages[code];
  }

  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

function getProviderLabel(providerId: string | undefined) {
  if (providerId === "google.com") return "Google";
  if (providerId === "password") return "Email and password";
  return "Firebase account";
}

function formatAccountDate(value: string | undefined) {
  if (!value) return "Unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatPremiumDate(value: string | null | undefined) {
  if (!value) return "Unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function AccountPage() {
  const { user, loading, signOutUser } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [purchaseCount, setPurchaseCount] = useState(0);
  const [albumCount, setAlbumCount] = useState(0);
  const [trackCount, setTrackCount] = useState(0);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [purchaseError, setPurchaseError] = useState("");

  const [premiumStatus, setPremiumStatus] =
    useState<PremiumStatus | null>(null);
  const [loadingPremium, setLoadingPremium] = useState(false);
  const [premiumError, setPremiumError] = useState("");
  const [cancellingPremium, setCancellingPremium] = useState(false);

  const initials = useMemo(() => {
    const source = user?.displayName || user?.email || "SB";
    return source
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [user]);

  const providerLabel = useMemo(() => {
    return getProviderLabel(user?.providerData?.[0]?.providerId);
  }, [user]);

  const accountCreated = useMemo(() => {
    return formatAccountDate(user?.metadata?.creationTime);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setPurchaseCount(0);
      setAlbumCount(0);
      setTrackCount(0);
      return;
    }

    const currentUser = user;
    let cancelled = false;

    async function loadPurchaseSummary() {
      setLoadingPurchases(true);
      setPurchaseError("");

      try {
        const idToken = await currentUser.getIdToken();

        const response = await fetch("/api/my-music", {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.error || "Purchase information could not be loaded."
          );
        }

        const purchases: MyMusicPurchase[] = Array.isArray(data.purchases)
          ? data.purchases
          : [];

        const items = purchases.flatMap((purchase) =>
          Array.isArray(purchase.items) ? purchase.items : []
        );

        if (!cancelled) {
          setPurchaseCount(items.length);
          setAlbumCount(
            items.filter((item) => item.itemType === "album").length
          );
          setTrackCount(
            items.filter((item) => item.itemType === "track").length
          );
        }
      } catch (error) {
        if (!cancelled) {
          setPurchaseError(
            error instanceof Error
              ? error.message
              : "Purchase information could not be loaded."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingPurchases(false);
        }
      }
    }

    void loadPurchaseSummary();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setPremiumStatus(null);
      setPremiumError("");
      return;
    }

    const currentUser = user;
    let cancelled = false;

    async function loadPremiumStatus() {
      setLoadingPremium(true);
      setPremiumError("");

      try {
        const idToken = await currentUser.getIdToken();

        const response = await fetch("/api/premium/status", {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.error || "Premium membership status could not be loaded."
          );
        }

        if (!cancelled) {
          setPremiumStatus(data as PremiumStatus);
        }
      } catch (error) {
        if (!cancelled) {
          setPremiumError(
            error instanceof Error
              ? error.message
              : "Premium membership status could not be loaded."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingPremium(false);
        }
      }
    }

    void loadPremiumStatus();

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleCancelPremium() {
    if (!user || !premiumStatus?.subscriptionId) {
      setPremiumError(
        "A valid Premium subscription could not be found."
      );
      return;
    }

    const confirmed = window.confirm(
      "Cancel SOLO BEATS PREMIUM? Your recurring PayPal subscription will be cancelled and Premium access will be turned off."
    );

    if (!confirmed) return;

    setCancellingPremium(true);
    setPremiumError("");
    setMessage("");

    try {
      const idToken = await user.getIdToken();

      const response = await fetch(
        "/api/premium/cancel",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            subscriptionId:
              premiumStatus.subscriptionId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Premium membership could not be cancelled."
        );
      }

      setPremiumStatus((current) =>
        current
          ? {
              ...current,
              premiumActive: false,
              status: "CANCELLED",
            }
          : current
      );

      setMessage(
        "Your SOLO BEATS PREMIUM subscription has been cancelled."
      );
    } catch (error) {
      setPremiumError(
        error instanceof Error
          ? error.message
          : "Premium membership could not be cancelled."
      );
    } finally {
      setCancellingPremium(false);
    }
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setMessage("");
    setErrorMessage("");

    try {
      if (mode === "register") {
        const credential = await createUserWithEmailAndPassword(
          firebaseAuth,
          email.trim(),
          password
        );

        if (displayName.trim()) {
          await updateProfile(credential.user, {
            displayName: displayName.trim(),
          });
        }

        await sendEmailVerification(credential.user);
        setMessage(
          "Your account was created. A verification email has been sent."
        );
      } else {
        await signInWithEmailAndPassword(
          firebaseAuth,
          email.trim(),
          password
        );
        setMessage("You are signed in.");
      }
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    } finally {
      setWorking(false);
    }
  }

  async function handleGoogleSignIn() {
    setWorking(true);
    setMessage("");
    setErrorMessage("");

    try {
      await signInWithPopup(firebaseAuth, googleProvider);
      setMessage("You are signed in with Google.");
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    } finally {
      setWorking(false);
    }
  }

  async function handlePasswordReset() {
    setMessage("");
    setErrorMessage("");

    if (!email.trim()) {
      setErrorMessage(
        "Enter your email address first, then click Forgot password."
      );
      return;
    }

    setWorking(true);

    try {
      await sendPasswordResetEmail(firebaseAuth, email.trim());
      setMessage("Password reset instructions were sent to your email.");
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    } finally {
      setWorking(false);
    }
  }

  async function handleSendVerification() {
    if (!user) return;

    setWorking(true);
    setMessage("");
    setErrorMessage("");

    try {
      await sendEmailVerification(user);
      setMessage("A new verification email has been sent.");
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    } finally {
      setWorking(false);
    }
  }

  async function handleSignOut() {
    setWorking(true);
    setMessage("");
    setErrorMessage("");

    try {
      await signOutUser();
      setMessage("You have signed out.");
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen grid place-items-center px-6">
        <p className="text-white/70">Loading your account...</p>
      </main>
    );
  }

  if (user) {
    return (
      <main className="min-h-screen px-5 pb-40 pt-52 sm:px-8">
        <div className="mx-auto max-w-6xl">

          <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-violet-500/20 via-white/[0.04] to-cyan-400/10 p-7 shadow-2xl sm:p-10">
            <div className="grid gap-8 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
              <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 text-3xl font-black text-white shadow-xl ring-4 ring-white/10">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || "Customer profile"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>

              <div>
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-emerald-300">
                  Customer account
                </p>

                <h1 className="mt-2 text-4xl font-black sm:text-5xl">
                  {user.displayName || "Solo Beats Listener"}
                </h1>

                <p className="mt-3 text-white/65">{user.email}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-violet-200">
                    {providerLabel}
                  </span>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${
                      user.emailVerified
                        ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                        : "border-amber-300/20 bg-amber-300/10 text-amber-100"
                    }`}
                  >
                    {user.emailVerified ? "Email verified" : "Email not verified"}
                  </span>
                </div>
              </div>

              <Link
                href="/my-music"
                className="inline-flex w-fit rounded-2xl bg-white px-6 py-4 font-black text-black"
              >
                Open My Music
              </Link>
            </div>
          </section>

          <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <p className="text-sm text-white/50">Owned items</p>
              <p className="mt-2 text-3xl font-black">
                {loadingPurchases ? "..." : purchaseCount}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <p className="text-sm text-white/50">Full albums</p>
              <p className="mt-2 text-3xl font-black">
                {loadingPurchases ? "..." : albumCount}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <p className="text-sm text-white/50">Individual tracks</p>
              <p className="mt-2 text-3xl font-black">
                {loadingPurchases ? "..." : trackCount}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <p className="text-sm text-white/50">Email status</p>
              <p className="mt-2 text-xl font-black">
                {user.emailVerified ? "Verified" : "Not verified"}
              </p>
            </div>
          </section>

          <section className="mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-r from-violet-500/15 via-white/[0.03] to-emerald-400/10 p-6 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-violet-300">
                  SOLO BEATS PREMIUM
                </p>

                <h2 className="mt-2 text-3xl font-black">
                  {loadingPremium
                    ? "Checking membership..."
                    : premiumStatus?.premiumActive
                      ? "Premium Membership Active"
                      : "Premium Membership Inactive"}
                </h2>

                <p className="mt-3 max-w-2xl text-white/55">
                  {premiumStatus?.premiumActive
                    ? "Your $9.99 monthly membership is active and linked to this account."
                    : "Join SOLO BEATS PREMIUM for unlimited streaming, monthly downloads, early access, and member discounts."}
                </p>
              </div>

              {premiumStatus?.premiumActive ? (
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/premium"
                    className="inline-flex w-fit rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-6 py-4 font-black text-emerald-200"
                  >
                    Premium Page
                  </Link>

                  <button
                    type="button"
                    onClick={handleCancelPremium}
                    disabled={cancellingPremium}
                    className="inline-flex w-fit rounded-2xl border border-red-400/25 bg-red-400/10 px-6 py-4 font-black text-red-200 transition hover:bg-red-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {cancellingPremium
                      ? "Cancelling..."
                      : "Cancel Premium"}
                  </button>
                </div>
              ) : (
                <Link
                  href="/premium"
                  className="inline-flex w-fit rounded-2xl bg-white px-6 py-4 font-black text-black"
                >
                  Join Premium
                </Link>
              )}
            </div>

            {premiumStatus?.premiumActive ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <p className="text-sm text-white/45">Status</p>
                  <p className="mt-2 font-black text-emerald-200">
                    {premiumStatus.status || "ACTIVE"}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <p className="text-sm text-white/45">Started</p>
                  <p className="mt-2 font-bold">
                    {formatPremiumDate(premiumStatus.startTime)}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <p className="text-sm text-white/45">Next billing date</p>
                  <p className="mt-2 font-bold">
                    {formatPremiumDate(premiumStatus.nextBillingTime)}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <p className="text-sm text-white/45">Billing environment</p>
                  <p className="mt-2 font-bold capitalize">
                    {premiumStatus.environment}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5 sm:col-span-2">
                  <p className="text-sm text-white/45">PayPal subscription ID</p>
                  <p className="mt-2 truncate font-mono text-sm text-white/75">
                    {premiumStatus.subscriptionId || "Unavailable"}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5 sm:col-span-2">
                  <p className="text-sm text-white/45">Subscriber email</p>
                  <p className="mt-2 break-all font-bold">
                    {premiumStatus.subscriberEmail || user.email}
                  </p>
                </div>
              </div>
            ) : null}

            {premiumError ? (
              <p className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">
                {premiumError}
              </p>
            ) : null}
          </section>

          <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 sm:p-8">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-violet-300">
                Profile details
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <p className="text-sm text-white/45">Display name</p>
                  <p className="mt-2 font-bold">
                    {user.displayName || "Solo Beats Listener"}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <p className="text-sm text-white/45">Email address</p>
                  <p className="mt-2 break-all font-bold">{user.email}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <p className="text-sm text-white/45">Sign-in method</p>
                  <p className="mt-2 font-bold">{providerLabel}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <p className="text-sm text-white/45">Account created</p>
                  <p className="mt-2 font-bold">{accountCreated}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5 sm:col-span-2">
                  <p className="text-sm text-white/45">Account ID</p>
                  <p className="mt-2 truncate font-mono text-sm text-white/75">
                    {user.uid}
                  </p>
                </div>
              </div>

              {!user.emailVerified ? (
                <button
                  type="button"
                  onClick={handleSendVerification}
                  disabled={working}
                  className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-300/10 px-5 py-4 font-bold text-amber-100 hover:bg-amber-300/15 disabled:opacity-50"
                >
                  Send verification email
                </button>
              ) : null}

              {purchaseError ? (
                <p className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">
                  {purchaseError}
                </p>
              ) : null}
            </div>

            <aside className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 sm:p-8">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-300">
                Quick actions
              </p>

              <p className="mt-4 text-sm leading-6 text-white/55">
                Your purchases are linked securely to this account and remain available in My Music.
              </p>

              <div className="mt-6 grid gap-3">
                <Link
                  href="/my-music"
                  className="rounded-2xl bg-white px-5 py-4 text-center font-black text-black"
                >
                  Open My Music
                </Link>

                <Link
                  href="/store"
                  className="rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-center font-bold text-white hover:bg-white/10"
                >
                  Browse the Store
                </Link>

                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={working}
                  className="rounded-2xl border border-red-400/20 bg-red-400/10 px-5 py-4 font-bold text-red-200 hover:bg-red-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {working ? "Signing out..." : "Sign out"}
                </button>
              </div>
            </aside>
          </section>

          {message ? (
            <p className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-emerald-200">
              {message}
            </p>
          ) : null}

          {errorMessage ? (
            <p className="mt-6 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">
              {errorMessage}
            </p>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 pb-24 pt-52 sm:px-8">
      <div className="mx-auto max-w-xl">
<section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-violet-500/20 via-white/[0.04] to-cyan-400/10 p-6 shadow-2xl sm:p-10">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.22em] text-emerald-300">
            SOLO BEATS ENGINE MUSIC
          </p>

          <h1 className="text-4xl font-black sm:text-5xl">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>

          <p className="mt-4 text-white/65">
            Sign in to access your purchases, secure downloads, and personal My Music library.
          </p>

          <div className="mt-6 grid gap-3 text-sm text-white/65 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              Secure downloads
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              Purchase history
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              Personal library
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 rounded-2xl border border-white/10 bg-black/20 p-1">
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setMessage("");
                setErrorMessage("");
              }}
              className={`rounded-xl px-4 py-3 font-bold transition ${
                mode === "signin"
                  ? "bg-white text-black"
                  : "text-white/65 hover:text-white"
              }`}
            >
              Sign in
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("register");
                setMessage("");
                setErrorMessage("");
              }}
              className={`rounded-xl px-4 py-3 font-bold transition ${
                mode === "register"
                  ? "bg-white text-black"
                  : "text-white/65 hover:text-white"
              }`}
            >
              Create account
            </button>
          </div>

          <form className="mt-7 space-y-4" onSubmit={handleEmailSubmit}>
            {mode === "register" ? (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-white/75">
                  Display name
                </span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  autoComplete="name"
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-white outline-none transition placeholder:text-white/30 focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10"
                  placeholder="Your name"
                />
              </label>
            ) : null}

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white/75">
                Email address
              </span>
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-white outline-none transition placeholder:text-white/30 focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10"
                placeholder="you@example.com"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white/75">
                Password
              </span>
              <input
                required
                minLength={6}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-white outline-none transition placeholder:text-white/30 focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10"
                placeholder="At least 6 characters"
              />
            </label>

            {mode === "signin" ? (
              <button
                type="button"
                onClick={handlePasswordReset}
                disabled={working}
                className="text-sm font-semibold text-violet-300 hover:text-violet-200 disabled:opacity-50"
              >
                Forgot password?
              </button>
            ) : null}

            <button
              type="submit"
              disabled={working}
              className="w-full rounded-2xl bg-white px-5 py-4 font-black text-black transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {working
                ? "Please wait..."
                : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>

          <div className="my-7 flex items-center gap-4">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/35">
              or
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={working}
            className="w-full rounded-2xl border border-white/15 bg-white/5 px-5 py-4 font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue with Google
          </button>

          {message ? (
            <p className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-emerald-200">
              {message}
            </p>
          ) : null}

          {errorMessage ? (
            <p className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">
              {errorMessage}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}

