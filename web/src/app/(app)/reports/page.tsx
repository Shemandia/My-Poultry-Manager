"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api, extractError } from "@/lib/api";
import { formatNumber, formatKg } from "@/lib/utils";
import {
  MultiLineChart,
  DualAxisOverlayChart,
  StackedCategoryChart,
} from "@/components/charts/SimpleCharts";
import type { EggProductionReport, FeedConsumptionReport, FinanceReport } from "@/types";

function DateFilter({
  dateFrom,
  dateTo,
  onChange,
  labelFrom,
  labelTo,
}: {
  dateFrom: string;
  dateTo: string;
  onChange: (from: string, to: string) => void;
  labelFrom: string;
  labelTo: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div>
        <label htmlFor="report-date-from" className="mb-1 block text-xs font-medium text-gray-500">{labelFrom}</label>
        <input
          id="report-date-from"
          type="date"
          value={dateFrom}
          onChange={(e) => onChange(e.target.value, dateTo)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
        />
      </div>
      <div>
        <label htmlFor="report-date-to" className="mb-1 block text-xs font-medium text-gray-500">{labelTo}</label>
        <input
          id="report-date-to"
          type="date"
          value={dateTo}
          onChange={(e) => onChange(dateFrom, e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
        />
      </div>
    </div>
  );
}

const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
const DEFAULT_FROM = thirtyDaysAgo.toISOString().slice(0, 10);
const DEFAULT_TO = new Date().toISOString().slice(0, 10);

function formatCurrency(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function prettyCategory(value: string) {
  return value
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

export default function ReportsPage() {
  const t = useTranslations("reports");
  const tc = useTranslations("common");

  const [dateFrom, setDateFrom] = useState(DEFAULT_FROM);
  const [dateTo, setDateTo] = useState(DEFAULT_TO);

  const params = new URLSearchParams();
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);

  const { data: eggData, isLoading: eggLoading } = useQuery<EggProductionReport>({
    queryKey: ["reports-eggs", dateFrom, dateTo],
    queryFn: () => api.get(`/api/v1/reports/egg-production?${params.toString()}`).then((r) => r.data),
  });

  const { data: feedData, isLoading: feedLoading } = useQuery<FeedConsumptionReport>({
    queryKey: ["reports-feed", dateFrom, dateTo],
    queryFn: () => api.get(`/api/v1/reports/feed-consumption?${params.toString()}`).then((r) => r.data),
  });

  const {
    data: financeData,
    isLoading: financeLoading,
    isError: financeIsError,
    error: financeError,
  } = useQuery<FinanceReport>({
    queryKey: ["reports-finance", dateFrom, dateTo],
    queryFn: () => api.get(`/api/v1/reports/finance?${params.toString()}`).then((r) => r.data),
  });

  const handleDateChange = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
  };

  const productionSeries = useMemo(
    () =>
      (eggData?.dailyTotals ?? []).map((row) => ({
        label: row.date.slice(5),
        eggs: row.eggsTotal,
        broken: row.eggsBroken,
        sold: row.eggsSold,
        mortality: row.mortality,
        feed: Number(row.feedConsumedKg.toFixed(2)),
      })),
    [eggData]
  );

  const financeStacked = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    for (const row of financeData?.byCategory ?? []) {
      const label = prettyCategory(row.category);
      const current = map.get(label) ?? { income: 0, expense: 0 };
      if (row.type === "income") current.income += row.total;
      if (row.type === "expense") current.expense += row.total;
      map.set(label, current);
    }

    return [...map.entries()]
      .map(([label, totals]) => ({
        label,
        income: totals.income,
        expense: totals.expense,
      }))
      .sort((a, b) => b.income + b.expense - (a.income + a.expense));
  }, [financeData]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("subtitle")}</p>
        </div>
        <DateFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onChange={handleDateChange}
          labelFrom={tc("from")}
          labelTo={tc("to")}
        />
      </div>

      {eggData && (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-4 text-base font-semibold text-gray-900">{t("eggSummary")}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {[
              [t("eggsCollected"), formatNumber(eggData.periodSummary.totalEggs)],
              [t("eggsBroken"), formatNumber(eggData.periodSummary.totalEggsBroken)],
              [t("eggsSold"), formatNumber(eggData.periodSummary.totalEggsSold)],
              [t("totalMortality"), formatNumber(eggData.periodSummary.totalMortality)],
              [t("feedConsumed"), formatKg(eggData.periodSummary.totalFeedConsumedKg)],
            ].map(([label, val]) => (
              <div key={label} className="rounded-xl bg-gray-50 p-4">
                <p className="mb-1 text-xs text-gray-500">{label}</p>
                <p className="text-xl font-bold text-gray-900">{val}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {eggLoading ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <div className="animate-pulse space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-8 rounded bg-gray-200" />
              ))}
            </div>
          </div>
        ) : productionSeries.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center text-sm text-gray-400 shadow-sm ring-1 ring-gray-200">
            {t("noData")}
          </div>
        ) : (
          <MultiLineChart
            data={productionSeries}
            series={[
              { key: "eggs", label: t("headers.eggs"), color: "#16a34a" },
              { key: "broken", label: t("headers.broken"), color: "#f59e0b" },
              { key: "sold", label: t("headers.sold"), color: "#3b82f6" },
            ]}
          />
        )}

        {eggLoading ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <div className="animate-pulse space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-8 rounded bg-gray-200" />
              ))}
            </div>
          </div>
        ) : productionSeries.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center text-sm text-gray-400 shadow-sm ring-1 ring-gray-200">
            {t("noData")}
          </div>
        ) : (
          <DualAxisOverlayChart
            data={productionSeries}
            left={{ key: "mortality", label: t("headers.mortality"), color: "#ef4444" }}
            right={{ key: "feed", label: t("feedConsumed"), color: "#0ea5e9" }}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {financeLoading ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <div className="animate-pulse space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-8 rounded bg-gray-200" />
              ))}
            </div>
          </div>
        ) : financeStacked.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center text-sm text-gray-400 shadow-sm ring-1 ring-gray-200">
            {t("noData")}
          </div>
        ) : (
          <StackedCategoryChart rows={financeStacked} />
        )}

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-4 text-base font-semibold text-gray-900">{t("financeSummary")}</h2>
          {financeLoading ? (
            <div className="animate-pulse space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-8 rounded bg-gray-200" />
              ))}
            </div>
          ) : financeIsError ? (
            <p className="text-sm text-red-600">{extractError(financeError)}</p>
          ) : !financeData ? (
            <p className="text-sm text-gray-500">{t("noData")}</p>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="mb-1 text-xs text-gray-500">{t("financeStats.income")}</p>
                  <p className="text-xl font-bold text-green-700">{formatCurrency(financeData.summary.totalIncome)}</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="mb-1 text-xs text-gray-500">{t("financeStats.expense")}</p>
                  <p className="text-xl font-bold text-red-600">{formatCurrency(financeData.summary.totalExpense)}</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="mb-1 text-xs text-gray-500">{t("financeStats.netProfit")}</p>
                  <p className="text-xl font-bold text-blue-700">{formatCurrency(financeData.summary.netProfit)}</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="mb-1 text-xs text-gray-500">{t("financeStats.transactions")}</p>
                  <p className="text-xl font-bold text-gray-900">{formatNumber(financeData.summary.transactionCount)}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left">
                      <th className="py-2 font-medium text-gray-500">{t("financeHeaders.type")}</th>
                      <th className="py-2 font-medium text-gray-500">{t("financeHeaders.category")}</th>
                      <th className="py-2 text-right font-medium text-gray-500">{t("financeHeaders.count")}</th>
                      <th className="py-2 text-right font-medium text-gray-500">{t("financeHeaders.total")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {financeData.byCategory.map((row) => (
                      <tr key={`${row.type}-${row.category}`}>
                        <td className="py-2 capitalize text-gray-700">{row.type}</td>
                        <td className="py-2 text-gray-700">{row.category}</td>
                        <td className="py-2 text-right text-gray-500">{formatNumber(row.count)}</td>
                        <td className="py-2 text-right font-medium text-gray-900">{formatCurrency(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">{t("dailyEggProduction")}</h2>
        </div>
        {eggLoading ? (
          <div className="space-y-2 p-6 animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 rounded bg-gray-200" />
            ))}
          </div>
        ) : !eggData || eggData.dailyTotals.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">{t("noData")}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-5 py-3 font-medium text-gray-500">{t("headers.date")}</th>
                <th className="px-5 py-3 text-right font-medium text-gray-500">{t("headers.eggs")}</th>
                <th className="px-5 py-3 text-right font-medium text-gray-500">{t("headers.broken")}</th>
                <th className="px-5 py-3 text-right font-medium text-gray-500">{t("headers.sold")}</th>
                <th className="px-5 py-3 text-right font-medium text-gray-500">{t("headers.mortality")}</th>
                <th className="px-5 py-3 text-right font-medium text-gray-500">{t("headers.flocks")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {eggData.dailyTotals.map((row) => (
                <tr key={row.date} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-700">{row.date}</td>
                  <td className="px-5 py-3 text-right font-medium text-gray-900">{formatNumber(row.eggsTotal)}</td>
                  <td className="px-5 py-3 text-right text-gray-500">{formatNumber(row.eggsBroken)}</td>
                  <td className="px-5 py-3 text-right text-gray-500">{formatNumber(row.eggsSold)}</td>
                  <td className="px-5 py-3 text-right text-red-600">
                    {row.mortality > 0 ? formatNumber(row.mortality) : "-"}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-400">{row.recordCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-base font-semibold text-gray-900">{t("feedUsage")}</h2>
          </div>
          {feedLoading ? (
            <div className="space-y-2 p-6 animate-pulse">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-8 rounded bg-gray-200" />
              ))}
            </div>
          ) : !feedData || feedData.inventoryUsage.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">{t("noInventoryUsage")}</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-5 py-3 font-medium text-gray-500">{t("feedHeaders.feedItem")}</th>
                  <th className="px-5 py-3 text-right font-medium text-gray-500">{t("feedHeaders.usedKg")}</th>
                  <th className="px-5 py-3 text-right font-medium text-gray-500">{t("feedHeaders.movements")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {feedData.inventoryUsage.map((row) => (
                  <tr key={row.feedItemId} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{row.name}</td>
                    <td className="px-5 py-3 text-right text-gray-700">{formatKg(row.totalUsedKg)}</td>
                    <td className="px-5 py-3 text-right text-gray-400">{row.movementCount}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-5 py-3 text-gray-700">{tc("all")}</td>
                  <td className="px-5 py-3 text-right text-gray-900">{formatKg(feedData.totals.totalInventoryUsedKg)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-base font-semibold text-gray-900">{t("feedByFlock")}</h2>
          </div>
          {feedLoading ? (
            <div className="space-y-2 p-6 animate-pulse">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-8 rounded bg-gray-200" />
              ))}
            </div>
          ) : !feedData || feedData.flockConsumption.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">{t("noFlockConsumption")}</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-5 py-3 font-medium text-gray-500">{t("feedHeaders.flock")}</th>
                  <th className="px-5 py-3 text-right font-medium text-gray-500">{t("feedHeaders.consumedKg")}</th>
                  <th className="px-5 py-3 text-right font-medium text-gray-500">{t("feedHeaders.days")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {feedData.flockConsumption.map((row) => (
                  <tr key={row.flockId} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{row.batchCode}</td>
                    <td className="px-5 py-3 text-right text-gray-700">{formatKg(row.totalFeedConsumedKg)}</td>
                    <td className="px-5 py-3 text-right text-gray-400">{row.daysRecorded}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-5 py-3 text-gray-700">{tc("all")}</td>
                  <td className="px-5 py-3 text-right text-gray-900">{formatKg(feedData.totals.totalFlockConsumedKg)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
