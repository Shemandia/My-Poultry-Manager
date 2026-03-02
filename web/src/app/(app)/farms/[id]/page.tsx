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
import { useAuthStore } from "@/store/auth";
import type { Farm, House, Species, LivestockLocation, AnimalGroup, Animal } from "@/types";

// ── Shared ───────────────────────────────────────────────────────────────────
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

// ── Schemas ──────────────────────────────────────────────────────────────────
const houseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  houseType: z.enum(["layer", "broiler", "grower"]),
  capacity: z.string().optional(),
  notes: z.string().optional(),
});
type HouseForm = z.infer<typeof houseSchema>;

const locationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  locationType: z.enum(["Barn", "Paddock", "Pen", "House", "Shed", "Other"]),
  capacity: z.string().optional(),
  notes: z.string().optional(),
});
type LocationForm = z.infer<typeof locationSchema>;

const groupSchema = z.object({
  speciesId: z.string().min(1, "Species is required"),
  groupCode: z.string().min(1, "Group code is required"),
  name: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  initialCount: z.string().min(1, "Initial count is required"),
});
type GroupForm = z.infer<typeof groupSchema>;

const animalSchema = z.object({
  speciesId: z.string().min(1, "Species is required"),
  tagNumber: z.string().min(1, "Tag number is required"),
  sex: z.enum(["Male", "Female", "Unknown"]),
  name: z.string().optional(),
  birthDate: z.string().optional(),
  notes: z.string().optional(),
});
type AnimalForm = z.infer<typeof animalSchema>;

// ── Constants ─────────────────────────────────────────────────────────────────
const HOUSE_TYPE_LABELS: Record<string, string> = { layer: "Layer", broiler: "Broiler", grower: "Grower" };
const HOUSE_TYPE_COLORS: Record<string, string> = {
  layer: "bg-yellow-100 text-yellow-700",
  broiler: "bg-orange-100 text-orange-700",
  grower: "bg-blue-100 text-blue-700",
};
const STATUS_COLORS: Record<string, string> = {
  Alive: "bg-green-100 text-green-700",
  Active: "bg-green-100 text-green-700",
  Sold: "bg-blue-100 text-blue-700",
  Dead: "bg-gray-100 text-gray-600",
  Culled: "bg-red-100 text-red-600",
  Closed: "bg-gray-100 text-gray-500",
};

type Tab = "houses" | "locations" | "groups" | "animals";

// ── Page ─────────────────────────────────────────────────────────────────────
export default function FarmDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const canManage = user?.role === "owner" || user?.role === "farm_manager";

  const [activeTab, setActiveTab] = useState<Tab>("houses");
  const [serverError, setServerError] = useState("");

  // Modal open state
  const [showAddHouse, setShowAddHouse] = useState(false);
  const [editHouse, setEditHouse] = useState<House | null>(null);
  const [deleteHouse, setDeleteHouse] = useState<House | null>(null);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showAddAnimal, setShowAddAnimal] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: farm, isLoading: farmLoading } = useQuery<Farm>({
    queryKey: ["farms", id],
    queryFn: () => api.get(`/api/v1/farms/${id}`).then((r) => r.data),
  });
  const { data: houses = [], isLoading: housesLoading } = useQuery<House[]>({
    queryKey: ["houses", id],
    queryFn: () => api.get(`/api/v1/farms/${id}/houses`).then((r) => r.data),
  });
  const { data: locations = [], isLoading: locationsLoading } = useQuery<LivestockLocation[]>({
    queryKey: ["locations", id],
    queryFn: () => api.get(`/api/v1/farms/${id}/locations`).then((r) => r.data),
  });
  const { data: groups = [], isLoading: groupsLoading } = useQuery<AnimalGroup[]>({
    queryKey: ["groups", id],
    queryFn: () => api.get(`/api/v1/farms/${id}/groups`).then((r) => r.data),
  });
  const { data: animals = [], isLoading: animalsLoading } = useQuery<Animal[]>({
    queryKey: ["animals", id],
    queryFn: () => api.get(`/api/v1/farms/${id}/animals`).then((r) => r.data),
  });
  const { data: speciesList = [] } = useQuery<Species[]>({
    queryKey: ["species"],
    queryFn: () => api.get("/api/v1/species").then((r) => r.data),
  });

  // ── Forms ────────────────────────────────────────────────────────────────
  const { register: regAddH, handleSubmit: hsAddH, reset: resetAddH, formState: { errors: errAddH, isSubmitting: subAddH } } =
    useForm<HouseForm>({ resolver: zodResolver(houseSchema), defaultValues: { houseType: "layer" } });
  const { register: regEditH, handleSubmit: hsEditH, reset: resetEditH, formState: { errors: errEditH, isSubmitting: subEditH } } =
    useForm<HouseForm>({ resolver: zodResolver(houseSchema), defaultValues: { houseType: "layer" } });
  const { register: regLoc, handleSubmit: hsLoc, reset: resetLoc, formState: { errors: errLoc, isSubmitting: subLoc } } =
    useForm<LocationForm>({ resolver: zodResolver(locationSchema), defaultValues: { locationType: "Barn" } });
  const { register: regGrp, handleSubmit: hsGrp, reset: resetGrp, formState: { errors: errGrp, isSubmitting: subGrp } } =
    useForm<GroupForm>({ resolver: zodResolver(groupSchema) });
  const { register: regAni, handleSubmit: hsAni, reset: resetAni, formState: { errors: errAni, isSubmitting: subAni } } =
    useForm<AnimalForm>({ resolver: zodResolver(animalSchema), defaultValues: { sex: "Unknown" } });

  // ── Mutations ────────────────────────────────────────────────────────────
  const addHouseMut = useMutation({
    mutationFn: (d: HouseForm) => api.post(`/api/v1/farms/${id}/houses`, { name: d.name, houseType: d.houseType, capacity: d.capacity ? parseInt(d.capacity) : null, notes: d.notes || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["houses", id] }); resetAddH(); setShowAddHouse(false); setServerError(""); },
    onError: (err) => setServerError(extractError(err)),
  });
  const editHouseMut = useMutation({
    mutationFn: (d: HouseForm) => api.put(`/api/v1/houses/${editHouse!.id}`, { name: d.name, houseType: d.houseType, capacity: d.capacity ? parseInt(d.capacity) : null, notes: d.notes || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["houses", id] }); setEditHouse(null); setServerError(""); },
    onError: (err) => setServerError(extractError(err)),
  });
  const deleteHouseMut = useMutation({
    mutationFn: (houseId: string) => api.delete(`/api/v1/houses/${houseId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["houses", id] }); setDeleteHouse(null); },
    onError: (err) => setServerError(extractError(err)),
  });
  const addLocMut = useMutation({
    mutationFn: (d: LocationForm) => api.post(`/api/v1/farms/${id}/locations`, { name: d.name, locationType: d.locationType, capacity: d.capacity ? parseInt(d.capacity) : 0, notes: d.notes || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locations", id] }); resetLoc(); setShowAddLocation(false); setServerError(""); },
    onError: (err) => setServerError(extractError(err)),
  });
  const addGroupMut = useMutation({
    mutationFn: (d: GroupForm) => api.post(`/api/v1/farms/${id}/groups`, {
      speciesId: d.speciesId,
      groupCode: d.groupCode,
      name: d.name || null,
      startDate: new Date(d.startDate).toISOString(),
      initialCount: parseInt(d.initialCount),
      currentCount: parseInt(d.initialCount),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["groups", id] }); resetGrp(); setShowAddGroup(false); setServerError(""); },
    onError: (err) => setServerError(extractError(err)),
  });
  const closeGroupMut = useMutation({
    mutationFn: (groupId: string) => api.patch(`/api/v1/groups/${groupId}/close`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups", id] }),
    onError: (err) => setServerError(extractError(err)),
  });
  const addAnimalMut = useMutation({
    mutationFn: (d: AnimalForm) => api.post(`/api/v1/farms/${id}/animals`, {
      speciesId: d.speciesId,
      tagNumber: d.tagNumber,
      sex: d.sex,
      name: d.name || null,
      birthDate: d.birthDate ? new Date(d.birthDate).toISOString() : null,
      notes: d.notes || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["animals", id] }); resetAni(); setShowAddAnimal(false); setServerError(""); },
    onError: (err) => setServerError(extractError(err)),
  });

  // ── Helpers ──────────────────────────────────────────────────────────────
  function openEditHouse(house: House) {
    setServerError("");
    resetEditH({ name: house.name, houseType: house.houseType as "layer" | "broiler" | "grower", capacity: house.capacity != null ? String(house.capacity) : "", notes: house.notes ?? "" });
    setEditHouse(house);
  }

  function handleAddClick() {
    setServerError("");
    if (activeTab === "houses") setShowAddHouse(true);
    else if (activeTab === "locations") setShowAddLocation(true);
    else if (activeTab === "groups") setShowAddGroup(true);
    else setShowAddAnimal(true);
  }

  const ADD_LABELS: Record<Tab, string> = { houses: "Add House", locations: "Add Location", groups: "Add Group", animals: "Add Animal" };

  // ── Guards ───────────────────────────────────────────────────────────────
  if (farmLoading) return <div className="animate-pulse h-8 w-48 rounded bg-gray-200" />;
  if (!farm) return <p className="text-sm text-gray-500">Farm not found.</p>;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "houses", label: "Houses", count: houses.length },
    { key: "locations", label: "Locations", count: locations.length },
    { key: "groups", label: "Groups", count: groups.length },
    { key: "animals", label: "Animals", count: animals.length },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
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
          {canManage && (
            <button type="button" onClick={handleAddClick}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors">
              <Plus className="h-4 w-4" /> {ADD_LABELS[activeTab]}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex">
          {tabs.map((t) => (
            <button key={t.key} type="button" onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === t.key ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {t.label} <span className="ml-1 text-xs text-gray-400">({t.count})</span>
            </button>
          ))}
        </nav>
      </div>

      {/* ── HOUSES ─────────────────────────────────────────────────────── */}
      {activeTab === "houses" && (
        housesLoading ? (
          <div className="space-y-3 animate-pulse">{[...Array(2)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-gray-200" />)}</div>
        ) : houses.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-200">
            <p className="text-sm text-gray-400">No houses yet. Add the first house.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {houses.map((house) => (
              <div key={house.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-gray-900">{house.name}</p>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${HOUSE_TYPE_COLORS[house.houseType] ?? "bg-gray-100 text-gray-600"}`}>
                    {HOUSE_TYPE_LABELS[house.houseType] ?? house.houseType}
                  </span>
                </div>
                {house.capacity != null && <p className="text-xs text-gray-400">{formatNumber(house.capacity)} capacity</p>}
                {house.notes && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{house.notes}</p>}
                {canManage && (
                  <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-100">
                    <button type="button" onClick={() => openEditHouse(house)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button type="button" onClick={() => { setDeleteHouse(house); setServerError(""); }} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors">
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* ── LOCATIONS ──────────────────────────────────────────────────── */}
      {activeTab === "locations" && (
        locationsLoading ? (
          <div className="space-y-3 animate-pulse">{[...Array(2)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-gray-200" />)}</div>
        ) : locations.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-200">
            <p className="text-sm text-gray-400">No locations yet. Add a barn, pen, paddock, etc.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {locations.map((loc) => (
              <div key={loc.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-gray-900">{loc.name}</p>
                  <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">{loc.locationType}</span>
                </div>
                {loc.capacity > 0 && <p className="text-xs text-gray-400">{formatNumber(loc.capacity)} capacity</p>}
                {loc.notes && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{loc.notes}</p>}
              </div>
            ))}
          </div>
        )
      )}

      {/* ── GROUPS ─────────────────────────────────────────────────────── */}
      {activeTab === "groups" && (
        groupsLoading ? (
          <div className="space-y-3 animate-pulse">{[...Array(2)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-gray-200" />)}</div>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-200">
            <p className="text-sm text-gray-400">No groups yet. Create a flock, herd, or pen group.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((grp) => {
              const sp = speciesList.find((s) => s.id === grp.speciesId);
              return (
                <div key={grp.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div>
                        <p className="font-semibold text-gray-900 font-mono text-sm">{grp.groupCode}</p>
                        {grp.name && <p className="text-xs text-gray-500">{grp.name}</p>}
                      </div>
                      {sp && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">{sp.name}</span>}
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[grp.status] ?? "bg-gray-100 text-gray-600"}`}>{grp.status}</span>
                    </div>
                    {canManage && grp.status === "Active" && (
                      <button type="button" onClick={() => closeGroupMut.mutate(grp.id)} disabled={closeGroupMut.isPending}
                        className="text-xs text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-300 rounded-lg px-3 py-1 transition-colors disabled:opacity-50">
                        Close
                      </button>
                    )}
                  </div>
                  <div className="mt-3 flex gap-6 text-xs text-gray-500">
                    <span>Started {new Date(grp.startDate).toLocaleDateString()}</span>
                    <span>Initial: {formatNumber(grp.initialCount)}</span>
                    <span>Current: {formatNumber(grp.currentCount)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── ANIMALS ────────────────────────────────────────────────────── */}
      {activeTab === "animals" && (
        animalsLoading ? (
          <div className="space-y-3 animate-pulse">{[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-gray-200" />)}</div>
        ) : animals.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-200">
            <p className="text-sm text-gray-400">No individual animals yet.</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 divide-y divide-gray-100">
            {animals.map((a) => {
              const sp = speciesList.find((s) => s.id === a.speciesId);
              return (
                <div key={a.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm font-mono">{a.tagNumber}</p>
                    {a.name && <p className="text-xs text-gray-500">{a.name}</p>}
                  </div>
                  {sp && <span className="text-xs text-gray-400">{sp.name}</span>}
                  <span className="text-xs text-gray-400">{a.sex}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[a.status] ?? "bg-gray-100 text-gray-600"}`}>{a.status}</span>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── MODALS ───────────────────────────────────────────────────────── */}

      {/* Add House */}
      <Modal open={showAddHouse} onClose={() => { setShowAddHouse(false); resetAddH(); setServerError(""); }} title="Add House">
        <form onSubmit={hsAddH((d) => addHouseMut.mutate(d))} className="space-y-4">
          <div>
            <label className={LABEL}>House name *</label>
            <input {...regAddH("name")} className={INPUT} />
            {errAddH.name && <p className="mt-1 text-xs text-red-600">{errAddH.name.message}</p>}
          </div>
          <div>
            <label className={LABEL}>House type *</label>
            <select {...regAddH("houseType")} className={INPUT}>
              <option value="layer">Layer</option>
              <option value="broiler">Broiler</option>
              <option value="grower">Grower</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>Capacity (birds)</label>
            <input type="number" {...regAddH("capacity")} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Notes</label>
            <textarea {...regAddH("notes")} rows={2} className={INPUT + " resize-none"} />
          </div>
          {serverError && <p className="text-xs text-red-600">{serverError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setShowAddHouse(false); resetAddH(); setServerError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={subAddH} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {subAddH ? "Adding…" : "Add House"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit House */}
      <Modal open={!!editHouse} onClose={() => { setEditHouse(null); setServerError(""); }} title="Edit House">
        <form onSubmit={hsEditH((d) => editHouseMut.mutate(d))} className="space-y-4">
          <div>
            <label className={LABEL}>House name *</label>
            <input {...regEditH("name")} className={INPUT} />
            {errEditH.name && <p className="mt-1 text-xs text-red-600">{errEditH.name.message}</p>}
          </div>
          <div>
            <label className={LABEL}>House type *</label>
            <select {...regEditH("houseType")} className={INPUT}>
              <option value="layer">Layer</option>
              <option value="broiler">Broiler</option>
              <option value="grower">Grower</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>Capacity (birds)</label>
            <input type="number" {...regEditH("capacity")} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Notes</label>
            <textarea {...regEditH("notes")} rows={2} className={INPUT + " resize-none"} />
          </div>
          {serverError && <p className="text-xs text-red-600">{serverError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setEditHouse(null); setServerError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={subEditH} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {subEditH ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete House */}
      <Modal open={!!deleteHouse} onClose={() => setDeleteHouse(null)} title="Delete House">
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete <span className="font-semibold text-gray-900">{deleteHouse?.name}</span>? This cannot be undone.
        </p>
        {serverError && <p className="mb-4 text-xs text-red-600">{serverError}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={() => setDeleteHouse(null)} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button type="button" onClick={() => deleteHouseMut.mutate(deleteHouse!.id)} disabled={deleteHouseMut.isPending} className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
            {deleteHouseMut.isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </Modal>

      {/* Add Location */}
      <Modal open={showAddLocation} onClose={() => { setShowAddLocation(false); resetLoc(); setServerError(""); }} title="Add Location">
        <form onSubmit={hsLoc((d) => addLocMut.mutate(d))} className="space-y-4">
          <div>
            <label className={LABEL}>Name *</label>
            <input {...regLoc("name")} placeholder="e.g. North Barn" className={INPUT} />
            {errLoc.name && <p className="mt-1 text-xs text-red-600">{errLoc.name.message}</p>}
          </div>
          <div>
            <label className={LABEL}>Type *</label>
            <select {...regLoc("locationType")} className={INPUT}>
              {["Barn", "Paddock", "Pen", "House", "Shed", "Other"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Capacity (animals)</label>
            <input type="number" {...regLoc("capacity")} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Notes</label>
            <textarea {...regLoc("notes")} rows={2} className={INPUT + " resize-none"} />
          </div>
          {serverError && <p className="text-xs text-red-600">{serverError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setShowAddLocation(false); resetLoc(); setServerError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={subLoc} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {subLoc ? "Adding…" : "Add Location"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Group */}
      <Modal open={showAddGroup} onClose={() => { setShowAddGroup(false); resetGrp(); setServerError(""); }} title="Add Group">
        <form onSubmit={hsGrp((d) => addGroupMut.mutate(d))} className="space-y-4">
          <div>
            <label className={LABEL}>Species *</label>
            <select {...regGrp("speciesId")} className={INPUT}>
              <option value="">Select species…</option>
              {speciesList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {errGrp.speciesId && <p className="mt-1 text-xs text-red-600">{errGrp.speciesId.message}</p>}
          </div>
          <div>
            <label className={LABEL}>Group code *</label>
            <input {...regGrp("groupCode")} placeholder="e.g. GOAT-2026-A" className={INPUT} />
            {errGrp.groupCode && <p className="mt-1 text-xs text-red-600">{errGrp.groupCode.message}</p>}
          </div>
          <div>
            <label className={LABEL}>Name</label>
            <input {...regGrp("name")} placeholder="Optional display name" className={INPUT} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Start date *</label>
              <input type="date" {...regGrp("startDate")} className={INPUT} />
              {errGrp.startDate && <p className="mt-1 text-xs text-red-600">{errGrp.startDate.message}</p>}
            </div>
            <div>
              <label className={LABEL}>Initial count *</label>
              <input type="number" min={1} {...regGrp("initialCount")} className={INPUT} />
              {errGrp.initialCount && <p className="mt-1 text-xs text-red-600">{errGrp.initialCount.message}</p>}
            </div>
          </div>
          {serverError && <p className="text-xs text-red-600">{serverError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setShowAddGroup(false); resetGrp(); setServerError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={subGrp} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {subGrp ? "Adding…" : "Add Group"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Animal */}
      <Modal open={showAddAnimal} onClose={() => { setShowAddAnimal(false); resetAni(); setServerError(""); }} title="Add Animal">
        <form onSubmit={hsAni((d) => addAnimalMut.mutate(d))} className="space-y-4">
          <div>
            <label className={LABEL}>Species *</label>
            <select {...regAni("speciesId")} className={INPUT}>
              <option value="">Select species…</option>
              {speciesList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {errAni.speciesId && <p className="mt-1 text-xs text-red-600">{errAni.speciesId.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Tag number *</label>
              <input {...regAni("tagNumber")} placeholder="e.g. COW-001" className={INPUT} />
              {errAni.tagNumber && <p className="mt-1 text-xs text-red-600">{errAni.tagNumber.message}</p>}
            </div>
            <div>
              <label className={LABEL}>Sex *</label>
              <select {...regAni("sex")} className={INPUT}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Unknown">Unknown</option>
              </select>
            </div>
          </div>
          <div>
            <label className={LABEL}>Name</label>
            <input {...regAni("name")} placeholder="Optional name" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Birth date</label>
            <input type="date" {...regAni("birthDate")} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Notes</label>
            <textarea {...regAni("notes")} rows={2} className={INPUT + " resize-none"} />
          </div>
          {serverError && <p className="text-xs text-red-600">{serverError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setShowAddAnimal(false); resetAni(); setServerError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={subAni} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {subAni ? "Adding…" : "Add Animal"}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
