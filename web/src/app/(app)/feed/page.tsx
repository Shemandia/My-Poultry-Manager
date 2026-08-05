"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Plus, ChevronRight, AlertTriangle, Pencil, Trash2, PackagePlus, PackageMinus } from "lucide-react";
import { useTranslations } from "next-intl";
import { api, extractError } from "@/lib/api";
import { formatKg } from "@/lib/utils";
import type { Farm, FeedItem } from "@/types";

// ── Schemas ───────────────────────────────────────────────────────────────────
const schema = z.object({
  name: z.string().min(1, "Name is required"),
  unit: z.enum(["kg", "bag", "ton"]),
  farmId: z.string().uuid("Select a farm"),
  lowStockThresholdKg: z.string().optional(),
  notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const quickSchema = z.object({
  quantityKg: z.number().positive("Must be > 0"),
  movementDate: z.string().min(1, "Date is required"),
  supplierName: z.string().optional(),
  pricePerKg: z.string().optional(),
});
type QuickForm = z.infer<typeof quickSchema>;

// ── Shared ────────────────────────────────────────────────────────────────────
const INPUT = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100";
const LABEL = "block text-sm font-medium text-gray-700 mb-1";

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">{title}</h2>
        {children}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function FeedPage() {
  const t = useTranslations("feed");
  const tc = useTranslations("common");
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<FeedItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<FeedItem | null>(null);
  const [quickItem, setQuickItem] = useState<{ item: FeedItem; type: "purchase" | "usage" } | null>(null);
  const [serverError, setServerError] = useState("");
  const [selectedFarmId, setSelectedFarmId] = useState<string>("");

  const { data: farms = [] } = useQuery<Farm[]>({
    queryKey: ["farms"],
    queryFn: () => api.get("/api/v1/farms").then((r) => r.data),
    onSuccess: (data: Farm[]) => {
      if (data.length > 0 && !selectedFarmId) setSelectedFarmId(data[0].id);
    },
  } as Parameters<typeof useQuery<Farm[]>>[0]);

  const { data: items = [], isLoading } = useQuery<FeedItem[]>({
    queryKey: ["feed-items", selectedFarmId],
    queryFn: () => api.get("/api/v1/feed-items", { params: selectedFarmId ? { farmId: selectedFarmId } : {} }).then((r) => r.data),
  });

  // ── Add form ─────────────────────────────────────────────────────────────
  const { register: regAdd, handleSubmit: hsAdd, reset: resetAdd, formState: { errors: errAdd, isSubmitting: subAdd } } =
    useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { unit: "kg" } });

  // ── Edit form (reuse same schema minus farmId) ────────────────────────────
  const editSchema = z.object({
    name: z.string().min(1, "Name is required"),
    unit: z.enum(["kg", "bag", "ton"]),
    lowStockThresholdKg: z.string().optional(),
    notes: z.string().optional(),
  });
  type EditForm = z.infer<typeof editSchema>;

  const { register: regEdit, handleSubmit: hsEdit, reset: resetEdit, formState: { errors: errEdit, isSubmitting: subEdit } } =
    useForm<EditForm>({ resolver: zodResolver(editSchema), defaultValues: { unit: "kg" } });

  // ── Quick stock form ──────────────────────────────────────────────────────
  const { register: regQ, handleSubmit: hsQ, reset: resetQ, formState: { errors: errQ, isSubmitting: subQ } } =
    useForm<QuickForm>({ resolver: zodResolver(quickSchema) });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const addMutation = useMutation({
    mutationFn: (data: FormData) =>
      api.post("/api/v1/feed-items", {
        name: data.name,
        unit: data.unit,
        farmId: data.farmId || null,
        lowStockThresholdKg: data.lowStockThresholdKg ? parseFloat(data.lowStockThresholdKg) : null,
        notes: data.notes || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed-items"] });
      resetAdd();
      setShowAdd(false);
      setServerError("");
    },
    onError: (err) => setServerError(extractError(err)),
  });

  const editMutation = useMutation({
    mutationFn: (data: EditForm) =>
      api.put(`/api/v1/feed-items/${editItem!.id}`, {
        name: data.name,
        unit: data.unit,
        currentStockKg: editItem!.currentStockKg,
        farmId: editItem!.farmId,
        lowStockThresholdKg: data.lowStockThresholdKg ? parseFloat(data.lowStockThresholdKg) : null,
        notes: data.notes || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed-items"] });
      setEditItem(null);
      setServerError("");
    },
    onError: (err) => setServerError(extractError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/feed-items/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed-items"] });
      setDeleteItem(null);
    },
    onError: (err) => setServerError(extractError(err)),
  });

  const quickMutation = useMutation({
    mutationFn: (data: QuickForm) =>
      api.post(`/api/v1/feed-items/${quickItem!.item.id}/movements`, {
        movementType: quickItem!.type,
        quantityKg: data.quantityKg,
        movementDate: data.movementDate,
        supplierName: data.supplierName || null,
        pricePerKg: data.pricePerKg ? parseFloat(data.pricePerKg) : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed-items"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      resetQ();
      setQuickItem(null);
      setServerError("");
    },
    onError: (err) => setServerError(extractError(err)),
  });

  function openEdit(item: FeedItem) {
    setServerError("");
    resetEdit({
      name: item.name,
      unit: item.unit as "kg" | "bag" | "ton",
      lowStockThresholdKg: item.lowStockThresholdKg != null ? String(item.lowStockThresholdKg) : "",
      notes: item.notes ?? "",
    });
    setEditItem(item);
  }

  function openQuick(item: FeedItem, type: "purchase" | "usage") {
    setServerError("");
    resetQ({ movementDate: new Date().toISOString().slice(0, 10) });
    setQuickItem({ item, type });
  }

  const lowStockCount = items.filter(
    (i) => i.lowStockThresholdKg != null && i.currentStockKg <= i.lowStockThresholdKg
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("count", { count: items.length })}
            {lowStockCount > 0 && (
              <span className="ml-2 text-red-600 font-medium">· {t("lowStock", { count: lowStockCount })}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Farm filter */}
          {farms.length > 1 && (
            <select
              value={selectedFarmId}
              onChange={(e) => setSelectedFarmId(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
            >
              <option value="">{t("allFarms")}</option>
              {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          )}
          <button
            type="button"
            onClick={() => { setShowAdd(true); setServerError(""); }}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
          >
            <Plus className="h-4 w-4" /> {t("addItem")}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-gray-200" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-200">
          <p className="text-gray-400 text-sm">{t("noItems")}</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-5 py-3 font-medium text-gray-500">{t("headers.name")}</th>
                <th className="px-5 py-3 font-medium text-gray-500">{t("headers.unit")}</th>
                <th className="px-5 py-3 font-medium text-gray-500 text-right">{t("headers.stock")}</th>
                <th className="px-5 py-3 font-medium text-gray-500 text-right">{t("headers.threshold")}</th>
                <th className="px-5 py-3 font-medium text-gray-500">{t("headers.status")}</th>
                <th className="px-5 py-3"><span className="sr-only">{tc("actions")}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => {
                const isLow = item.lowStockThresholdKg != null && item.currentStockKg <= item.lowStockThresholdKg;
                return (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {isLow && <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
                        <span className="font-medium text-gray-900">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-500 uppercase text-xs">{item.unit}</td>
                    <td className="px-5 py-3 text-right font-medium text-gray-900">{formatKg(item.currentStockKg)}</td>
                    <td className="px-5 py-3 text-right text-gray-400">
                      {item.lowStockThresholdKg != null ? formatKg(item.lowStockThresholdKg) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      {isLow ? (
                        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">{t("statusBadge.low")}</span>
                      ) : (
                        <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">{t("statusBadge.ok")}</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openQuick(item, "purchase")}
                          title={t("stockIn")}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-green-50 hover:text-green-600 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <PackagePlus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openQuick(item, "usage")}
                          title={t("stockOut")}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-orange-50 hover:text-orange-600 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <PackageMinus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          title={tc("edit")}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => { setDeleteItem(item); setServerError(""); }}
                          title={tc("delete")}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <Link href={`/feed/${item.id}`} className="rounded-lg p-1.5 text-gray-300 group-hover:text-green-500 transition-colors">
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      <Modal open={showAdd} onClose={() => { setShowAdd(false); resetAdd(); setServerError(""); }} title={t("addItem")}>
        <form onSubmit={hsAdd((d) => addMutation.mutate(d))} className="space-y-4">
          <div>
            <label className={LABEL}>{t("form.farm")} *</label>
            <select {...regAdd("farmId")} defaultValue={selectedFarmId} className={INPUT}>
              <option value="">Select farm…</option>
              {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            {errAdd.farmId && <p className="mt-1 text-xs text-red-600">{errAdd.farmId.message}</p>}
          </div>
          <div>
            <label className={LABEL}>{t("form.name")} *</label>
            <input {...regAdd("name")} placeholder="e.g. Layer Mash" className={INPUT} />
            {errAdd.name && <p className="mt-1 text-xs text-red-600">{errAdd.name.message}</p>}
          </div>
          <div>
            <label className={LABEL}>{t("form.unit")} *</label>
            <select {...regAdd("unit")} className={INPUT}>
              <option value="kg">{t("form.units.kg")}</option>
              <option value="bag">{t("form.units.bag")}</option>
              <option value="ton">{t("form.units.ton")}</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>{t("form.threshold")}</label>
            <input type="number" step="0.1" {...regAdd("lowStockThresholdKg")} placeholder="e.g. 50" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>{t("form.notes")}</label>
            <textarea {...regAdd("notes")} rows={2} className={INPUT + " resize-none"} />
          </div>
          {serverError && <p className="text-xs text-red-600">{serverError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setShowAdd(false); resetAdd(); setServerError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">{tc("cancel")}</button>
            <button type="submit" disabled={subAdd} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {subAdd ? tc("saving") : tc("add")}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editItem} onClose={() => { setEditItem(null); setServerError(""); }} title={t("editItem")}>
        <form onSubmit={hsEdit((d) => editMutation.mutate(d))} className="space-y-4">
          <div>
            <label className={LABEL}>{t("form.name")} *</label>
            <input {...regEdit("name")} className={INPUT} />
            {errEdit.name && <p className="mt-1 text-xs text-red-600">{errEdit.name.message}</p>}
          </div>
          <div>
            <label className={LABEL}>{t("form.unit")} *</label>
            <select {...regEdit("unit")} className={INPUT}>
              <option value="kg">{t("form.units.kg")}</option>
              <option value="bag">{t("form.units.bag")}</option>
              <option value="ton">{t("form.units.ton")}</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>{t("form.threshold")}</label>
            <input type="number" step="0.1" {...regEdit("lowStockThresholdKg")} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>{t("form.notes")}</label>
            <textarea {...regEdit("notes")} rows={2} className={INPUT + " resize-none"} />
          </div>
          {serverError && <p className="text-xs text-red-600">{serverError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setEditItem(null); setServerError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">{tc("cancel")}</button>
            <button type="submit" disabled={subEdit} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {subEdit ? tc("saving") : tc("save")}
            </button>
          </div>
        </form>
      </Modal>

      {/* Quick Stock In/Out Modal */}
      <Modal
        open={!!quickItem}
        onClose={() => { setQuickItem(null); resetQ(); setServerError(""); }}
        title={quickItem?.type === "purchase" ? t("stockInTitle", { name: quickItem.item.name }) : t("stockOutTitle", { name: quickItem?.item.name ?? "" })}
      >
        <form onSubmit={hsQ((d) => quickMutation.mutate(d))} className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium mb-1"
            style={{ background: quickItem?.type === "purchase" ? "#f0fdf4" : "#fff7ed", color: quickItem?.type === "purchase" ? "#15803d" : "#c2410c" }}>
            {quickItem?.type === "purchase" ? <PackagePlus className="h-4 w-4" /> : <PackageMinus className="h-4 w-4" />}
            {quickItem?.type === "purchase" ? t("purchaseDesc") : t("usageDesc")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>{t("quantityKg")} *</label>
              <input type="number" step="0.1" min={0.1} {...regQ("quantityKg", { valueAsNumber: true })} className={INPUT} />
              {errQ.quantityKg && <p className="mt-1 text-xs text-red-600">{errQ.quantityKg.message}</p>}
            </div>
            <div>
              <label className={LABEL}>{tc("date")} *</label>
              <input type="date" {...regQ("movementDate")} className={INPUT} />
              {errQ.movementDate && <p className="mt-1 text-xs text-red-600">{errQ.movementDate.message}</p>}
            </div>
          </div>
          {quickItem?.type === "purchase" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>{t("supplier")}</label>
                <input {...regQ("supplierName")} placeholder="Supplier name" className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>{t("pricePerKg")}</label>
                <input type="number" step="0.01" {...regQ("pricePerKg")} placeholder="0.00" className={INPUT} />
              </div>
            </div>
          )}
          {serverError && <p className="text-xs text-red-600">{serverError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setQuickItem(null); resetQ(); setServerError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">{tc("cancel")}</button>
            <button type="submit" disabled={subQ}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-50 ${quickItem?.type === "purchase" ? "bg-green-600 hover:bg-green-700" : "bg-orange-600 hover:bg-orange-700"}`}>
              {subQ ? tc("saving") : quickItem?.type === "purchase" ? t("stockIn") : t("stockOut")}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={!!deleteItem} onClose={() => setDeleteItem(null)} title={t("deleteItem")}>
        <p className="text-sm text-gray-600 mb-6">
          {t("deleteConfirm", { name: deleteItem?.name ?? "" })}
        </p>
        {serverError && <p className="mb-4 text-xs text-red-600">{serverError}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={() => setDeleteItem(null)} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">{tc("cancel")}</button>
          <button
            type="button"
            onClick={() => deleteMutation.mutate(deleteItem!.id)}
            disabled={deleteMutation.isPending}
            className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleteMutation.isPending ? tc("deleting") : tc("delete")}
          </button>
        </div>
      </Modal>
    </div>
  );
}
