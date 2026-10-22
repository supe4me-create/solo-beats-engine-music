"use client";

import Link from "next/link";
import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";

import { useAuth } from "../../auth/AuthContext";

type Member = {
  uid: string;
  username: string;
  displayName: string;
  photoURL: string;
};

type Conversation = {
  id: string;
  type: "dm" | "group";
  title: string;
  createdBy: string;
  memberUids: string[];
  members: Member[];
  lastMessageText: string;
  lastMessageAt: string | null;
  updatedAt: string | null;
  unreadCount: number;
};

type ChatMessage = {
  id: string;
  conversationId: string;
  senderUid: string;
  username: string;
  displayName: string;
  photoURL: string;
  text: string;
  deleted: boolean;
  createdAt: string | null;
  editedAt: string | null;
};

function timeLabel(value: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SoloConnectMessagesContent() {
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
  const [groupTitle, setGroupTitle] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState("");
  const [editingMessageText, setEditingMessageText] = useState("");
  const [renamingGroup, setRenamingGroup] = useState(false);
  const [groupRename, setGroupRename] = useState("");

  const startedTargetRef = useRef("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (!user) return {};

    const token = await user.getIdToken();

    return {
      Authorization: `Bearer ${token}`,
    };
  }, [user]);

  const loadConversations = useCallback(async () => {
    if (!user) {
      setConversations([]);
      return;
    }

    const headers = await authHeaders();

    const response = await fetch("/api/connect/messages?mode=conversations", {
      headers,
      cache: "no-store",
    });

    const data = await response.json();

    if (response.ok && data.success) {
      const next = Array.isArray(data.conversations)
        ? data.conversations
        : [];

      setConversations(next);

      if (!activeId && next.length > 0) {
        setActiveId(next[0].id);
      }
    }
  }, [user, authHeaders, activeId]);

  const loadMessages = useCallback(async () => {
    if (!user || !activeId) {
      setMessages([]);
      return;
    }

    const headers = await authHeaders();

    const response = await fetch(
      `/api/connect/messages?mode=messages&conversationId=${encodeURIComponent(
        activeId
      )}`,
      {
        headers,
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (response.ok && data.success) {
      setMessages(
        Array.isArray(data.messages)
          ? data.messages
          : []
      );
    }
  }, [user, activeId, authHeaders]);

  useEffect(() => {
    void loadConversations();

    if (!user) return;

    const timer = window.setInterval(() => {
      void loadConversations();
    }, 2500);

    return () => window.clearInterval(timer);
  }, [user, loadConversations]);

  useEffect(() => {
    void loadMessages();

    if (!user || !activeId) return;

    const timer = window.setInterval(() => {
      void loadMessages();
    }, 1500);

    return () => window.clearInterval(timer);
  }, [user, activeId, loadMessages]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      bottomRef.current?.scrollIntoView({
        behavior: "smooth",
      });
    }, 100);

    return () => window.clearTimeout(timer);
  }, [messages.length, activeId]);

  useEffect(() => {
    if (!user) return;

    const timer = window.setTimeout(async () => {
      const headers = await authHeaders();

      const response = await fetch(
        `/api/connect/messages?mode=members&q=${encodeURIComponent(
          memberQuery
        )}`,
        {
          headers,
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setMembers(
          Array.isArray(data.members)
            ? data.members
            : []
        );
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [memberQuery, user, authHeaders]);

  const startDm = useCallback(
    async (targetUid: string) => {
      if (!user || !targetUid) return;

      setWorking(true);
      setError("");

      try {
        const headers = await authHeaders();

        const response = await fetch("/api/connect/messages", {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "start_dm",
            targetUid,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.error || "Conversation could not be started."
          );
        }

        setActiveId(data.conversationId);
        setShowNewChat(false);
        setMemberQuery("");
        await loadConversations();
      } catch (startError) {
        setError(
          startError instanceof Error
            ? startError.message
            : "Conversation could not be started."
        );
      } finally {
        setWorking(false);
      }
    },
    [user, authHeaders, loadConversations]
  );

  useEffect(() => {
    const conversationId =
      searchParams.get("conversation") || "";

    if (conversationId) {
      setActiveId(conversationId);
    }
  }, [searchParams]);
  useEffect(() => {
    const targetUid = searchParams.get("to") || "";

    if (
      user &&
      targetUid &&
      startedTargetRef.current !== targetUid
    ) {
      startedTargetRef.current = targetUid;
      void startDm(targetUid);
    }
  }, [searchParams, user, startDm]);

  async function createGroup() {
    if (!user) return;

    if (selectedGroupMembers.length < 2) {
      setError("Choose at least 2 members for the group.");
      return;
    }

    setWorking(true);
    setError("");

    try {
      const headers = await authHeaders();

      const response = await fetch("/api/connect/messages", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "create_group",
          title: groupTitle,
          memberUids: selectedGroupMembers,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Group could not be created.");
      }

      setActiveId(data.conversationId);
      setGroupTitle("");
      setSelectedGroupMembers([]);
      setShowNewChat(false);
      await loadConversations();
    } catch (groupError) {
      setError(
        groupError instanceof Error
          ? groupError.message
          : "Group could not be created."
      );
    } finally {
      setWorking(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user || !activeId || !draft.trim()) return;

    const text = draft;
    setDraft("");
    setError("");

    const headers = await authHeaders();

    const response = await fetch("/api/connect/messages", {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "send",
        conversationId: activeId,
        text,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      setDraft(text);
      setError(data.error || "Message could not be sent.");
      return;
    }

    await loadMessages();
    await loadConversations();
  }

  async function saveMessageEdit() {
    if (!user || !editingMessageId || !editingMessageText.trim()) return;

    const headers = await authHeaders();

    const response = await fetch("/api/connect/messages", {
      method: "PATCH",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messageId: editingMessageId,
        text: editingMessageText,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      setError(data.error || "Message could not be edited.");
      return;
    }

    setEditingMessageId("");
    setEditingMessageText("");
    await loadMessages();
    await loadConversations();
  }

  async function deleteMessage(messageId: string) {
    if (!user) return;

    if (!window.confirm("Delete this message?")) return;

    const headers = await authHeaders();

    const response = await fetch(
      `/api/connect/messages?messageId=${encodeURIComponent(
        messageId
      )}`,
      {
        method: "DELETE",
        headers,
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      setError(data.error || "Message could not be deleted.");
      return;
    }

    await loadMessages();
    await loadConversations();
  }

  async function saveGroupRename() {
    const active = conversations.find(item => item.id === activeId);

    if (!user || !active || active.type !== "group" || !groupRename.trim()) {
      return;
    }

    const headers = await authHeaders();

    const response = await fetch("/api/connect/messages", {
      method: "PATCH",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "rename_group",
        conversationId: activeId,
        title: groupRename,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      setError(data.error || "Group could not be renamed.");
      return;
    }

    setRenamingGroup(false);
    setGroupRename("");
    await loadConversations();
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center">
        Loading SOLO CONNECT Messages...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen px-4 py-16">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.04] p-8">
          <h1 className="text-3xl font-black">SOLO CONNECT MESSAGES</h1>
          <p className="mt-3 text-white/60">
            Sign in to use private messaging.
          </p>
          <Link
            href="/account?mode=signin"
            className="mt-5 inline-flex rounded-xl bg-white px-5 py-3 font-black text-black"
          >
            SIGN IN
          </Link>
        </div>
      </main>
    );
  }

  const active = conversations.find(item => item.id === activeId) || null;

  return (
    <main className="min-h-screen px-3 pb-24 pt-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href="/connect"
              className="text-sm font-black text-cyan-300"
            >
              SOLO CONNECT
            </Link>
            <h1 className="mt-2 text-4xl font-black">
              MESSAGES
            </h1>
            <p className="mt-1 text-sm text-white/45">
              Private chats and group conversations.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowNewChat(value => !value)}
            className="rounded-xl bg-white px-5 py-3 font-black text-black"
          >
            {showNewChat ? "CLOSE" : "NEW CHAT"}
          </button>
        </div>

        {error ? (
          <p className="mb-4 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">
            {error}
          </p>
        ) : null}

        {showNewChat ? (
          <section className="mb-5 rounded-3xl border border-cyan-400/20 bg-cyan-400/[0.04] p-5">
            <h2 className="text-xl font-black">START A CHAT</h2>

            <input
              value={memberQuery}
              onChange={event => setMemberQuery(event.target.value)}
              placeholder="Search members by name or username..."
              className="mt-4 w-full rounded-xl border border-white/10 bg-black px-4 py-3"
            />

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {members.map(member => {
                const selected = selectedGroupMembers.includes(member.uid);

                return (
                  <div
                    key={member.uid}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 p-3"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-violet-500 font-black">
                      {member.photoURL ? (
                        <img
                          src={member.photoURL}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        (member.displayName || member.username || "SB")
                          .slice(0, 2)
                          .toUpperCase()
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black">
                        {member.displayName || member.username}
                      </p>
                      <p className="truncate text-xs text-white/45">
                        @{member.username}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={working}
                      onClick={() => void startDm(member.uid)}
                      className="rounded-lg bg-white px-3 py-2 text-xs font-black text-black"
                    >
                      DM
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setSelectedGroupMembers(current =>
                          selected
                            ? current.filter(uid => uid !== member.uid)
                            : [...current, member.uid]
                        )
                      }
                      className={`rounded-lg border px-3 py-2 text-xs font-black ${
                        selected
                          ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-200"
                          : "border-white/10"
                      }`}
                    >
                      {selected ? "ADDED" : "GROUP"}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input
                value={groupTitle}
                onChange={event => setGroupTitle(event.target.value)}
                placeholder="Group name"
                maxLength={100}
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black px-4 py-3"
              />

              <button
                type="button"
                disabled={working || selectedGroupMembers.length < 2}
                onClick={() => void createGroup()}
                className="rounded-xl bg-emerald-300 px-5 py-3 font-black text-black disabled:opacity-40"
              >
                CREATE GROUP ({selectedGroupMembers.length})
              </button>
            </div>
          </section>
        ) : null}

        <div className="grid min-h-[70vh] gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-3xl border border-white/10 bg-[#0c0c13]">
            <div className="border-b border-white/10 p-4">
              <h2 className="font-black">CONVERSATIONS</h2>
            </div>

            <div className="max-h-[72vh] overflow-y-auto p-2">
              {conversations.map(conversation => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setActiveId(conversation.id)}
                  className={`mb-2 w-full rounded-2xl p-4 text-left ${
                    activeId === conversation.id
                      ? "bg-violet-500/20 ring-1 ring-violet-400/30"
                      : "bg-white/[0.035] hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black">
                        {conversation.title}
                      </p>
                      <p className="mt-1 truncate text-sm text-white/45">
                        {conversation.lastMessageText || "No messages yet"}
                      </p>
                    </div>

                    {conversation.unreadCount > 0 ? (
                      <span className="grid min-w-7 place-items-center rounded-full bg-red-500 px-2 py-1 text-xs font-black text-white">
                        {conversation.unreadCount}
                      </span>
                    ) : null}
                  </div>
                </button>
              ))}

              {conversations.length === 0 ? (
                <p className="p-5 text-sm text-white/40">
                  No conversations yet. Start a new chat.
                </p>
              ) : null}
            </div>
          </aside>

          <section className="flex min-h-[70vh] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0c0c13]">
            {active ? (
              <>
                <header className="border-b border-white/10 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-black">
                        {active.title}
                      </h2>
                      <p className="text-xs text-white/40">
                        {active.type === "group"
                          ? `${active.memberUids.length} members`
                          : "Private conversation"}
                      </p>
                    </div>

                    {active.type === "group" &&
                    active.createdBy === user.uid ? (
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingGroup(true);
                          setGroupRename(active.title);
                        }}
                        className="rounded-lg border border-white/10 px-3 py-2 text-xs font-black"
                      >
                        RENAME GROUP
                      </button>
                    ) : null}
                  </div>

                  {renamingGroup &&
                  active.type === "group" &&
                  active.createdBy === user.uid ? (
                    <div className="mt-3 flex gap-2">
                      <input
                        value={groupRename}
                        onChange={event => setGroupRename(event.target.value)}
                        maxLength={100}
                        className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black px-3 py-2"
                      />
                      <button
                        type="button"
                        onClick={() => void saveGroupRename()}
                        className="rounded-xl bg-white px-4 py-2 font-black text-black"
                      >
                        SAVE
                      </button>
                    </div>
                  ) : null}
                </header>

                <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
                  {messages.map(message => {
                    const mine = message.senderUid === user.uid;

                    return (
                      <div
                        key={message.id}
                        className={`flex ${mine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl p-4 sm:max-w-[70%] ${
                            mine
                              ? "bg-violet-500/25"
                              : "bg-white/[0.06]"
                          }`}
                        >
                          {!mine ? (
                            <p className="mb-1 text-xs font-black text-cyan-300">
                              {message.displayName || message.username}
                            </p>
                          ) : null}

                          {editingMessageId === message.id ? (
                            <div className="flex gap-2">
                              <input
                                value={editingMessageText}
                                onChange={event =>
                                  setEditingMessageText(event.target.value)
                                }
                                className="min-w-0 flex-1 rounded-xl bg-black px-3 py-2"
                              />
                              <button
                                type="button"
                                onClick={() => void saveMessageEdit()}
                                className="rounded-xl bg-white px-3 py-2 text-xs font-black text-black"
                              >
                                SAVE
                              </button>
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap break-words">
                              {message.deleted
                                ? "Message deleted"
                                : message.text}
                            </p>
                          )}

                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/35">
                            <span>{timeLabel(message.createdAt)}</span>
                            {message.editedAt && !message.deleted ? (
                              <span>Edited</span>
                            ) : null}

                            {mine && !message.deleted ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingMessageId(message.id);
                                    setEditingMessageText(message.text);
                                  }}
                                  className="font-black text-cyan-300"
                                >
                                  EDIT
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void deleteMessage(message.id)}
                                  className="font-black text-red-300"
                                >
                                  DELETE
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div ref={bottomRef} />
                </div>

                <form
                  onSubmit={sendMessage}
                  className="border-t border-white/10 p-4"
                >
                  <div className="flex gap-2">
                    <textarea
                      value={draft}
                      maxLength={3000}
                      onChange={event => setDraft(event.target.value)}
                      placeholder="Write a private message..."
                      className="min-h-14 min-w-0 flex-1 resize-none rounded-2xl border border-white/10 bg-black px-4 py-3"
                    />

                    <button
                      type="submit"
                      disabled={!draft.trim()}
                      className="rounded-2xl bg-white px-5 font-black text-black disabled:opacity-40"
                    >
                      SEND
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="grid flex-1 place-items-center p-10 text-center text-white/40">
                Choose a conversation or start a new chat.
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

export default function SoloConnectMessagesPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-black text-white">
          <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4">
            <div className="text-center">
              <div className="text-xl font-black">SOLO CONNECT</div>
              <div className="mt-2 text-sm text-white/50">
                Loading messages...
              </div>
            </div>
          </div>
        </main>
      }
    >
      <SoloConnectMessagesContent />
    </Suspense>
  );
}