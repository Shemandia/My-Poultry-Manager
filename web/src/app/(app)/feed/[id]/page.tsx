"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { ArrowLeft, Plus, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { api, extractError } from "@/lib/api";
import { formatDate, formatKg } from "@/lib/utils";
import type { FeedItem, FeedMovement } from "@/types";

const movSchema = z.object({
  movementType: z.enum(["purchase", "usage", "adjustment"]),
  quantityKg: z.number().positive("Quantity must be positive"),
  movementDate: z.string().min(1, "Date is required"),
  reference: z.string().optional(),
  supplierName: z.string().optional(),
  pricePerKg: z.string().optional(),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
});
type MovForm = z.infer<typeof movSchema>;

const INPUT = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100";
const LABEL = "block text-sm font-medium text-gray-700 mb-1";

const MOV_ICONS = {
  purchase: TrendingUp,
  usage: TrendingDown,
  adjustment: AlertTriangle,
};

const MOV_COLORS = {
  purchase: "text-green-600 bg-green-50",
  usage: "text-red-600 bg-red-50",
  adjustment: "text-yellow-600 bg-yellow-50",
};

function expiryBadge(expiryDate: string | null): React.ReactNode {
  if (!expiryDate) return null;
  const today = new Date();
  const exp = new Date(expiryDate);
  const diffDays = Math.ceil((exp.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0)
    return <span className="ml-1.5 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Expired</span>;
  if (diffDays <= 30)
    return <span className="ml-1.5 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">Exp. {formatDate(expiryDate)}</span>;
  return <span className="ml-1.5 text-xs text-gray-400">Exp. {formatDate(expiryDate)}</span>;
}

export default function FeedItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("feed");
  const tc = useTranslations("common");
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [serverError, setServerError] = useState("");

  const { data: item, isLoading } = useQuery<FeedItem>({
    queryKey: ["feed-items", id],
    queryFn: () => api.get(`/api/v1/feed-items/${id}`).then((r) => r.data),
  });

  const { data: movements = [] } = useQuery<FeedMovement[]>({
    queryKey: ["movements", id],
    queryFn: () => api.get(`/api/v1/feed-items/${id}/movements`).then((r) => r.data),
  });

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } =
    useForm<MovForm>({ resolver: zodResolver(movSchema), defaultValues: { movementType: "purchase" } });

  const watchedType = watch("movementType");

  const addMutation = useMutation({
    mutationFn: (data: MovForm) =>
      api.post(`/api/v1/feed-items/${id}/movements`, {
        movementType: data.movementType,
        quantityKg: data.quantityKg,
        movementDate: data.movementDate,
        reference: data.reference || null,
        supplierName: data.supplierName || null,
        pricePerKg: data.pricePerKg ? parseFloat(data.pricePerKg) : null,
        batchNumber: data.batchNumber || null,
        expiryDate: data.expiryDate || null,
        notes: data.notes || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed-items", id] });
      qc.invalidateQueries({ queryKey: ["movements", id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      reset();
      setShowAdd(false);
      setServerError("");
    },
    onError: (err) => setServerError(extractError(err)),
  });

  if (isLoading) return <div className="animate-pulse h-8 w-48 rounded bg-gray-200" />;
  if (!item) return <p className="text-sm text-gray-500">Item not found.</p>;

  const isLow = item.lowStockThresholdKg != null && item.currentStockKg <= item.lowStockThresholdKg;
  const sorted = [...movements].sort((a, b) => b.movementDate.localeCompare(a.movementDate));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/feed" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> {t("detail.backToFeed")}
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{item.name}</h1>
            <p className="text-sm text-gray-500 mt-1">Unit: {item.unit.toUpperCase()}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">{formatKg(item.currentStockKg)}</p>
            <p className="text-xs text-gray-400">{t("detail.currentStock")}</p>
            {isLow && (
              <span className="mt-1 inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                {t("detail.lowStockBadge")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stock info cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <p className="text-xs text-gray-500 mb-1">{t("detail.lowThreshold")}</p>
          <p className="text-xl font-bold text-gray-900">
            {item.lowStockThresholdKg != null ? formatKg(item.lowStockThresholdKg) : tc("notSet")}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <p className="text-xs text-gray-500 mb-1">{t("detail.totalMovements")}</p>
          <p className="text-xl font-bold text-gray-900">{movements.length}</p>
        </div>
      </div>

      {/* Movements */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">{t("detail.stockMovements")}</h2>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> {t("detail.addMovement")}
          </button>
        </div>

        {sorted.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-200">
            <p className="text-sm text-gray-400">{t("detail.noMovements")}</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-5 py-3 font-medium text-gray-500">{t("detail.movHeaders.date")}</th>
                  <th className="px-5 py-3 font-medium text-gray-500">{t("detail.movHeaders.type")}</th>
                  <th className="px-5 py-3 font-medium text-gray-500 text-right">{t("detail.movHeaders.qty")}</th>
                  <th className="px-5 py-3 font-medium text-gray-500">{t("detail.movHeaders.supplier")}</th>
                  <th className="px-5 py-3 font-medium text-gray-500 text-right">{t("detail.movHeaders.cost")}</th>
                  <th className="px-5 py-3 font-medium text-gray-500">{t("detail.movHeaders.batchExpiry")}</th>
                  <th className="px-5 py-3 font-medium text-gray-500">{t("detail.movHeaders.notes")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((m) => {
                  const Icon = MOV_ICONS[m.movementType];
                  return (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-gray-700">{formatDate(m.movementDate)}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${MOV_COLORS[m.movementType]}`}>
                          <Icon className="h-3 w-3" />
                          {t(`detail.movTypes.${m.movementType}` as Parameters<typeof t>[0])}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-gray-900">{m.quantityKg}</td>
                      <td className="px-5 py-3 text-gray-600">
                        {m.supplierName ?? <span className="text-gray-400">—</span>}
                        {m.pricePerKg != null && (
                          <span className="ml-1 text-xs text-gray-400">@ {m.pricePerKg}/kg</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-700">
                        {m.totalCost != null ? (
                          <span className="font-medium">{m.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        {m.batchNumber && <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{m.batchNumber}</span>}
                        {expiryBadge(m.expiryDate)}
                        {!m.batchNumber && !m.expiryDate && <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-5 py-3 text-gray-400 max-w-xs truncate">{m.notes ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Movement Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-gray-900 mb-5">{t("detail.addMovTitle")}</h2>
            <form onSubmit={handleSubmit((d) => addMutation.mutate(d))} className="space-y-4">
              <div>
                <label className={LABEL}>{t("detail.movType")} *</label>
                <select {...register("movementType")} className={INPUT}>
                  <option value="purchase">{t("detail.movTypes2.purchase")}</option>
                  <option value="usage">{t("detail.movTypes2.usage")}</option>
                  <option value="adjustment">{t("detail.movTypes2.adjustment")}</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>{t("detail.qty")} *</label>
                  <input type="number" step="0.1" min={0.1} {...register("quantityKg", { valueAsNumber: true })} className={INPUT} />
                  {errors.quantityKg && <p className="mt-1 text-xs text-red-600">{errors.quantityKg.message}</p>}
                </div>
                <div>
                  <label className={LABEL}>{t("detail.date")} *</label>
                  <input type="date" {...register("movementDate")} defaultValue={new Date().toISOString().slice(0, 10)} className={INPUT} />
                </div>
              </div>

              {/* Purchase-only fields */}
              {watchedType === "purchase" && (
                <div className="rounded-xl bg-green-50 p-4 space-y-3">
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">{t("detail.purchaseDetails")}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LABEL}>{t("detail.supplierName")}</label>
                      <input {...register("supplierName")} placeholder="Supplier name" className={INPUT} />
                    </div>
                    <div>
                      <label className={LABEL}>{t("detail.pricePerKg")}</label>
                      <input type="number" step="0.01" {...register("pricePerKg")} placeholder="0.00" className={INPUT} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LABEL}>{t("detail.batchNumber")}</label>
                      <input {...register("batchNumber")} placeholder={t("detail.batchPlaceholder")} className={INPUT} />
                    </div>
                    <div>
                      <label className={LABEL}>{t("detail.expiryDate")}</label>
                      <input type="date" {...register("expiryDate")} className={INPUT} />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className={LABEL}>{t("detail.reference")}</label>
                <input {...register("reference")} placeholder={t("detail.referencePlaceholder")} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>{tc("notes")}</label>
                <textarea {...register("notes")} rows={2} className={INPUT + " resize-none"} />
              </div>
              {serverError && <p className="text-xs text-red-600">{serverError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowAdd(false); reset(); setServerError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">{tc("cancel")}</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                  {isSubmitting ? tc("saving") : t("detail.saveMovement")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
