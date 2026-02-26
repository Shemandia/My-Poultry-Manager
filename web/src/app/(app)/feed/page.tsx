"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Plus, ChevronRight, AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { api, extractError } from "@/lib/api";
import { formatKg } from "@/lib/utils";
import type { FeedItem } from "@/types";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  unit: z.enum(["kg", "bag", "ton"]),
  lowStockThresholdKg: z.string().optional(),
  notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

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

export default function FeedPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<FeedItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<FeedItem | null>(null);
  const [serverError, setServerError] = useState("");

  const { data: items = [], isLoading } = useQuery<FeedItem[]>({
    queryKey: ["feed-items"],
    queryFn: () => api.get("/api/v1/feed-items").then((r) => r.data),
  });

  const { register: regAdd, handleSubmit: hsAdd, reset: resetAdd, formState: { errors: errAdd, isSubmitting: subAdd } } =
    useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { unit: "kg" } });

  const { register: regEdit, handleSubmit: hsEdit, reset: resetEdit, formState: { errors: errEdit, isSubmitting: subEdit } } =
    useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { unit: "kg" } });

  const addMutation = useMutation({
    mutationFn: (data: FormData) =>
      api.post("/api/v1/feed-items", {
        name: data.name,
        unit: data.unit,
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
    mutationFn: (data: FormData) =>
      api.put(`/api/v1/feed-items/${editItem!.id}`, {
        name: data.name,
        unit: data.unit,
        currentStockKg: editItem!.currentStockKg,
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

  const lowStockCount = items.filter(
    (i) => i.lowStockThresholdKg != null && i.currentStockKg <= i.lowStockThresholdKg
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feed Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">
            {items.length} item{items.length !== 1 ? "s" : ""}
            {lowStockCount > 0 && (
              <span className="ml-2 text-red-600 font-medium">· {lowStockCount} low stock</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setShowAdd(true); setServerError(""); }}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Item
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-gray-200" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-200">
          <p className="text-gray-400 text-sm">No feed items yet.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-5 py-3 font-medium text-gray-500">Name</th>
                <th className="px-5 py-3 font-medium text-gray-500">Unit</th>
                <th className="px-5 py-3 font-medium text-gray-500 text-right">Stock (kg)</th>
                <th className="px-5 py-3 font-medium text-gray-500 text-right">Threshold</th>
                <th className="px-5 py-3 font-medium text-gray-500">Status</th>
                <th className="px-5 py-3"><span className="sr-only">Actions</span></th>
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
                        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">Low stock</span>
                      ) : (
                        <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">OK</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => { setDeleteItem(item); setServerError(""); }}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete"
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
      <Modal open={showAdd} onClose={() => { setShowAdd(false); resetAdd(); setServerError(""); }} title="Add Feed Item">
        <form onSubmit={hsAdd((d) => addMutation.mutate(d))} className="space-y-4">
          <div>
            <label className={LABEL}>Name *</label>
            <input {...regAdd("name")} placeholder="e.g. Layer Mash" className={INPUT} />
            {errAdd.name && <p className="mt-1 text-xs text-red-600">{errAdd.name.message}</p>}
          </div>
          <div>
            <label className={LABEL}>Unit *</label>
            <select {...regAdd("unit")} className={INPUT}>
              <option value="kg">kg</option>
              <option value="bag">bag</option>
              <option value="ton">ton</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>Low-stock threshold (kg)</label>
            <input type="number" step="0.1" {...regAdd("lowStockThresholdKg")} placeholder="e.g. 50" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Notes</label>
            <textarea {...regAdd("notes")} rows={2} className={INPUT + " resize-none"} />
          </div>
          {serverError && <p className="text-xs text-red-600">{serverError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setShowAdd(false); resetAdd(); setServerError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={subAdd} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {subAdd ? "Adding…" : "Add Item"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editItem} onClose={() => { setEditItem(null); setServerError(""); }} title="Edit Feed Item">
        <form onSubmit={hsEdit((d) => editMutation.mutate(d))} className="space-y-4">
          <div>
            <label className={LABEL}>Name *</label>
            <input {...regEdit("name")} className={INPUT} />
            {errEdit.name && <p className="mt-1 text-xs text-red-600">{errEdit.name.message}</p>}
          </div>
          <div>
            <label className={LABEL}>Unit *</label>
            <select {...regEdit("unit")} className={INPUT}>
              <option value="kg">kg</option>
              <option value="bag">bag</option>
              <option value="ton">ton</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>Low-stock threshold (kg)</label>
            <input type="number" step="0.1" {...regEdit("lowStockThresholdKg")} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Notes</label>
            <textarea {...regEdit("notes")} rows={2} className={INPUT + " resize-none"} />
          </div>
          {serverError && <p className="text-xs text-red-600">{serverError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setEditItem(null); setServerError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={subEdit} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {subEdit ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={!!deleteItem} onClose={() => setDeleteItem(null)} title="Delete Feed Item">
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete <span className="font-semibold text-gray-900">{deleteItem?.name}</span>? This cannot be undone.
        </p>
        {serverError && <p className="mb-4 text-xs text-red-600">{serverError}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={() => setDeleteItem(null)} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button
            type="button"
            onClick={() => deleteMutation.mutate(deleteItem!.id)}
            disabled={deleteMutation.isPending}
            className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleteMutation.isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
