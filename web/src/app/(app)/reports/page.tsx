"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, extractError } from "@/lib/api";
import { formatNumber, formatKg } from "@/lib/utils";
import type { EggProductionReport, FeedConsumptionReport, FinanceReport } from "@/types";

function DateFilter({
  dateFrom,
  dateTo,
  onChange,
}: {
  dateFrom: string;
  dateTo: string;
  onChange: (from: string, to: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onChange(e.target.value, dateTo)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
        <input
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

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState(DEFAULT_FROM);
  const [dateTo, setDateTo] = useState(DEFAULT_TO);

  const params = new URLSearchParams();
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);

  const { data: eggData, isLoading: eggLoading } = useQuery<EggProductionReport>({
    queryKey: ["reports-eggs", dateFrom, dateTo],
    queryFn: () => api.get(`/api/v1/reports/egg-production?${params}`).then((r) => r.data),
  });

  const { data: feedData, isLoading: feedLoading } = useQuery<FeedConsumptionReport>({
    queryKey: ["reports-feed", dateFrom, dateTo],
    queryFn: () => api.get(`/api/v1/reports/feed-consumption?${params}`).then((r) => r.data),
  });

  const {
    data: financeData,
    isLoading: financeLoading,
    isError: financeIsError,
    error: financeError,
  } = useQuery<FinanceReport>({
    queryKey: ["reports-finance", dateFrom, dateTo],
    queryFn: () => api.get(`/api/v1/reports/finance?${params}`).then((r) => r.data),
  });

  const handleDateChange = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Production & feed analytics</p>
        </div>
        <DateFilter dateFrom={dateFrom} dateTo={dateTo} onChange={handleDateChange} />
      </div>

      {/* Egg production period summary */}
      {eggData && (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Egg Production Summary</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {[
              ["Eggs Collected", formatNumber(eggData.periodSummary.totalEggs)],
              ["Eggs Broken", formatNumber(eggData.periodSummary.totalEggsBroken)],
              ["Eggs Sold", formatNumber(eggData.periodSummary.totalEggsSold)],
              ["Total Mortality", formatNumber(eggData.periodSummary.totalMortality)],
              ["Feed Consumed", formatKg(eggData.periodSummary.totalFeedConsumedKg)],
            ].map(([label, val]) => (
              <div key={label} className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className="text-xl font-bold text-gray-900">{val}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily egg production table */}
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Daily Egg Production</h2>
        </div>
        {eggLoading ? (
          <div className="p-6 animate-pulse space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-8 rounded bg-gray-200" />)}
          </div>
        ) : !eggData || eggData.dailyTotals.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">No data for selected period.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left border-b border-gray-100">
                <th className="px-5 py-3 font-medium text-gray-500">Date</th>
                <th className="px-5 py-3 font-medium text-gray-500 text-right">Eggs</th>
                <th className="px-5 py-3 font-medium text-gray-500 text-right">Broken</th>
                <th className="px-5 py-3 font-medium text-gray-500 text-right">Sold</th>
                <th className="px-5 py-3 font-medium text-gray-500 text-right">Mortality</th>
                <th className="px-5 py-3 font-medium text-gray-500 text-right">Flocks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {eggData.dailyTotals.map((row) => (
                <tr key={row.date} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-700">{row.date}</td>
                  <td className="px-5 py-3 text-right font-medium text-gray-900">{formatNumber(row.eggsTotal)}</td>
                  <td className="px-5 py-3 text-right text-gray-500">{formatNumber(row.eggsBroken)}</td>
                  <td className="px-5 py-3 text-right text-gray-500">{formatNumber(row.eggsSold)}</td>
                  <td className="px-5 py-3 text-right text-red-600">{row.mortality > 0 ? formatNumber(row.mortality) : "—"}</td>
                  <td className="px-5 py-3 text-right text-gray-400">{row.recordCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Feed consumption */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Inventory usage */}
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Feed Inventory Usage</h2>
          </div>
          {feedLoading ? (
            <div className="p-6 animate-pulse space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-8 rounded bg-gray-200" />)}
            </div>
          ) : !feedData || feedData.inventoryUsage.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No inventory usage recorded.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left border-b border-gray-100">
                  <th className="px-5 py-3 font-medium text-gray-500">Feed Item</th>
                  <th className="px-5 py-3 font-medium text-gray-500 text-right">Used (kg)</th>
                  <th className="px-5 py-3 font-medium text-gray-500 text-right">Movements</th>
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
                  <td className="px-5 py-3 text-gray-700">Total</td>
                  <td className="px-5 py-3 text-right text-gray-900">{formatKg(feedData.totals.totalInventoryUsedKg)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* Per-flock consumption */}
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Feed Consumed by Flock</h2>
          </div>
          {feedLoading ? (
            <div className="p-6 animate-pulse space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-8 rounded bg-gray-200" />)}
            </div>
          ) : !feedData || feedData.flockConsumption.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No flock consumption data.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left border-b border-gray-100">
                  <th className="px-5 py-3 font-medium text-gray-500">Flock</th>
                  <th className="px-5 py-3 font-medium text-gray-500 text-right">Consumed (kg)</th>
                  <th className="px-5 py-3 font-medium text-gray-500 text-right">Days</th>
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
                  <td className="px-5 py-3 text-gray-700">Total</td>
                  <td className="px-5 py-3 text-right text-gray-900">{formatKg(feedData.totals.totalFlockConsumedKg)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Finance report */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Finance Summary</h2>

        {financeLoading ? (
          <div className="animate-pulse space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-8 rounded bg-gray-200" />
            ))}
          </div>
        ) : financeIsError ? (
          <p className="text-sm text-red-600">{extractError(financeError)}</p>
        ) : !financeData ? (
          <p className="text-sm text-gray-500">No finance data available.</p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs text-gray-500 mb-1">Income</p>
                <p className="text-xl font-bold text-green-700">{formatCurrency(financeData.summary.totalIncome)}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs text-gray-500 mb-1">Expense</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(financeData.summary.totalExpense)}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs text-gray-500 mb-1">Net Profit</p>
                <p className="text-xl font-bold text-blue-700">{formatCurrency(financeData.summary.netProfit)}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs text-gray-500 mb-1">Transactions</p>
                <p className="text-xl font-bold text-gray-900">{formatNumber(financeData.summary.transactionCount)}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    <th className="py-2 font-medium text-gray-500">Type</th>
                    <th className="py-2 font-medium text-gray-500">Category</th>
                    <th className="py-2 font-medium text-gray-500 text-right">Count</th>
                    <th className="py-2 font-medium text-gray-500 text-right">Total</th>
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
  );
}
