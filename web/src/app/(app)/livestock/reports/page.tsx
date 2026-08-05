"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import type { Farm } from "@/types";

const LABEL = "block text-sm font-medium text-gray-700 mb-1";
const INPUT = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100";

interface HerdSummary {
  bySpecies: { speciesId: string; speciesName: string; alive: number; sold: number; dead: number; culled: number; total: number }[];
}
interface MilkSummary {
  totalLitres: number;
  avgDailyLitres: number;
  bySpecies: { speciesId: string; speciesName: string; totalLitres: number }[];
  recent: { date: string; litres: number }[];
}
interface BreedingSummary {
  pregnancies: { suspected: number; confirmed: number; gaveBirth: number; aborted: number; notPregnant: number };
  dueSoon: { damId: string; expectedDueDate: string; status: string }[];
}
interface TransactionSummary {
  totalPurchased: number;
  totalSold: number;
  totalSpent: number;
  totalEarned: number;
  netFlow: number;
}

function StatCard({ label, value, sub, color = "text-gray-900" }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="text-center">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
      {children}
    </div>
  );
}

export default function LivestockReportsPage() {
  const t = useTranslations("liveReports");

  const [farmId, setFarmId] = useState("");
  const [milkDays, setMilkDays] = useState(30);

  const { data: farms = [] } = useQuery<Farm[]>({
    queryKey: ["farms"],
    queryFn: () => api.get("/api/v1/farms").then(r => r.data),
  });

  const enabled = !!farmId;

  const { data: herd, isLoading: herdLoading } = useQuery<HerdSummary>({
    queryKey: ["livestock-report-herd", farmId],
    queryFn: () => api.get("/api/v1/livestock/reports/herd-summary", { params: { farmId } }).then(r => r.data),
    enabled,
  });

  const { data: milk, isLoading: milkLoading } = useQuery<MilkSummary>({
    queryKey: ["livestock-report-milk", farmId, milkDays],
    queryFn: () => api.get("/api/v1/livestock/reports/milk-summary", { params: { farmId, days: milkDays } }).then(r => r.data),
    enabled,
  });

  const { data: breeding, isLoading: breedingLoading } = useQuery<BreedingSummary>({
    queryKey: ["livestock-report-breeding", farmId],
    queryFn: () => api.get("/api/v1/livestock/reports/breeding-summary", { params: { farmId } }).then(r => r.data),
    enabled,
  });

  const { data: txSummary, isLoading: txLoading } = useQuery<TransactionSummary>({
    queryKey: ["livestock-report-tx", farmId],
    queryFn: () => api.get("/api/v1/livestock/reports/transaction-summary", { params: { farmId } }).then(r => r.data),
    enabled,
  });

  const fmt = (n: number) => n.toLocaleString();
  const fmtDec = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t("subtitle")}</p>
      </div>

      {/* Farm selector */}
      <div className="w-56">
        <label htmlFor="lr-farm-select" className={LABEL}>{t("farm")}</label>
        <select id="lr-farm-select" value={farmId} onChange={e => setFarmId(e.target.value)} className={INPUT}>
          <option value="">Choose a farm…</option>
          {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>

      {!farmId && (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-200">
          <p className="text-sm text-gray-400">{t("selectFarmPrompt")}</p>
        </div>
      )}

      {farmId && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* Herd Summary */}
          <Card title={t("herdSummary")}>
            {herdLoading ? (
              <div className="animate-pulse h-24 rounded-lg bg-gray-100" />
            ) : !herd || herd.bySpecies.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No animals recorded.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-100">
                      <th className="text-left pb-2 font-medium">{t("headers.species")}</th>
                      <th className="text-right pb-2 font-medium text-green-600">{t("headers.alive")}</th>
                      <th className="text-right pb-2 font-medium text-blue-600">{t("headers.sold")}</th>
                      <th className="text-right pb-2 font-medium text-gray-500">{t("headers.dead")}</th>
                      <th className="text-right pb-2 font-medium text-red-500">{t("headers.culled")}</th>
                      <th className="text-right pb-2 font-medium">{t("headers.total")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {herd.bySpecies.map(row => (
                      <tr key={row.speciesId}>
                        <td className="py-2 font-medium text-gray-800">{row.speciesName}</td>
                        <td className="py-2 text-right text-green-700">{fmt(row.alive)}</td>
                        <td className="py-2 text-right text-blue-600">{fmt(row.sold)}</td>
                        <td className="py-2 text-right text-gray-500">{fmt(row.dead)}</td>
                        <td className="py-2 text-right text-red-500">{fmt(row.culled)}</td>
                        <td className="py-2 text-right font-semibold">{fmt(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Milk Production */}
          <Card title={t("milkProduction")}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-1">
                {([7, 30, 90] as const).map(d => (
                  <button key={d} type="button" onClick={() => setMilkDays(d)}
                    className={`rounded px-2.5 py-0.5 text-xs font-medium transition-colors ${milkDays === d ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                    {d === 7 ? t("periods.7d") : d === 30 ? t("periods.30d") : t("periods.90d")}
                  </button>
                ))}
              </div>
            </div>
            {milkLoading ? (
              <div className="animate-pulse h-24 rounded-lg bg-gray-100" />
            ) : !milk || milk.totalLitres === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No milk records in this period.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <StatCard label={t("milkStats.total", { days: milkDays })} value={`${fmtDec(milk.totalLitres)} L`} color="text-green-700" />
                  <StatCard label={t("milkStats.avgPerDay")} value={`${fmtDec(milk.avgDailyLitres)} L`} />
                </div>
                {milk.bySpecies.length > 1 && (
                  <div className="space-y-1">
                    {milk.bySpecies.map(s => (
                      <div key={s.speciesId} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">{s.speciesName}</span>
                        <span className="font-medium">{fmtDec(s.totalLitres)} L</span>
                      </div>
                    ))}
                  </div>
                )}
                {milk.recent.length > 0 && (
                  <div className="space-y-1 border-t border-gray-100 pt-3">
                    <p className="text-xs text-gray-400 mb-2">{t("recentDailyTotals")}</p>
                    {milk.recent.slice(-7).map(r => {
                      const maxLitres = Math.max(...milk.recent.map(x => x.litres));
                      const pct = maxLitres > 0 ? (r.litres / maxLitres) * 100 : 0;
                      return (
                        <div key={r.date} className="flex items-center gap-2 text-xs">
                          <span className="w-20 text-gray-400 shrink-0">{r.date.slice(5)}</span>
                          <div className="flex-1 h-2 rounded-full bg-gray-100">
                            <div className="h-2 rounded-full bg-green-400" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-14 text-right text-gray-600">{fmtDec(r.litres)} L</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Breeding Status */}
          <Card title={t("breedingPregnancy")}>
            {breedingLoading ? (
              <div className="animate-pulse h-24 rounded-lg bg-gray-100" />
            ) : !breeding ? (
              <p className="text-xs text-gray-400 text-center py-4">No breeding records.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <StatCard label={t("pregnancyCounts.suspected")} value={breeding.pregnancies.suspected} color="text-yellow-600" />
                  <StatCard label={t("pregnancyCounts.confirmed")} value={breeding.pregnancies.confirmed} color="text-blue-600" />
                  <StatCard label={t("pregnancyCounts.gaveBirth")} value={breeding.pregnancies.gaveBirth} color="text-green-600" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label={t("pregnancyCounts.aborted")} value={breeding.pregnancies.aborted} color="text-red-500" />
                  <StatCard label={t("pregnancyCounts.notPregnant")} value={breeding.pregnancies.notPregnant} color="text-gray-500" />
                </div>
                {breeding.dueSoon.length > 0 && (
                  <div className="border-t border-gray-100 pt-3">
                    <p className="text-xs font-semibold text-orange-600 mb-2">{t("dueWithin21")} ({breeding.dueSoon.length})</p>
                    <div className="space-y-1">
                      {breeding.dueSoon.map((d, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 font-mono">{d.damId.slice(0, 8)}…</span>
                          <span className="font-medium text-orange-600">{d.expectedDueDate}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Transaction P&L */}
          <Card title={t("animalTransactions")}>
            {txLoading ? (
              <div className="animate-pulse h-24 rounded-lg bg-gray-100" />
            ) : !txSummary ? (
              <p className="text-xs text-gray-400 text-center py-4">No transactions recorded.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-red-50 p-3">
                    <p className="text-xs text-red-500 font-medium">{t("txStats.purchased")}</p>
                    <p className="text-lg font-bold text-red-700 mt-0.5">{fmt(txSummary.totalPurchased)} head</p>
                    <p className="text-xs text-red-400 mt-0.5">{t("txStats.spent")}: {fmt(txSummary.totalSpent)}</p>
                  </div>
                  <div className="rounded-xl bg-green-50 p-3">
                    <p className="text-xs text-green-600 font-medium">{t("txStats.sold")}</p>
                    <p className="text-lg font-bold text-green-700 mt-0.5">{fmt(txSummary.totalSold)} head</p>
                    <p className="text-xs text-green-400 mt-0.5">{t("txStats.earned")}: {fmt(txSummary.totalEarned)}</p>
                  </div>
                </div>
                <div className={`rounded-xl p-3 ${txSummary.netFlow >= 0 ? "bg-green-50" : "bg-red-50"}`}>
                  <p className="text-xs text-gray-500 font-medium">{t("txStats.netFlow")}</p>
                  <p className={`text-2xl font-bold mt-0.5 ${txSummary.netFlow >= 0 ? "text-green-700" : "text-red-700"}`}>
                    {txSummary.netFlow >= 0 ? "+" : ""}{fmt(txSummary.netFlow)}
                  </p>
                </div>
              </div>
            )}
          </Card>

        </div>
      )}
    </div>
  );
}
