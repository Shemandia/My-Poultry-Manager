"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { ArrowLeft, Plus, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { api, extractError } from "@/lib/api";
import { formatDate, formatKg } from "@/lib/utils";
import type { FeedItem, FeedMovement } from "@/types";

const movSchema = z.object({
  movementType: z.enum(["purchase", "usage", "adjustment"]),
  quantityKg: z.number().positive("Quantity must be positive"),
  movementDate: z.string().min(1, "Date is required"),
  reference: z.string().optional(),
  notes: z.string().optional(),
});
type MovForm = z.infer<typeof movSchema>;

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

export default function FeedItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
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

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<MovForm>({ resolver: zodResolver(movSchema), defaultValues: { movementType: "purchase" } });

  const addMutation = useMutation({
    mutationFn: (data: MovForm) =>
      api.post(`/api/v1/feed-items/${id}/movements`, {
        movementType: data.movementType,
        quantityKg: data.quantityKg,
        movementDate: data.movementDate,
        reference: data.reference || null,
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

  return (
    <div className="space-y-6">
      <div>
        <Link href="/feed" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Feed Inventory
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{item.name}</h1>
            <p className="text-sm text-gray-500 mt-1">Unit: {item.unit.toUpperCase()}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">{formatKg(item.currentStockKg)}</p>
            <p className="text-xs text-gray-400">Current stock</p>
            {isLow && (
              <span className="mt-1 inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                Low stock
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stock info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <p className="text-xs text-gray-500 mb-1">Low-stock threshold</p>
          <p className="text-xl font-bold text-gray-900">
            {item.lowStockThresholdKg != null ? formatKg(item.lowStockThresholdKg) : "Not set"}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <p className="text-xs text-gray-500 mb-1">Total movements</p>
          <p className="text-xl font-bold text-gray-900">{movements.length}</p>
        </div>
      </div>

      {/* Movements */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Stock Movements</h2>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add Movement
          </button>
        </div>

        {movements.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-200">
            <p className="text-sm text-gray-400">No movements recorded yet.</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-5 py-3 font-medium text-gray-500">Date</th>
                  <th className="px-5 py-3 font-medium text-gray-500">Type</th>
                  <th className="px-5 py-3 font-medium text-gray-500 text-right">Qty (kg)</th>
                  <th className="px-5 py-3 font-medium text-gray-500">Reference</th>
                  <th className="px-5 py-3 font-medium text-gray-500">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...movements].sort((a, b) => b.movementDate.localeCompare(a.movementDate)).map((m) => {
                  const Icon = MOV_ICONS[m.movementType];
                  return (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-gray-700">{formatDate(m.movementDate)}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${MOV_COLORS[m.movementType]}`}>
                          <Icon className="h-3 w-3" />
                          {m.movementType}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-gray-900">{m.quantityKg}</td>
                      <td className="px-5 py-3 text-gray-500">{m.reference ?? "—"}</td>
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
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-5">Add Stock Movement</h2>
            <form onSubmit={handleSubmit((d) => addMutation.mutate(d))} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select {...register("movementType")} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100">
                  <option value="purchase">Purchase (adds stock)</option>
                  <option value="usage">Usage (removes stock)</option>
                  <option value="adjustment">Adjustment</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity (kg) *</label>
                  <input type="number" step="0.1" min={0.1} {...register("quantityKg", { valueAsNumber: true })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100" />
                  {errors.quantityKg && <p className="mt-1 text-xs text-red-600">{errors.quantityKg.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input type="date" {...register("movementDate")} defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                <input {...register("reference")} placeholder="Invoice no., PO number…" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea {...register("notes")} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 resize-none" />
              </div>
              {serverError && <p className="text-xs text-red-600">{serverError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowAdd(false); reset(); setServerError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                  {isSubmitting ? "Saving…" : "Save Movement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
