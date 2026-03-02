"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { api, extractError } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import type { Species, Breed } from "@/types";

// ── Styles ─────────────────────────────────────────────────────────────────────
const INPUT = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100";
const LABEL = "block text-sm font-medium text-gray-700 mb-1";

// ── Modal ──────────────────────────────────────────────────────────────────────
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

// ── Schemas ────────────────────────────────────────────────────────────────────
const speciesSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required"),
  tracksIndividuals: z.boolean(),
  isDairy: z.boolean(),
  isEggLayer: z.boolean(),
  isWool: z.boolean(),
});
type SpeciesForm = z.infer<typeof speciesSchema>;

const breedSchema = z.object({ name: z.string().min(1, "Name is required") });
type BreedForm = z.infer<typeof breedSchema>;

// ── Trait chips ────────────────────────────────────────────────────────────────
function TraitChip({ label, active }: { label: string; active: boolean }) {
  if (!active) return null;
  return (
    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
      {label}
    </span>
  );
}

// ── Breeds sub-section ─────────────────────────────────────────────────────────
function BreedsSection({ speciesId, canManage }: { speciesId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [serverError, setServerError] = useState("");

  const { data: breeds = [] } = useQuery<Breed[]>({
    queryKey: ["breeds", speciesId],
    queryFn: () => api.get(`/api/v1/species/${speciesId}/breeds`).then((r) => r.data),
  });

  const { register, handleSubmit, reset, formState: { isSubmitting } } =
    useForm<BreedForm>({ resolver: zodResolver(breedSchema) });

  const addMutation = useMutation({
    mutationFn: (d: BreedForm) => api.post(`/api/v1/species/${speciesId}/breeds`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["breeds", speciesId] });
      reset();
      setShowAdd(false);
      setServerError("");
    },
    onError: (err) => setServerError(extractError(err)),
  });

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Breeds ({breeds.length})</p>
        {canManage && !showAdd && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium"
          >
            <Plus className="h-3 w-3" /> Add Breed
          </button>
        )}
      </div>
      {breeds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {breeds.map((b) => (
            <span key={b.id} className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{b.name}</span>
          ))}
        </div>
      )}
      {showAdd && (
        <form onSubmit={handleSubmit((d) => addMutation.mutate(d))} className="flex items-center gap-2 mt-2">
          <input {...register("name")} placeholder="Breed name" className={INPUT + " text-xs py-1"} />
          {serverError && <p className="text-xs text-red-600">{serverError}</p>}
          <button type="submit" disabled={isSubmitting} className="rounded-lg bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 whitespace-nowrap">
            {isSubmitting ? "…" : "Add"}
          </button>
          <button type="button" onClick={() => { setShowAdd(false); reset(); }} className="text-xs text-gray-500 hover:text-gray-700 whitespace-nowrap">Cancel</button>
        </form>
      )}
      {breeds.length === 0 && !showAdd && (
        <p className="text-xs text-gray-400">No breeds yet.</p>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function LivestockPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const canManage = user?.role === "owner" || user?.role === "farm_manager";

  const [showAdd, setShowAdd] = useState(false);
  const [editSpecies, setEditSpecies] = useState<Species | null>(null);
  const [deleteSpecies, setDeleteSpecies] = useState<Species | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [serverError, setServerError] = useState("");

  const { data: speciesList = [], isLoading } = useQuery<Species[]>({
    queryKey: ["species"],
    queryFn: () => api.get("/api/v1/species").then((r) => r.data),
  });

  const defaultValues: SpeciesForm = { name: "", code: "", tracksIndividuals: false, isDairy: false, isEggLayer: false, isWool: false };

  const { register: regAdd, handleSubmit: hsAdd, reset: resetAdd, formState: { isSubmitting: subAdd } } =
    useForm<SpeciesForm>({ resolver: zodResolver(speciesSchema), defaultValues });

  const { register: regEdit, handleSubmit: hsEdit, reset: resetEdit, formState: { isSubmitting: subEdit } } =
    useForm<SpeciesForm>({ resolver: zodResolver(speciesSchema), defaultValues });

  const addMutation = useMutation({
    mutationFn: (d: SpeciesForm) => api.post("/api/v1/species", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["species"] }); resetAdd(); setShowAdd(false); setServerError(""); },
    onError: (err) => setServerError(extractError(err)),
  });

  const editMutation = useMutation({
    mutationFn: (d: SpeciesForm) => api.put(`/api/v1/species/${editSpecies!.id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["species"] }); setEditSpecies(null); setServerError(""); },
    onError: (err) => setServerError(extractError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/species/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["species"] }); setDeleteSpecies(null); },
    onError: (err) => setServerError(extractError(err)),
  });

  function openEdit(s: Species) {
    setServerError("");
    resetEdit({ name: s.name, code: s.code, tracksIndividuals: s.tracksIndividuals, isDairy: s.isDairy, isEggLayer: s.isEggLayer, isWool: s.isWool });
    setEditSpecies(s);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Livestock</h1>
          <p className="text-sm text-gray-500 mt-0.5">{speciesList.length} species</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/livestock/events"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Record Events
          </Link>
          {canManage && (
            <button
              type="button"
              onClick={() => { setShowAdd(true); setServerError(""); }}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
            >
              <Plus className="h-4 w-4" /> Add Species
            </button>
          )}
        </div>
      </div>

      {/* Species list */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-gray-200" />)}
        </div>
      ) : speciesList.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-200">
          <p className="text-sm text-gray-400">No species yet. Add Cattle, Goats, Sheep, etc.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {speciesList.map((s) => {
            const expanded = expandedId === s.id;
            return (
              <div key={s.id} className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
                <div className="flex items-center gap-4 p-4">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : s.id)}
                    className="flex-1 flex items-center gap-3 text-left min-w-0"
                  >
                    {expanded ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">{s.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{s.code}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 ml-2">
                      <TraitChip label="Dairy" active={s.isDairy} />
                      <TraitChip label="Egg Layer" active={s.isEggLayer} />
                      <TraitChip label="Wool" active={s.isWool} />
                      <TraitChip label="Tracks Individuals" active={s.tracksIndividuals} />
                    </div>
                  </button>
                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDeleteSpecies(s); setServerError(""); }}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                {expanded && (
                  <div className="px-5 pb-4">
                    <BreedsSection speciesId={s.id} canManage={canManage} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Species Modal */}
      <Modal open={showAdd} onClose={() => { setShowAdd(false); resetAdd(); setServerError(""); }} title="Add Species">
        <form onSubmit={hsAdd((d) => addMutation.mutate(d))} className="space-y-4">
          <div>
            <label className={LABEL}>Name *</label>
            <input {...regAdd("name")} placeholder="e.g. Cattle" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Code *</label>
            <input {...regAdd("code")} placeholder="e.g. cattle" className={INPUT} />
            <p className="mt-1 text-xs text-gray-400">Short lowercase identifier</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(["tracksIndividuals", "isDairy", "isEggLayer", "isWool"] as const).map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" {...regAdd(key)} className="rounded border-gray-300 text-green-600" />
                {key === "tracksIndividuals" ? "Track individuals" : key === "isDairy" ? "Dairy" : key === "isEggLayer" ? "Egg layer" : "Wool"}
              </label>
            ))}
          </div>
          {serverError && <p className="text-xs text-red-600">{serverError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setShowAdd(false); resetAdd(); setServerError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={subAdd} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {subAdd ? "Adding…" : "Add Species"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Species Modal */}
      <Modal open={!!editSpecies} onClose={() => { setEditSpecies(null); setServerError(""); }} title="Edit Species">
        <form onSubmit={hsEdit((d) => editMutation.mutate(d))} className="space-y-4">
          <div>
            <label className={LABEL}>Name *</label>
            <input {...regEdit("name")} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Code *</label>
            <input {...regEdit("code")} className={INPUT} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(["tracksIndividuals", "isDairy", "isEggLayer", "isWool"] as const).map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" {...regEdit(key)} className="rounded border-gray-300 text-green-600" />
                {key === "tracksIndividuals" ? "Track individuals" : key === "isDairy" ? "Dairy" : key === "isEggLayer" ? "Egg layer" : "Wool"}
              </label>
            ))}
          </div>
          {serverError && <p className="text-xs text-red-600">{serverError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setEditSpecies(null); setServerError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={subEdit} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {subEdit ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={!!deleteSpecies} onClose={() => setDeleteSpecies(null)} title="Delete Species">
        <p className="text-sm text-gray-600 mb-6">
          Delete <span className="font-semibold">{deleteSpecies?.name}</span>? This cannot be undone.
        </p>
        {serverError && <p className="mb-4 text-xs text-red-600">{serverError}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={() => setDeleteSpecies(null)} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button
            type="button"
            onClick={() => deleteMutation.mutate(deleteSpecies!.id)}
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
