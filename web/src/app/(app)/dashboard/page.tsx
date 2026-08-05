"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Building2, Bird, Egg, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { formatNumber, formatKg } from "@/lib/utils";
import { Sparkline } from "@/components/charts/SimpleCharts";
import { useTranslations } from "next-intl";
import type { DashboardReport, EggProductionReport, Farm, Flock } from "@/types";

const TREND_DAYS = 14;

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildDateLabels(days: number) {
  const labels: string[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  for (let i = 0; i < days; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    labels.push(isoDate(d));
  }
  return labels;
}

function trendPercent(values: number[]) {
  if (values.length < 2) return 0;
  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;
  if (first === 0) return last === 0 ? 0 : 100;
  return ((last - first) / Math.abs(first)) * 100;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  trend,
  trendColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  trend: number[];
  trendColor: string;
}) {
  const pct = trendPercent(trend);
  const pctLabel = `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
      <div className="mb-3 flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <p className="text-sm font-medium text-gray-500">{label}</p>
      </div>

      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}

      <div className="mt-3 rounded-xl bg-gray-50 p-2">
        <Sparkline values={trend} color={trendColor} />
      </div>
      <p className={`mt-1 text-xs font-medium ${pct >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
        14d trend {pctLabel}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const dateLabels = useMemo(() => buildDateLabels(TREND_DAYS), []);
  const trendFrom = dateLabels[0];
  const trendTo = dateLabels[dateLabels.length - 1];

  const trendParams = new URLSearchParams({
    dateFrom: trendFrom,
    dateTo: trendTo,
  });

  const { data, isLoading, error } = useQuery<DashboardReport>({
    queryKey: ["dashboard"],
    queryFn: () => api.get("/api/v1/reports/dashboard").then((r) => r.data),
  });

  const { data: eggTrend } = useQuery<EggProductionReport>({
    queryKey: ["dashboard-eggs-trend", trendFrom, trendTo],
    queryFn: () => api.get(`/api/v1/reports/egg-production?${trendParams.toString()}`).then((r) => r.data),
  });

  const { data: farms = [] } = useQuery<Farm[]>({
    queryKey: ["dashboard-farms-trend"],
    queryFn: () => api.get("/api/v1/farms").then((r) => r.data),
  });

  const { data: flocks = [] } = useQuery<Flock[]>({
    queryKey: ["dashboard-flocks-trend"],
    queryFn: () => api.get("/api/v1/flocks").then((r) => r.data),
  });

  const eggsByDate = useMemo(() => {
    const map = new Map<string, { eggs: number; mortality: number }>();
    for (const row of eggTrend?.dailyTotals ?? []) {
      map.set(row.date, {
        eggs: row.eggsTotal,
        mortality: row.mortality,
      });
    }
    return map;
  }, [eggTrend]);

  const eggsTrend = useMemo(
    () => dateLabels.map((d) => eggsByDate.get(d)?.eggs ?? 0),
    [dateLabels, eggsByDate]
  );

  const mortalityTrend = useMemo(
    () => dateLabels.map((d) => eggsByDate.get(d)?.mortality ?? 0),
    [dateLabels, eggsByDate]
  );

  const farmsTrend = useMemo(
    () =>
      dateLabels.map((d) => {
        const end = new Date(`${d}T23:59:59.999Z`);
        return farms.filter((farm) => new Date(farm.createdAt) <= end).length;
      }),
    [dateLabels, farms]
  );

  const activeFlocksTrend = useMemo(
    () =>
      dateLabels.map((d) => {
        const end = new Date(`${d}T23:59:59.999Z`);
        return flocks.filter((flock) => flock.status === "active" && new Date(flock.arrivalDate) <= end).length;
      }),
    [dateLabels, flocks]
  );

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-52 rounded-2xl bg-gray-200" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl bg-red-50 p-6 text-sm text-red-700">
        {t("failedLoad")}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("overviewFor", {
            date: new Date(data.today.date).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
          })}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Building2}
          label={t("farms")}
          value={data.farmCount}
          color="bg-blue-500"
          trend={farmsTrend}
          trendColor="#3b82f6"
        />
        <StatCard
          icon={Bird}
          label={t("activeFlocks")}
          value={data.activeFlocksCount}
          sub={t("liveBirds", { count: formatNumber(data.totalActiveBirds) })}
          color="bg-green-500"
          trend={activeFlocksTrend}
          trendColor="#10b981"
        />
        <StatCard
          icon={Egg}
          label={t("todayEggs")}
          value={formatNumber(data.today.eggsTotal)}
          sub={t("flocksRecorded", { count: data.today.recordedFlocks })}
          color="bg-amber-500"
          trend={eggsTrend}
          trendColor="#f59e0b"
        />
        <StatCard
          icon={AlertTriangle}
          label={t("mortality")}
          value={formatNumber(data.today.mortality)}
          color={data.today.mortality > 0 ? "bg-rose-500" : "bg-gray-400"}
          trend={mortalityTrend}
          trendColor="#ef4444"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-4 text-base font-semibold text-gray-900">{t("todayProduction")}</h2>
          <dl className="space-y-3">
            {[
              [t("eggsCollected"), formatNumber(data.today.eggsTotal)],
              [t("eggsBroken"), formatNumber(data.today.eggsBroken)],
              [t("eggsSold"), formatNumber(data.today.eggsSold)],
              [t("mortality"), formatNumber(data.today.mortality)],
              [t("feedConsumed"), formatKg(data.today.feedConsumedKg)],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between text-sm">
                <dt className="text-gray-500">{label}</dt>
                <dd className="font-medium text-gray-900">{val}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">{t("lowStockAlerts")}</h2>
            <Link href="/feed" className="text-xs font-medium text-green-600 hover:underline">
              {tc("viewAll")}
            </Link>
          </div>
          {data.lowStockAlerts.length === 0 ? (
            <p className="text-sm text-gray-400">{t("allWellStocked")}</p>
          ) : (
            <ul className="space-y-3">
              {data.lowStockAlerts.map((item) => (
                <li key={item.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-400">{t("threshold", { value: formatKg(item.lowStockThresholdKg) })}</p>
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

      <div>
        <h2 className="mb-3 text-base font-semibold text-gray-900">{t("quickActions")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { href: "/farms", label: t("manageFarms") },
            { href: "/flocks", label: t("viewFlocks") },
            { href: "/feed", label: t("feedInventory") },
            { href: "/reports", label: t("reports") },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-sm font-medium text-gray-700 transition-colors hover:border-green-300 hover:text-green-700"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
