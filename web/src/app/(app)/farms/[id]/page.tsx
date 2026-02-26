"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { api, extractError } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import type { Farm, House } from "@/types";

const houseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  houseType: z.enum(["layer", "broiler", "grower"]),
  capacity: z.string().optional(),
  notes: z.string().optional(),
});
type HouseForm = z.infer<typeof houseSchema>;

const HOUSE_TYPE_LABELS: Record<string, string> = {
  layer: "Layer",
  broiler: "Broiler",
  grower: "Grower",
};

const HOUSE_TYPE_COLORS: Record<string, string> = {
  layer: "bg-yellow-100 text-yellow-700",
  broiler: "bg-orange-100 text-orange-700",
  grower: "bg-blue-100 text-blue-700",
};

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

export default function FarmDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editHouse, setEditHouse] = useState<House | null>(null);
  const [deleteHouse, setDeleteHouse] = useState<House | null>(null);
  const [serverError, setServerError] = useState("");

  const { data: farm, isLoading: farmLoading } = useQuery<Farm>({
    queryKey: ["farms", id],
    queryFn: () => api.get(`/api/v1/farms/${id}`).then((r) => r.data),
  });

  const { data: houses = [], isLoading: housesLoading } = useQuery<House[]>({
    queryKey: ["houses", id],
    queryFn: () => api.get(`/api/v1/farms/${id}/houses`).then((r) => r.data),
  });

  const { register: regAdd, handleSubmit: hsAdd, reset: resetAdd, formState: { errors: errAdd, isSubmitting: subAdd } } =
    useForm<HouseForm>({ resolver: zodResolver(houseSchema), defaultValues: { houseType: "layer" } });

  const { register: regEdit, handleSubmit: hsEdit, reset: resetEdit, formState: { errors: errEdit, isSubmitting: subEdit } } =
    useForm<HouseForm>({ resolver: zodResolver(houseSchema), defaultValues: { houseType: "layer" } });

  const addMutation = useMutation({
    mutationFn: (data: HouseForm) =>
      api.post(`/api/v1/farms/${id}/houses`, {
        name: data.name,
        houseType: data.houseType,
        capacity: data.capacity ? parseInt(data.capacity) : null,
        notes: data.notes || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["houses", id] });
      resetAdd();
      setShowAdd(false);
      setServerError("");
    },
    onError: (err) => setServerError(extractError(err)),
  });

  const editMutation = useMutation({
    mutationFn: (data: HouseForm) =>
      api.put(`/api/v1/farms/${id}/houses/${editHouse!.id}`, {
        name: data.name,
        houseType: data.houseType,
        capacity: data.capacity ? parseInt(data.capacity) : null,
        notes: data.notes || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["houses", id] });
      setEditHouse(null);
      setServerError("");
    },
    onError: (err) => setServerError(extractError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (houseId: string) => api.delete(`/api/v1/farms/${id}/houses/${houseId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["houses", id] });
      setDeleteHouse(null);
    },
    onError: (err) => setServerError(extractError(err)),
  });

  function openEdit(house: House) {
    setServerError("");
    resetEdit({
      name: house.name,
      houseType: house.houseType as "layer" | "broiler" | "grower",
      capacity: house.capacity != null ? String(house.capacity) : "",
      notes: house.notes ?? "",
    });
    setEditHouse(house);
  }

  if (farmLoading) {
    return <div className="animate-pulse h-8 w-48 rounded bg-gray-200" />;
  }

  if (!farm) {
    return <p className="text-sm text-gray-500">Farm not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/farms" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Farms
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{farm.name}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
              {farm.location && <span>{farm.location}</span>}
              {farm.capacity != null && <span>{formatNumber(farm.capacity)} capacity</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setShowAdd(true); setServerError(""); }}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
          >
            <Plus className="h-4 w-4" /> Add House
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">
          Houses ({houses.length})
        </h2>
        {housesLoading ? (
          <div className="space-y-3 animate-pulse">
            {[...Array(2)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-gray-200" />)}
          </div>
        ) : houses.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-200">
            <p className="text-sm text-gray-400">No houses yet. Add the first house.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {houses.map((house) => (
              <div key={house.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 group">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-gray-900">{house.name}</p>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${HOUSE_TYPE_COLORS[house.houseType] ?? "bg-gray-100 text-gray-600"}`}>
                    {HOUSE_TYPE_LABELS[house.houseType] ?? house.houseType}
                  </span>
                </div>
                {house.capacity != null && (
                  <p className="text-xs text-gray-400">{formatNumber(house.capacity)} capacity</p>
                )}
                {house.notes && (
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">{house.notes}</p>
                )}
                <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => openEdit(house)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDeleteHouse(house); setServerError(""); }}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add House Modal */}
      <Modal open={showAdd} onClose={() => { setShowAdd(false); resetAdd(); setServerError(""); }} title="Add House">
        <form onSubmit={hsAdd((d) => addMutation.mutate(d))} className="space-y-4">
          <div>
            <label className={LABEL}>House name *</label>
            <input {...regAdd("name")} className={INPUT} />
            {errAdd.name && <p className="mt-1 text-xs text-red-600">{errAdd.name.message}</p>}
          </div>
          <div>
            <label className={LABEL}>House type *</label>
            <select {...regAdd("houseType")} className={INPUT}>
              <option value="layer">Layer</option>
              <option value="broiler">Broiler</option>
              <option value="grower">Grower</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>Capacity (birds)</label>
            <input type="number" {...regAdd("capacity")} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Notes</label>
            <textarea {...regAdd("notes")} rows={2} className={INPUT + " resize-none"} />
          </div>
          {serverError && <p className="text-xs text-red-600">{serverError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setShowAdd(false); resetAdd(); setServerError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={subAdd} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {subAdd ? "Adding…" : "Add House"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit House Modal */}
      <Modal open={!!editHouse} onClose={() => { setEditHouse(null); setServerError(""); }} title="Edit House">
        <form onSubmit={hsEdit((d) => editMutation.mutate(d))} className="space-y-4">
          <div>
            <label className={LABEL}>House name *</label>
            <input {...regEdit("name")} className={INPUT} />
            {errEdit.name && <p className="mt-1 text-xs text-red-600">{errEdit.name.message}</p>}
          </div>
          <div>
            <label className={LABEL}>House type *</label>
            <select {...regEdit("houseType")} className={INPUT}>
              <option value="layer">Layer</option>
              <option value="broiler">Broiler</option>
              <option value="grower">Grower</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>Capacity (birds)</label>
            <input type="number" {...regEdit("capacity")} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Notes</label>
            <textarea {...regEdit("notes")} rows={2} className={INPUT + " resize-none"} />
          </div>
          {serverError && <p className="text-xs text-red-600">{serverError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setEditHouse(null); setServerError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={subEdit} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {subEdit ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete House Confirmation */}
      <Modal open={!!deleteHouse} onClose={() => setDeleteHouse(null)} title="Delete House">
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete <span className="font-semibold text-gray-900">{deleteHouse?.name}</span>? This cannot be undone.
        </p>
        {serverError && <p className="mb-4 text-xs text-red-600">{serverError}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={() => setDeleteHouse(null)} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button
            type="button"
            onClick={() => deleteMutation.mutate(deleteHouse!.id)}
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
