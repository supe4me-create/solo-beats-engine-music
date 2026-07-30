"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../../auth/AuthContext";

const OWNER_EMAIL = "supe4.me@gmail.com";

type CustomerOrderItem = {
  name: string;
  itemType: "album" | "track" | null;
  itemId: string | null;
  quantity: number;
};

type CustomerOrder = {
  orderId: string;
  amount: number;
  currency: string;
  purchasedAt: string | null;
  itemCount: number;
  items: CustomerOrderItem[];
};

type Customer = {
  key: string;
  customerUid: string | null;
  name: string;
  email: string | null;
  totalOrders: number;
  albumsPurchased: number;
  tracksPurchased: number;
  totalSpent: number;
  latestPurchaseAt: string | null;
  orders: CustomerOrder[];
};

function formatMoney(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

function formatDate(value: string | null) {
  if (!value) return "No purchase date";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No purchase date";

  return date.toLocaleString("en-US");
}

export default function CustomersPage() {
  const { user, loading } = useAuth();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] =
    useState<Customer | null>(null);
  const [search, setSearch] = useState("");
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || user.email?.toLowerCase() !== OWNER_EMAIL) {
      setCustomers([]);
      return;
    }

    const currentUser = user;
    let cancelled = false;

    async function loadCustomers() {
      setLoadingCustomers(true);
      setError("");

      try {
        const token = await currentUser.getIdToken();
        const response = await fetch("/api/owner/customers", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Customers could not be loaded.");
        }

        if (!cancelled) {
          setCustomers(
            Array.isArray(data.customers) ? data.customers : []
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Customers could not be loaded."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingCustomers(false);
        }
      }
    }

    void loadCustomers();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return customers;

    return customers.filter((customer) =>
      [
        customer.name,
        customer.email || "",
        customer.customerUid || "",
        ...customer.orders.map((order) => order.orderId),
        ...customer.orders.flatMap((order) =>
          order.items.map((item) => item.name)
        ),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [customers, search]);

  const totalRevenue = useMemo(
    () =>
      customers.reduce(
        (total, customer) => total + customer.totalSpent,
        0
      ),
    [customers]
  );

  const totalOrders = useMemo(
    () =>
      customers.reduce(
        (total, customer) => total + customer.totalOrders,
        0
      ),
    [customers]
  );

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <p className="text-white/70">Loading customers...</p>
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
                Customers
              </h1>
              <p className="mt-4 max-w-3xl text-white/65">
                Review each customer’s orders, purchased albums and tracks,
                total spending, and complete purchase history.
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
          <Stat label="Customers" value={customers.length} />
          <Stat label="Completed orders" value={totalOrders} />
          <Stat label="Total revenue" value={formatMoney(totalRevenue)} />
        </section>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by customer, email, account ID, order, or purchased item..."
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none placeholder:text-white/35 focus:border-violet-400"
          />
        </section>

        {error ? (
          <p className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">
            {error}
          </p>
        ) : null}

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          {loadingCustomers ? (
            <p className="text-white/50">Loading customers...</p>
          ) : filteredCustomers.length === 0 ? (
            <div className="rounded-[2rem] border border-dashed border-white/15 bg-white/[0.025] p-10 text-center lg:col-span-2">
              <h2 className="text-2xl font-black">No customers found</h2>
            </div>
          ) : (
            filteredCustomers.map((customer) => (
              <button
                type="button"
                key={customer.key}
                onClick={() => setSelectedCustomer(customer)}
                className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 text-left transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-violet-400"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-2xl font-black">
                      {customer.name}
                    </h2>
                    <p className="mt-2 truncate text-sm text-white/50">
                      {customer.email || "No customer email"}
                    </p>
                  </div>

                  <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-black text-white">
                    View history
                  </span>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-4">
                  <MiniStat label="Orders" value={customer.totalOrders} />
                  <MiniStat label="Albums" value={customer.albumsPurchased} />
                  <MiniStat label="Tracks" value={customer.tracksPurchased} />
                  <MiniStat
                    label="Spent"
                    value={formatMoney(customer.totalSpent)}
                  />
                </div>

                <p className="mt-5 text-xs text-white/35">
                  Latest purchase: {formatDate(customer.latestPurchaseAt)}
                </p>
              </button>
            ))
          )}
        </section>

        {selectedCustomer ? (
          <section className="mt-8 rounded-[2rem] border border-violet-400/25 bg-gradient-to-br from-violet-500/15 via-white/[0.035] to-cyan-400/10 p-6 shadow-2xl sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-violet-300">
                  Customer history
                </p>
                <h2 className="mt-2 text-3xl font-black">
                  {selectedCustomer.name}
                </h2>
                <p className="mt-2 text-sm text-white/45">
                  {selectedCustomer.email || "No customer email"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-black text-white"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Detail label="Account ID" value={selectedCustomer.customerUid || "Not available"} />
              <Detail label="Total orders" value={String(selectedCustomer.totalOrders)} />
              <Detail label="Albums purchased" value={String(selectedCustomer.albumsPurchased)} />
              <Detail label="Tracks purchased" value={String(selectedCustomer.tracksPurchased)} />
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
              <div className="grid gap-3 border-b border-white/10 bg-black/20 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <h3 className="text-xl font-black">Purchase history</h3>
                <p className="text-2xl font-black">
                  {formatMoney(selectedCustomer.totalSpent)}
                </p>
              </div>

              <div className="divide-y divide-white/10">
                {selectedCustomer.orders.map((order) => (
                  <div key={order.orderId} className="p-5">
                    <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                      <div>
                        <p className="font-black">Order {order.orderId}</p>
                        <p className="mt-1 text-sm text-white/45">
                          {formatDate(order.purchasedAt)}
                        </p>
                      </div>

                      <p className="text-lg font-black">
                        {formatMoney(order.amount, order.currency)}
                      </p>
                    </div>

                    <div className="mt-4 grid gap-2">
                      {order.items.map((item, index) => (
                        <div
                          key={`${order.orderId}-${item.itemId || index}`}
                          className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                        >
                          <div>
                            <p className="font-bold">{item.name}</p>
                            <p className="mt-1 text-xs text-white/35">
                              {item.itemType || "Item"}
                              {item.itemId ? ` · ${item.itemId}` : ""}
                            </p>
                          </div>

                          <span className="text-sm font-black">
                            Qty {item.quantity}
                          </span>
                        </div>
                      ))}
                    </div>
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

function Stat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <p className="text-sm text-white/50">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs text-white/40">{label}</p>
      <p className="mt-2 font-black">{value}</p>
    </div>
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
