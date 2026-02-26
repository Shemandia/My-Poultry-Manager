"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Building2, Bird, Egg, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { formatNumber, formatKg } from "@/lib/utils";
import type { DashboardReport } from "@/types";

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
      <div className="flex items-center gap-3 mb-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <p className="text-sm font-medium text-gray-500">{label}</p>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery<DashboardReport>({
    queryKey: ["dashboard"],
    queryFn: () => api.get("/api/v1/reports/dashboard").then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="grid grid-cols-4 gap-4 mt-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-36 rounded-2xl bg-gray-200" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl bg-red-50 p-6 text-sm text-red-700">
        Failed to load dashboard data.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Overview for {new Date(data.today.date).toLocaleDateString("en-US", {
            weekday: "long", year: "numeric", month: "long", day: "numeric",
          })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Building2}
          label="Farms"
          value={data.farmCount}
          color="bg-blue-500"
        />
        <StatCard
          icon={Bird}
          label="Active Flocks"
          value={data.activeFlocksCount}
          sub={`${formatNumber(data.totalActiveBirds)} live birds`}
          color="bg-green-500"
        />
        <StatCard
          icon={Egg}
          label="Today's Eggs"
          value={formatNumber(data.today.eggsTotal)}
          sub={`${data.today.recordedFlocks} flock(s) recorded`}
          color="bg-yellow-500"
        />
        <StatCard
          icon={AlertTriangle}
          label="Low Stock Alerts"
          value={data.lowStockAlerts.length}
          sub={data.lowStockAlerts.length ? "Feed items need restocking" : "All stocked"}
          color={data.lowStockAlerts.length > 0 ? "bg-red-500" : "bg-gray-400"}
        />
      </div>

      {/* Today's summary */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Today&apos;s Production</h2>
          <dl className="space-y-3">
            {[
              ["Eggs Collected", formatNumber(data.today.eggsTotal)],
              ["Eggs Broken", formatNumber(data.today.eggsBroken)],
              ["Eggs Sold", formatNumber(data.today.eggsSold)],
              ["Mortality", formatNumber(data.today.mortality)],
              ["Feed Consumed", formatKg(data.today.feedConsumedKg)],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between text-sm">
                <dt className="text-gray-500">{label}</dt>
                <dd className="font-medium text-gray-900">{val}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Low stock */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Low Stock Alerts</h2>
            <Link href="/feed" className="text-xs font-medium text-green-600 hover:underline">
              View all →
            </Link>
          </div>
          {data.lowStockAlerts.length === 0 ? (
            <p className="text-sm text-gray-400">All feed items are well stocked.</p>
          ) : (
            <ul className="space-y-3">
              {data.lowStockAlerts.map((item) => (
                <li key={item.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-400">
                      Threshold: {formatKg(item.lowStockThresholdKg)}
                    </p>
                  </div>
                  <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                    {formatKg(item.currentStockKg)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { href: "/farms", label: "Manage Farms" },
            { href: "/flocks", label: "View Flocks" },
            { href: "/feed", label: "Feed Inventory" },
            { href: "/reports", label: "Reports" },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:border-green-300 hover:text-green-700 transition-colors text-center"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
