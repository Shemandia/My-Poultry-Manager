"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import type {
  Animal, Species, Breed, AnimalGroup, LivestockLocation,
  MatingRecord, PregnancyRecord, MilkRecord,
  HealthEvent, LivestockWeightRecord, MovementEvent,
} from "@/types";

const STATUS_COLORS: Record<string, string> = {
  Alive:  "bg-green-100 text-green-700",
  Sold:   "bg-blue-100 text-blue-700",
  Dead:   "bg-gray-100 text-gray-600",
  Culled: "bg-red-100 text-red-600",
};
const EVENT_COLORS: Record<string, string> = {
  Vaccination: "bg-blue-100 text-blue-700",
  Treatment:   "bg-orange-100 text-orange-700",
  Illness:     "bg-red-100 text-red-600",
  Checkup:     "bg-green-100 text-green-700",
  Deworming:   "bg-purple-100 text-purple-700",
  Other:       "bg-gray-100 text-gray-600",
};
const PREGNANCY_COLORS: Record<string, string> = {
  Suspected:   "bg-yellow-100 text-yellow-700",
  Confirmed:   "bg-blue-100 text-blue-700",
  GaveBirth:   "bg-green-100 text-green-700",
  Aborted:     "bg-red-100 text-red-600",
  NotPregnant: "bg-gray-100 text-gray-500",
};

function fmt(d: string) { return new Date(d).toLocaleDateString(); }
function age(birthDate: string | null) {
  if (!birthDate) return null;
  const ms = Date.now() - new Date(birthDate).getTime();
  const days = Math.floor(ms / 86400000);
  if (days < 30) return `${days}d old`;
  if (days < 365) return `${Math.floor(days / 30)}mo old`;
  return `${(days / 365).toFixed(1)}yr old`;
}

type Tab = "health" | "weight" | "movements" | "milk" | "breeding";

export default function AnimalProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("health");
  const [editingStatus, setEditingStatus] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");

  // ── Animal + supporting data ──────────────────────────────────────────────
  const { data: animal, isLoading } = useQuery<Animal>({
    queryKey: ["animal", id],
    queryFn: () => api.get(`/api/v1/animals/${id}`).then(r => r.data),
  });

  const { data: speciesList = [] } = useQuery<Species[]>({
    queryKey: ["species"],
    queryFn: () => api.get("/api/v1/species").then(r => r.data),
  });

  const { data: breeds = [] } = useQuery<Breed[]>({
    queryKey: ["breeds", animal?.speciesId],
    queryFn: () => api.get(`/api/v1/species/${animal!.speciesId}/breeds`).then(r => r.data),
    enabled: !!animal?.speciesId,
  });

  const { data: groups = [] } = useQuery<AnimalGroup[]>({
    queryKey: ["groups", animal?.farmId],
    queryFn: () => api.get(`/api/v1/farms/${animal!.farmId}/groups`).then(r => r.data),
    enabled: !!animal?.farmId,
  });

  const { data: locations = [] } = useQuery<LivestockLocation[]>({
    queryKey: ["locations", animal?.farmId],
    queryFn: () => api.get(`/api/v1/farms/${animal!.farmId}/locations`).then(r => r.data),
    enabled: !!animal?.farmId,
  });

  // ── Per-animal tab queries ────────────────────────────────────────────────
  const { data: healthEvents = [] } = useQuery<HealthEvent[]>({
    queryKey: ["health-events", animal?.farmId, "animal", id],
    queryFn: () => api.get(`/api/v1/farms/${animal!.farmId}/health-events`, { params: { animalId: id } }).then(r => r.data),
    enabled: !!animal?.farmId && activeTab === "health",
  });

  const { data: weightRecords = [] } = useQuery<LivestockWeightRecord[]>({
    queryKey: ["weight-records", animal?.farmId, "animal", id],
    queryFn: () => api.get(`/api/v1/farms/${animal!.farmId}/weight-records`, { params: { animalId: id } }).then(r => r.data),
    enabled: !!animal?.farmId && activeTab === "weight",
  });

  const { data: movements = [] } = useQuery<MovementEvent[]>({
    queryKey: ["movements", animal?.farmId, "animal", id],
    queryFn: () => api.get(`/api/v1/farms/${animal!.farmId}/movements`, { params: { animalId: id } }).then(r => r.data),
    enabled: !!animal?.farmId && activeTab === "movements",
  });

  const { data: milkRecords = [] } = useQuery<MilkRecord[]>({
    queryKey: ["milk", animal?.farmId, "animal", id],
    queryFn: () => api.get(`/api/v1/farms/${animal!.farmId}/milk`, { params: { animalId: id } }).then(r => r.data),
    enabled: !!animal?.farmId && activeTab === "milk",
  });

  const { data: matings = [] } = useQuery<MatingRecord[]>({
    queryKey: ["matings", animal?.farmId, "dam", id],
    queryFn: () => api.get(`/api/v1/farms/${animal!.farmId}/matings`).then(r =>
      (r.data as MatingRecord[]).filter(m => m.damId === id)),
    enabled: !!animal?.farmId && activeTab === "breeding",
  });

  const { data: pregnancies = [] } = useQuery<PregnancyRecord[]>({
    queryKey: ["pregnancies", animal?.farmId, "dam", id],
    queryFn: () => api.get(`/api/v1/farms/${animal!.farmId}/pregnancies`).then(r =>
      (r.data as PregnancyRecord[]).filter(p => p.damId === id)),
    enabled: !!animal?.farmId && activeTab === "breeding",
  });

  const statusMut = useMutation({
    mutationFn: (status: string) => api.patch(`/api/v1/animals/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["animal", id] });
      setEditingStatus(false);
    },
  });

  // ── Loading / not found ───────────────────────────────────────────────────
  if (isLoading) return <div className="animate-pulse h-32 rounded-2xl bg-gray-200" />;
  if (!animal)   return <p className="text-sm text-gray-500">Animal not found.</p>;

  const species  = speciesList.find(s => s.id === animal.speciesId);
  const breed    = breeds.find(b => b.id === animal.breedId);
  const group    = groups.find(g => g.id === animal.groupId);
  const showMilk = species?.isDairy;
  const locName  = (locId: string | null) => locId ? (locations.find(l => l.id === locId)?.name ?? "?") : "—";

  const tabs: { key: Tab; label: string }[] = [
    { key: "health",    label: "Health" },
    { key: "weight",    label: "Weight" },
    { key: "movements", label: "Movements" },
    ...(showMilk ? [{ key: "milk" as Tab, label: "Milk" }] : []),
    { key: "breeding",  label: "Breeding" },
  ];

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href={`/farms/${animal.farmId}`} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Farm
      </Link>

      {/* Header card */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-5">
            <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-green-100 text-green-700 text-xl font-bold shrink-0">
              {animal.sex === "Male" ? "♂" : animal.sex === "Female" ? "♀" : "?"}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900 font-mono">{animal.tagNumber}</h1>
                {animal.name && <span className="text-gray-500 text-lg">{animal.name}</span>}
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[animal.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {animal.status}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-500">
                {species && <span>{species.name}</span>}
                {breed   && <span>· {breed.name}</span>}
                {group   && <span>· Group: {group.groupCode}</span>}
                {animal.birthDate && <span>· Born {fmt(animal.birthDate)} ({age(animal.birthDate)})</span>}
              </div>
              {animal.notes && <p className="mt-2 text-xs text-gray-400">{animal.notes}</p>}
            </div>
          </div>

          {/* Status editor */}
          <div className="shrink-0">
            {!editingStatus ? (
              <button type="button" onClick={() => { setSelectedStatus(animal.status); setEditingStatus(true); }}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Change Status
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}
                  className="rounded-lg border border-gray-300 px-2 py-1 text-xs outline-none focus:border-green-500">
                  <option value="Alive">Alive</option>
                  <option value="Sold">Sold</option>
                  <option value="Dead">Dead</option>
                  <option value="Culled">Culled</option>
                </select>
                <button type="button" onClick={() => statusMut.mutate(selectedStatus)}
                  disabled={statusMut.isPending}
                  className="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                  {statusMut.isPending ? "…" : "Save"}
                </button>
                <button type="button" onClick={() => setEditingStatus(false)}
                  className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex">
          {tabs.map(t => (
            <button key={t.key} type="button" onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === t.key ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tab content ────────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">

        {/* Health */}
        {activeTab === "health" && (
          healthEvents.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No health events recorded for this animal.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {healthEvents.map(e => (
                <div key={e.id} className="flex items-start gap-4 py-3">
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium mt-0.5 ${EVENT_COLORS[e.eventType] ?? "bg-gray-100 text-gray-600"}`}>
                    {e.eventType}
                  </span>
                  <div className="flex-1 min-w-0 text-xs">
                    {e.diagnosis && <span className="text-gray-700">{e.diagnosis}</span>}
                    {e.medication && <span className="ml-2 text-gray-500">· {e.medication}{e.dose ? ` ${e.dose}` : ""}</span>}
                    {e.notes && <p className="text-gray-400 mt-0.5 truncate">{e.notes}</p>}
                    {e.nextDueDate && <p className="text-orange-500 mt-0.5">Follow-up: {fmt(e.nextDueDate)}</p>}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{fmt(e.eventDate)}</span>
                </div>
              ))}
            </div>
          )
        )}

        {/* Weight */}
        {activeTab === "weight" && (
          weightRecords.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No weight records for this animal.</p>
          ) : (
            <div className="space-y-2">
              {weightRecords.map((r, i) => {
                const prev = weightRecords[i + 1];
                const delta = prev ? r.weightKg - prev.weightKg : null;
                return (
                  <div key={r.id} className="flex items-center gap-4">
                    <span className="text-xl font-bold text-gray-900 w-20 shrink-0">{r.weightKg} kg</span>
                    {delta !== null && (
                      <span className={`text-xs font-medium ${delta >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {delta >= 0 ? "+" : ""}{delta.toFixed(2)} kg
                      </span>
                    )}
                    {r.notes && <span className="text-xs text-gray-400 flex-1 truncate">{r.notes}</span>}
                    <span className="text-xs text-gray-400 shrink-0 ml-auto">{fmt(r.recordDate)}</span>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Movements */}
        {activeTab === "movements" && (
          movements.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No movement records for this animal.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {movements.map(m => (
                <div key={m.id} className="flex items-center gap-4 py-3 text-sm">
                  <span className="text-gray-500">{locName(m.fromLocationId)}</span>
                  <ArrowLeft className="h-4 w-4 rotate-180 text-gray-400 shrink-0" />
                  <span className="font-medium text-gray-900">{locName(m.toLocationId)}</span>
                  {m.reason && <span className="text-xs text-gray-400 ml-2">· {m.reason}</span>}
                  <span className="ml-auto text-xs text-gray-400 shrink-0">{fmt(m.moveDate)}</span>
                </div>
              ))}
            </div>
          )
        )}

        {/* Milk (dairy only) */}
        {activeTab === "milk" && showMilk && (
          milkRecords.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No milk records for this animal.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {milkRecords.map(m => (
                <div key={m.id} className="flex items-center gap-4 py-3">
                  <span className="text-lg font-bold text-gray-900 w-20 shrink-0">{m.quantityLitres} L</span>
                  <span className="text-xs rounded-full bg-blue-100 text-blue-700 px-2 py-0.5">{m.session}</span>
                  {m.notes && <span className="text-xs text-gray-400 flex-1 truncate">{m.notes}</span>}
                  <span className="text-xs text-gray-400 shrink-0 ml-auto">{m.recordDate}</span>
                </div>
              ))}
            </div>
          )
        )}

        {/* Breeding */}
        {activeTab === "breeding" && (
          <div className="space-y-6">
            {/* Pregnancies */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Pregnancy Records ({pregnancies.length})</h3>
              {pregnancies.length === 0 ? (
                <p className="text-xs text-gray-400">No pregnancy records.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {pregnancies.map(p => (
                    <div key={p.id} className="flex items-center gap-4 py-2.5 text-xs">
                      <span className={`rounded-full px-2.5 py-0.5 font-medium ${PREGNANCY_COLORS[p.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {p.status}
                      </span>
                      <span className="text-gray-500">Due: {p.expectedDueDate}</span>
                      {p.actualBirthDate && <span className="text-green-600">Born: {p.actualBirthDate}</span>}
                      {p.notes && <span className="text-gray-400 truncate">{p.notes}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Matings */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Mating Records ({matings.length})</h3>
              {matings.length === 0 ? (
                <p className="text-xs text-gray-400">No mating records.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {matings.map(m => (
                    <div key={m.id} className="flex items-center gap-4 py-2.5 text-xs">
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 font-medium text-gray-600">{m.matingMethod}</span>
                      {m.sireTag && <span className="text-gray-500">Sire: {m.sireTag}</span>}
                      {m.notes && <span className="text-gray-400 truncate">{m.notes}</span>}
                      <span className="ml-auto text-gray-400">{m.matingDate}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
