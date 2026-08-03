"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "../auth/AuthContext";

type OwnerNotification = {
  id: string;
  type: string;
  category: string;
  title: string;
  message: string;
  targetUrl: string;
  relatedId: string | null;
  read: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

type NotificationsResponse = {
  success: boolean;
  unreadCount?: number;
  notifications?: OwnerNotification[];
  error?: string;
};

const OWNER_EMAIL = "supe4.me@gmail.com";

function formatNotificationTime(value: string | null): string {
  if (!value) return "Just now";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function OwnerNotifications() {
  const { user, loading } = useAuth();
  const [notifications, setNotifications] = useState<OwnerNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isOwner =
    user?.email?.toLowerCase() === OWNER_EMAIL;

  const hasNotifications = notifications.length > 0;

  const badgeText = useMemo(() => {
    if (unreadCount > 99) return "99+";
    return String(unreadCount);
  }, [unreadCount]);

  async function loadNotifications() {
    if (!user || !isOwner) return;

    setFetching(true);
    setError(null);

    try {
      const idToken = await user.getIdToken();

      const response = await fetch("/api/owner/notifications", {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        cache: "no-store",
      });

      const data = (await response.json()) as NotificationsResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Notifications could not be loaded.");
      }

      setNotifications(
        Array.isArray(data.notifications) ? data.notifications : []
      );
      setUnreadCount(
        typeof data.unreadCount === "number" ? data.unreadCount : 0
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Notifications could not be loaded."
      );
    } finally {
      setFetching(false);
    }
  }

  async function markAsRead(notification: OwnerNotification) {
    if (!user || notification.read) return;

    try {
      const idToken = await user.getIdToken();

      const response = await fetch("/api/owner/notifications", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notificationId: notification.id,
        }),
      });

      if (!response.ok) return;

      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id
            ? { ...item, read: true }
            : item
        )
      );

      setUnreadCount((current) => Math.max(0, current - 1));
    } catch {
      // The destination still opens even if marking as read fails.
    }
  }

  async function markAllRead() {
    if (!user || unreadCount === 0) return;

    try {
      const idToken = await user.getIdToken();

      const response = await fetch("/api/owner/notifications", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          markAllRead: true,
        }),
      });

      if (!response.ok) return;

      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          read: true,
        }))
      );
      setUnreadCount(0);
    } catch {
      // Keep the current state if the request fails.
    }
  }

  useEffect(() => {
    if (!loading && isOwner) {
      void loadNotifications();
    }
  }, [loading, isOwner, user]);

  useEffect(() => {
    if (!isOwner) return;

    const refreshNotifications = () => {
      void loadNotifications();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshNotifications();
      }
    };

    const interval = window.setInterval(refreshNotifications, 15000);

    window.addEventListener("focus", refreshNotifications);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshNotifications);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isOwner, user]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () =>
      document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  if (loading || !isOwner) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);

          if (!open) {
            void loadNotifications();
          }
        }}
        aria-label="Owner notifications"
        className="relative grid h-11 w-11 place-items-center rounded-full border border-violet-400/30 bg-violet-500/10 text-xl text-violet-100 transition hover:bg-violet-500/20 hover:text-white"
      >
        <span aria-hidden="true">&#128276;</span>

        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full border-2 border-[#10101b] bg-fuchsia-500 px-1 text-center text-[10px] font-black leading-none text-white shadow-lg">
            {badgeText}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute left-0 top-14 z-[80] w-[min(92vw,420px)] overflow-hidden rounded-3xl border border-white/10 bg-[#10101b] shadow-2xl shadow-black/50">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <p className="text-sm font-black text-white">
                Owner Notifications
              </p>
              <p className="mt-1 text-xs text-white/45">
                {unreadCount} unread
              </p>
            </div>

            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-bold text-violet-300 hover:text-white"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="max-h-[430px] overflow-y-auto">
            {fetching && !hasNotifications ? (
              <p className="px-5 py-8 text-center text-sm text-white/50">
                Loading notifications...
              </p>
            ) : error ? (
              <div className="px-5 py-6">
                <p className="text-sm text-red-300">{error}</p>
                <button
                  type="button"
                  onClick={() => void loadNotifications()}
                  className="mt-3 text-xs font-black text-violet-300 hover:text-white"
                >
                  Try again
                </button>
              </div>
            ) : !hasNotifications ? (
              <p className="px-5 py-8 text-center text-sm text-white/50">
                No notifications yet.
              </p>
            ) : (
              notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href={notification.targetUrl}
                  onClick={() => {
                    void markAsRead(notification);
                    setOpen(false);
                  }}
                  className={`block border-b border-white/5 px-5 py-4 transition last:border-b-0 hover:bg-white/5 ${
                    notification.read
                      ? "bg-transparent"
                      : "bg-violet-500/10"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                        notification.read
                          ? "bg-white/20"
                          : "bg-fuchsia-400"
                      }`}
                    />

                    <span className="min-w-0">
                      <span className="block text-sm font-black text-white">
                        {notification.title}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-white/60">
                        {notification.message}
                      </span>
                      <span className="mt-2 block text-[11px] font-bold text-white/35">
                        {formatNotificationTime(notification.createdAt)}
                      </span>
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>

          <Link
            href="/developer"
            onClick={() => setOpen(false)}
            className="block border-t border-white/10 px-5 py-4 text-center text-xs font-black text-violet-300 hover:bg-white/5 hover:text-white"
          >
            Open Owner Dashboard
          </Link>
        </div>
      ) : null}
    </div>
  );
}





