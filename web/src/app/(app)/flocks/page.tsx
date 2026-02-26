"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Plus, ChevronRight, Pencil, Trash2, XCircle } from "lucide-react";
import { api, extractError } from "@/lib/api";
import { formatNumber, formatDate } from "@/lib/utils";
import type { Farm, House, Flock } from "@/types";

const schema = z.object({
  farmId: z.string().uuid("Select a farm"),
  houseId: z.string().uuid("Select a house"),
  batchCode: z.string().min(1, "Batch code is required"),
  birdType: z.enum(["layer", "broiler"]),
  breed: z.string().min(1, "Breed is required"),
  arrivalDate: z.string().min(1, "Arrival date is required"),
  initialCount: z.number().int().positive("Initial count must be a positive number"),
});
type FormData = z.infer<typeof schema>;

const editSchema = z.object({
  houseId: z.string().uuid("Select a house"),
  batchCode: z.string().min(1, "Batch code is required"),
  birdType: z.enum(["layer", "broiler"]),
  breed: z.string().min(1, "Breed is required"),
  arrivalDate: z.string().min(1, "Arrival date is required"),
  initialCount: z.number().int().positive("Initial count must be a positive number"),
});
type EditFormData = z.infer<typeof editSchema>;

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-600",
};

const INPUT = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100";
const LABEL = "block text-sm font-medium text-gray-700 mb-1";

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export default function FlocksPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editFlock, setEditFlock] = useState<Flock | null>(null);
  const [deleteFlock, setDeleteFlock] = useState<Flock | null>(null);
  const [serverError, setServerError] = useState("");
  const [selectedFarmId, setSelectedFarmId] = useState("");

  const { data: flocks = [], isLoading } = useQuery<Flock[]>({
    queryKey: ["flocks"],
    queryFn: () => api.get("/api/v1/flocks").then((r) => r.data),
  });

  const { data: farms = [] } = useQuery<Farm[]>({
    queryKey: ["farms"],
    queryFn: () => api.get("/api/v1/farms").then((r) => r.data),
    enabled: showAdd,
  });

  const { data: houses = [] } = useQuery<House[]>({
    queryKey: ["houses", selectedFarmId],
    queryFn: () => api.get(`/api/v1/farms/${selectedFarmId}/houses`).then((r) => r.data),
    enabled: !!selectedFarmId,
  });

  const { data: editHouses = [] } = useQuery<House[]>({
    queryKey: ["houses", editFlock?.farmId],
    queryFn: () => api.get(`/api/v1/farms/${editFlock!.farmId}/houses`).then((r) => r.data),
    enabled: !!editFlock?.farmId,
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { birdType: "layer" } });

  const { register: regEdit, handleSubmit: hsEdit, reset: resetEdit, formState: { errors: errEdit, isSubmitting: subEdit } } =
    useForm<EditFormData>({ resolver: zodResolver(editSchema), defaultValues: { birdType: "layer" } });

  const watchedFarmId = watch("farmId");

  if (watchedFarmId !== selectedFarmId) {
    setSelectedFarmId(watchedFarmId);
    setValue("houseId", "");
  }

  const addMutation = useMutation({
    mutationFn: (data: FormData) =>
      api.post(`/api/v1/farms/${data.farmId}/flocks`, {
        houseId: data.houseId,
        batchCode: data.batchCode,
        birdType: data.birdType,
        breed: data.breed,
        arrivalDate: data.arrivalDate,
        initialCount: data.initialCount,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flocks"] });
      reset();
      setShowAdd(false);
      setServerError("");
    },
    onError: (err) => setServerError(extractError(err)),
  });

  const editMutation = useMutation({
    mutationFn: (data: EditFormData) =>
      api.put(`/api/v1/flocks/${editFlock!.id}`, {
        houseId: data.houseId,
        batchCode: data.batchCode,
        birdType: data.birdType,
        breed: data.breed,
        arrivalDate: data.arrivalDate,
        initialCount: data.initialCount,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flocks"] });
      setEditFlock(null);
      setServerError("");
    },
    onError: (err) => setServerError(extractError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/flocks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flocks"] });
      setDeleteFlock(null);
    },
    onError: (err) => setServerError(extractError(err)),
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/flocks/${id}/close`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flocks"] }),
    onError: (err) => setServerError(extractError(err)),
  });

  function openEdit(flock: Flock) {
    setServerError("");
    resetEdit({
      houseId: flock.houseId,
      batchCode: flock.batchCode,
      birdType: flock.birdType,
      breed: flock.breed,
      arrivalDate: flock.arrivalDate.slice(0, 10),
      initialCount: flock.initialCount,
    });
    setEditFlock(flock);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Flocks</h1>
          <p className="text-sm text-gray-500 mt-1">{flocks.length} flock{flocks.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          type="button"
          onClick={() => { setShowAdd(true); setServerError(""); }}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Flock
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-gray-200" />)}
        </div>
      ) : flocks.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-200">
          <p className="text-gray-400 text-sm">No flocks yet.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-5 py-3 font-medium text-gray-500">Batch</th>
                <th className="px-5 py-3 font-medium text-gray-500">Type</th>
                <th className="px-5 py-3 font-medium text-gray-500">Breed</th>
                <th className="px-5 py-3 font-medium text-gray-500">Arrived</th>
                <th className="px-5 py-3 font-medium text-gray-500 text-right">Birds</th>
                <th className="px-5 py-3 font-medium text-gray-500">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {flocks.map((flock) => (
                <tr key={flock.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-5 py-3 font-medium text-gray-900">{flock.batchCode}</td>
                  <td className="px-5 py-3 text-gray-600 capitalize">{flock.birdType}</td>
                  <td className="px-5 py-3 text-gray-600">{flock.breed}</td>
                  <td className="px-5 py-3 text-gray-500">{formatDate(flock.arrivalDate)}</td>
                  <td className="px-5 py-3 text-right text-gray-700">{formatNumber(flock.initialCount)}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[flock.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {flock.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {flock.status === "active" && (
                        <button
                          type="button"
                          onClick={() => closeMutation.mutate(flock.id)}
                          disabled={closeMutation.isPending}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-orange-50 hover:text-orange-500 transition-colors"
                          title="Close flock"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEdit(flock)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDeleteFlock(flock); setServerError(""); }}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <Link href={`/flocks/${flock.id}`} className="rounded-lg p-1.5 text-gray-300 group-hover:text-green-500 transition-colors">
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Flock Modal */}
      <Modal open={showAdd} onClose={() => { setShowAdd(false); reset(); setServerError(""); }} title="Add Flock">
        <form onSubmit={handleSubmit((d) => addMutation.mutate(d))} className="space-y-4">
          <div>
            <label className={LABEL}>Farm *</label>
            <select {...register("farmId")} className={INPUT}>
              <option value="">Select farm…</option>
              {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            {errors.farmId && <p className="mt-1 text-xs text-red-600">{errors.farmId.message}</p>}
          </div>
          <div>
            <label className={LABEL}>House *</label>
            <select {...register("houseId")} disabled={!selectedFarmId} className={INPUT + " disabled:bg-gray-50"}>
              <option value="">Select house…</option>
              {houses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
            {errors.houseId && <p className="mt-1 text-xs text-red-600">{errors.houseId.message}</p>}
          </div>
          <div>
            <label className={LABEL}>Batch code *</label>
            <input {...register("batchCode")} placeholder="e.g. B2024-01" className={INPUT} />
            {errors.batchCode && <p className="mt-1 text-xs text-red-600">{errors.batchCode.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Bird type *</label>
              <select {...register("birdType")} className={INPUT}>
                <option value="layer">Layer</option>
                <option value="broiler">Broiler</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Breed *</label>
              <input {...register("breed")} className={INPUT} />
              {errors.breed && <p className="mt-1 text-xs text-red-600">{errors.breed.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Arrival date *</label>
              <input type="date" {...register("arrivalDate")} className={INPUT} />
              {errors.arrivalDate && <p className="mt-1 text-xs text-red-600">{errors.arrivalDate.message}</p>}
            </div>
            <div>
              <label className={LABEL}>Initial count *</label>
              <input type="number" {...register("initialCount", { valueAsNumber: true })} className={INPUT} />
              {errors.initialCount && <p className="mt-1 text-xs text-red-600">{errors.initialCount.message}</p>}
            </div>
          </div>
          {serverError && <p className="text-xs text-red-600">{serverError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setShowAdd(false); reset(); setServerError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {isSubmitting ? "Adding…" : "Add Flock"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Flock Modal */}
      <Modal open={!!editFlock} onClose={() => { setEditFlock(null); setServerError(""); }} title="Edit Flock">
        <form onSubmit={hsEdit((d) => editMutation.mutate(d))} className="space-y-4">
          <div>
            <label className={LABEL}>House *</label>
            <select {...regEdit("houseId")} className={INPUT}>
              <option value="">Select house…</option>
              {editHouses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
            {errEdit.houseId && <p className="mt-1 text-xs text-red-600">{errEdit.houseId.message}</p>}
          </div>
          <div>
            <label className={LABEL}>Batch code *</label>
            <input {...regEdit("batchCode")} className={INPUT} />
            {errEdit.batchCode && <p className="mt-1 text-xs text-red-600">{errEdit.batchCode.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Bird type *</label>
              <select {...regEdit("birdType")} className={INPUT}>
                <option value="layer">Layer</option>
                <option value="broiler">Broiler</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Breed *</label>
              <input {...regEdit("breed")} className={INPUT} />
              {errEdit.breed && <p className="mt-1 text-xs text-red-600">{errEdit.breed.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Arrival date *</label>
              <input type="date" {...regEdit("arrivalDate")} className={INPUT} />
              {errEdit.arrivalDate && <p className="mt-1 text-xs text-red-600">{errEdit.arrivalDate.message}</p>}
            </div>
            <div>
              <label className={LABEL}>Initial count *</label>
              <input type="number" {...regEdit("initialCount", { valueAsNumber: true })} className={INPUT} />
              {errEdit.initialCount && <p className="mt-1 text-xs text-red-600">{errEdit.initialCount.message}</p>}
            </div>
          </div>
          {serverError && <p className="text-xs text-red-600">{serverError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setEditFlock(null); setServerError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={subEdit} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {subEdit ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={!!deleteFlock} onClose={() => setDeleteFlock(null)} title="Delete Flock">
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete flock <span className="font-semibold text-gray-900">{deleteFlock?.batchCode}</span>? This cannot be undone.
        </p>
        {serverError && <p className="mb-4 text-xs text-red-600">{serverError}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={() => setDeleteFlock(null)} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button
            type="button"
            onClick={() => deleteMutation.mutate(deleteFlock!.id)}
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
