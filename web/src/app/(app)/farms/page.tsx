"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Plus, MapPin, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { api, extractError } from "@/lib/api";
import { formatNumber, formatDate } from "@/lib/utils";
import type { Farm } from "@/types";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  location: z.string().optional(),
  capacity: z.string().optional(),
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

export default function FarmsPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editFarm, setEditFarm] = useState<Farm | null>(null);
  const [deleteFarm, setDeleteFarm] = useState<Farm | null>(null);
  const [serverError, setServerError] = useState("");

  const { data: farms = [], isLoading } = useQuery<Farm[]>({
    queryKey: ["farms"],
    queryFn: () => api.get("/api/v1/farms").then((r) => r.data),
  });

  const { register: regAdd, handleSubmit: hsAdd, reset: resetAdd, formState: { errors: errAdd, isSubmitting: subAdd } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  const { register: regEdit, handleSubmit: hsEdit, reset: resetEdit, formState: { errors: errEdit, isSubmitting: subEdit } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  const addMutation = useMutation({
    mutationFn: (data: FormData) =>
      api.post("/api/v1/farms", {
        name: data.name,
        location: data.location || null,
        capacity: data.capacity ? parseInt(data.capacity) : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["farms"] });
      resetAdd();
      setShowAdd(false);
      setServerError("");
    },
    onError: (err) => setServerError(extractError(err)),
  });

  const editMutation = useMutation({
    mutationFn: (data: FormData) =>
      api.put(`/api/v1/farms/${editFarm!.id}`, {
        name: data.name,
        location: data.location || null,
        capacity: data.capacity ? parseInt(data.capacity) : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["farms"] });
      setEditFarm(null);
      setServerError("");
    },
    onError: (err) => setServerError(extractError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/farms/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["farms"] });
      setDeleteFarm(null);
    },
    onError: (err) => setServerError(extractError(err)),
  });

  function openEdit(farm: Farm, e: React.MouseEvent) {
    e.preventDefault();
    setServerError("");
    resetEdit({
      name: farm.name,
      location: farm.location ?? "",
      capacity: farm.capacity != null ? String(farm.capacity) : "",
    });
    setEditFarm(farm);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Farms</h1>
          <p className="text-sm text-gray-500 mt-1">{farms.length} farm{farms.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setServerError(""); }}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Farm
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-gray-200" />)}
        </div>
      ) : farms.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-200">
          <p className="text-gray-400 text-sm">No farms yet. Add your first farm to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {farms.map((farm) => (
            <div key={farm.id} className="flex items-center justify-between rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 hover:ring-green-300 transition-all group">
              <Link href={`/farms/${farm.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-700 font-bold text-sm shrink-0">
                  {farm.name[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{farm.name}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                    {farm.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {farm.location}
                      </span>
                    )}
                    {farm.capacity != null && (
                      <span>{formatNumber(farm.capacity)} capacity</span>
                    )}
                    <span>Added {formatDate(farm.createdAt)}</span>
                  </div>
                </div>
              </Link>
              <div className="flex items-center gap-1 ml-3">
                <button
                  type="button"
                  onClick={(e) => openEdit(farm, e)}
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); setDeleteFarm(farm); }}
                  className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <Link href={`/farms/${farm.id}`} className="rounded-lg p-2 text-gray-300 group-hover:text-green-500 transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Farm Modal */}
      <Modal open={showAdd} onClose={() => { setShowAdd(false); setServerError(""); resetAdd(); }} title="Add Farm">
        <form onSubmit={hsAdd((d) => addMutation.mutate(d))} className="space-y-4">
          <div>
            <label className={LABEL}>Farm name *</label>
            <input {...regAdd("name")} className={INPUT} />
            {errAdd.name && <p className="mt-1 text-xs text-red-600">{errAdd.name.message}</p>}
          </div>
          <div>
            <label className={LABEL}>Location</label>
            <input {...regAdd("location")} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Capacity (birds)</label>
            <input type="number" {...regAdd("capacity")} className={INPUT} />
          </div>
          {serverError && <p className="text-xs text-red-600">{serverError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setShowAdd(false); resetAdd(); setServerError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={subAdd} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {subAdd ? "Adding…" : "Add Farm"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Farm Modal */}
      <Modal open={!!editFarm} onClose={() => { setEditFarm(null); setServerError(""); }} title="Edit Farm">
        <form onSubmit={hsEdit((d) => editMutation.mutate(d))} className="space-y-4">
          <div>
            <label className={LABEL}>Farm name *</label>
            <input {...regEdit("name")} className={INPUT} />
            {errEdit.name && <p className="mt-1 text-xs text-red-600">{errEdit.name.message}</p>}
          </div>
          <div>
            <label className={LABEL}>Location</label>
            <input {...regEdit("location")} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Capacity (birds)</label>
            <input type="number" {...regEdit("capacity")} className={INPUT} />
          </div>
          {serverError && <p className="text-xs text-red-600">{serverError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setEditFarm(null); setServerError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={subEdit} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {subEdit ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={!!deleteFarm} onClose={() => setDeleteFarm(null)} title="Delete Farm">
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete <span className="font-semibold text-gray-900">{deleteFarm?.name}</span>? This cannot be undone.
        </p>
        {serverError && <p className="mb-4 text-xs text-red-600">{serverError}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={() => setDeleteFarm(null)} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button
            type="button"
            onClick={() => deleteMutation.mutate(deleteFarm!.id)}
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
