"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../../auth/AuthContext";

const OWNER_EMAIL = "supe4.me@gmail.com";

type OrderItem = {
  name: string;
  description: string | null;
  sku: string | null;
  itemType: "album" | "track" | null;
  itemId: string | null;
  quantity: number;
  unitAmount: string | null;
  currency: string;
};

type OwnerOrder = {
  orderId: string;
  captureId: string | null;
  payerId: string | null;
  customerUid: string | null;
  customer: string;
  customerEmail: string | null;
  amount: number;
  currency: string;
  purchasedAt: string | null;
  itemCount: number;
  items: OrderItem[];
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(amount);
}

function formatDate(value: string | null) {
  if (!value) return "Completed purchase";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Completed purchase";

  return date.toLocaleString("en-US");
}

export default function OwnerOrdersPage() {
  const { user, loading } = useAuth();

  const [orders, setOrders] = useState<OwnerOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OwnerOrder | null>(null);
  const [search, setSearch] = useState("");
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || user.email?.toLowerCase() !== OWNER_EMAIL) {
      setOrders([]);
      return;
    }

    const currentUser = user;
    let cancelled = false;

    async function loadOrders() {
      setLoadingOrders(true);
      setError("");

      try {
        const token = await currentUser.getIdToken();
        const response = await fetch("/api/owner/orders", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Orders could not be loaded.");
        }

        if (!cancelled) {
          setOrders(Array.isArray(data.orders) ? data.orders : []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Orders could not be loaded."
          );
        }
      } finally {
        if (!cancelled) setLoadingOrders(false);
      }
    }

    void loadOrders();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return orders;

    return orders.filter((order) => {
      const itemText = order.items
        .map((item) => `${item.name} ${item.itemId || ""} ${item.sku || ""}`)
        .join(" ");

      return [
        order.orderId,
        order.captureId || "",
        order.payerId || "",
        order.customer,
        order.customerEmail || "",
        itemText,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [orders, search]);

  const totalRevenue = useMemo(
    () => orders.reduce((total, order) => total + order.amount, 0),
    [orders]
  );

  const uniqueCustomers = useMemo(() => {
    const keys = new Set<string>();

    for (const order of orders) {
      if (order.customerUid) {
        keys.add(`uid:${order.customerUid}`);
      } else if (order.customerEmail) {
        keys.add(`email:${order.customerEmail.toLowerCase()}`);
      }
    }

    return keys.size;
  }, [orders]);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <p className="text-white/70">Loading orders...</p>
      </main>
    );
  }

  if (!user || user.email?.toLowerCase() !== OWNER_EMAIL) {
    return (
      <main className="grid min-h-screen place-items-center px-5 pb-20 pt-52">
        <section className="w-full max-w-xl rounded-[2rem] border border-red-400/20 bg-red-400/10 p-8 text-center">
          <h1 className="text-4xl font-black">Owner access only</h1>
          <Link
            href="/account"
            className="mt-7 inline-flex rounded-2xl bg-white px-6 py-4 font-black text-black"
          >
            Open Account
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 pb-40 pt-52 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-violet-500/25 via-white/[0.04] to-cyan-400/10 p-7 shadow-2xl sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-300">
                Owner dashboard
              </p>
              <h1 className="mt-3 text-4xl font-black sm:text-6xl">
                Orders & Customers
              </h1>
              <p className="mt-4 max-w-3xl text-white/65">
                Search completed PayPal purchases, inspect customer details, and review every purchased album and track.
              </p>
            </div>

            <Link
              href="/developer"
              className="rounded-2xl bg-white px-6 py-4 font-black text-black"
            >
              Back to Dashboard
            </Link>
          </div>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-white/50">Completed orders</p>
            <p className="mt-2 text-3xl font-black">{orders.length}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-white/50">Customers</p>
            <p className="mt-2 text-3xl font-black">{uniqueCustomers}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-white/50">Total revenue</p>
            <p className="mt-2 text-3xl font-black">
              {formatMoney(totalRevenue, "USD")}
            </p>
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by customer, email, order ID, item, SKU, or PayPal ID..."
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none placeholder:text-white/35 focus:border-violet-400"
          />
        </section>

        {error ? (
          <p className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">
            {error}
          </p>
        ) : null}

        <section className="mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03]">
          <div className="border-b border-white/10 bg-black/20 px-5 py-4">
            <h2 className="text-2xl font-black">
              {loadingOrders
                ? "Loading orders..."
                : `${filteredOrders.length} completed ${
                    filteredOrders.length === 1 ? "order" : "orders"
                  }`}
            </h2>
          </div>

          {filteredOrders.length === 0 && !loadingOrders ? (
            <p className="p-8 text-center text-white/50">
              No matching completed orders found.
            </p>
          ) : (
            <div className="divide-y divide-white/10">
              {filteredOrders.map((order) => (
                <button
                  type="button"
                  key={order.orderId}
                  onClick={() => setSelectedOrder(order)}
                  className="grid w-full gap-4 p-5 text-left transition hover:bg-white/[0.04] md:grid-cols-[1fr_auto_auto_auto] md:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate font-black">{order.customer}</p>
                    <p className="mt-1 truncate text-sm text-white/45">
                      {order.customerEmail || "No customer email"}
                    </p>
                    <p className="mt-1 truncate text-xs text-white/30">
                      Order {order.orderId}
                    </p>
                  </div>

                  <p className="text-sm text-white/55">
                    {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                  </p>

                  <div className="md:text-right">
                    <p className="font-black">
                      {formatMoney(order.amount, order.currency)}
                    </p>
                    <p className="mt-1 text-xs text-white/40">
                      {formatDate(order.purchasedAt)}
                    </p>
                  </div>

                  <span className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center font-black text-white">
                    View details
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {selectedOrder ? (
          <section className="mt-8 rounded-[2rem] border border-violet-400/25 bg-gradient-to-br from-violet-500/15 via-white/[0.035] to-cyan-400/10 p-6 shadow-2xl sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-violet-300">
                  Order details
                </p>
                <h2 className="mt-2 text-3xl font-black">
                  {selectedOrder.customer}
                </h2>
                <p className="mt-2 text-sm text-white/45">
                  Order {selectedOrder.orderId}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-black text-white"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Detail label="Customer email" value={selectedOrder.customerEmail || "Not available"} />
              <Detail label="Capture ID" value={selectedOrder.captureId || "Not available"} />
              <Detail label="Payer ID" value={selectedOrder.payerId || "Not available"} />
              <Detail label="Purchase date" value={formatDate(selectedOrder.purchasedAt)} />
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
              <div className="grid gap-3 border-b border-white/10 bg-black/20 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <h3 className="text-xl font-black">Purchased items</h3>
                <p className="text-2xl font-black">
                  {formatMoney(selectedOrder.amount, selectedOrder.currency)}
                </p>
              </div>

              <div className="divide-y divide-white/10">
                {selectedOrder.items.map((item, index) => (
                  <div
                    key={`${selectedOrder.orderId}-${item.itemId || item.sku || index}`}
                    className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-violet-300">
                          {item.itemType || "Item"}
                        </span>
                        <span className="text-xs text-white/40">
                          Quantity {item.quantity}
                        </span>
                      </div>

                      <h4 className="mt-3 truncate text-lg font-black">
                        {item.name}
                      </h4>

                      {item.description ? (
                        <p className="mt-1 text-sm text-white/45">
                          {item.description}
                        </p>
                      ) : null}

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/35">
                        {item.itemId ? <span>Item ID: {item.itemId}</span> : null}
                        {item.sku ? <span>SKU: {item.sku}</span> : null}
                      </div>
                    </div>

                    <p className="font-black">
                      {item.unitAmount
                        ? formatMoney(
                            Number(item.unitAmount) * item.quantity,
                            item.currency
                          )
                        : "Paid"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <p className="text-sm text-white/45">{label}</p>
      <p className="mt-2 break-all font-bold text-white/85">{value}</p>
    </div>
  );
}
