"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Activity, Scale, MoveRight, Wheat, CheckCircle2 } from "lucide-react";
import { api, extractError } from "@/lib/api";
import type {
  Animal, AnimalGroup, Farm, LivestockLocation, Species,
  HealthEvent, LivestockWeightRecord, MovementEvent, LivestockFeedEvent,
} from "@/types";

const INPUT =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100";
const LABEL = "block text-sm font-medium text-gray-700 mb-1";

const HEALTH_EVENT_TYPES = [
  "Vaccination", "Treatment", "Illness", "Checkup", "Deworming", "Other",
] as const;

type Tab = "health" | "weight" | "movement" | "feed";
type ViewMode = "record" | "history";

// ── Schemas ────────────────────────────────────────────────────────────────────
const healthSchema = z.object({
  speciesId:   z.string().uuid("Species is required"),
  eventDate:   z.string().min(1, "Date is required"),
  eventType:   z.enum(HEALTH_EVENT_TYPES),
  groupId:     z.string().optional(),
  animalId:    z.string().optional(),
  diagnosis:   z.string().optional(),
  medication:  z.string().optional(),
  dose:        z.string().optional(),
  nextDueDate: z.string().optional(),
  notes:       z.string().optional(),
});
type HealthForm = z.infer<typeof healthSchema>;

const weightSchema = z.object({
  speciesId:    z.string().uuid("Species is required"),
  recordDate:   z.string().min(1, "Date is required"),
  weightKg:     z.string().min(1, "Weight is required"),
  sampledCount: z.string().min(1, "Sampled count is required"),
  groupId:      z.string().optional(),
  animalId:     z.string().optional(),
  notes:        z.string().optional(),
});
type WeightForm = z.infer<typeof weightSchema>;

const movementSchema = z.object({
  speciesId:      z.string().uuid("Species is required"),
  moveDate:       z.string().min(1, "Date is required"),
  groupId:        z.string().optional(),
  animalId:       z.string().optional(),
  fromLocationId: z.string().optional(),
  toLocationId:   z.string().optional(),
  reason:         z.string().optional(),
  notes:          z.string().optional(),
});
type MovementForm = z.infer<typeof movementSchema>;

const feedSchema = z.object({
  speciesId:  z.string().uuid("Species is required"),
  eventDate:  z.string().min(1, "Date is required"),
  feedName:   z.string().min(1, "Feed name is required"),
  quantityKg: z.string().min(1, "Quantity is required"),
  cost:       z.string().min(1, "Cost is required"),
  groupId:    z.string().optional(),
  animalId:   z.string().optional(),
  notes:      z.string().optional(),
});
type FeedForm = z.infer<typeof feedSchema>;

function toIsoDate(dateValue: string) {
  return new Date(`${dateValue}T00:00:00`).toISOString();
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString();
}

// ── History list components ────────────────────────────────────────────────────
function HealthHistory({ farmId, animals }: { farmId: string; animals: Animal[] }) {
  const { data: events = [], isLoading } = useQuery<HealthEvent[]>({
    queryKey: ["health-events", farmId],
    queryFn: () => api.get(`/api/v1/farms/${farmId}/health-events`).then(r => r.data),
    enabled: !!farmId,
  });
  const EVENT_COLORS: Record<string, string> = {
    Vaccination: "bg-blue-100 text-blue-700",
    Treatment:   "bg-orange-100 text-orange-700",
    Illness:     "bg-red-100 text-red-600",
    Checkup:     "bg-green-100 text-green-700",
    Deworming:   "bg-purple-100 text-purple-700",
    Other:       "bg-gray-100 text-gray-600",
  };
  if (isLoading) return <div className="animate-pulse h-16 rounded-lg bg-gray-100" />;
  if (events.length === 0) return <p className="text-sm text-gray-400 text-center py-6">No health events recorded yet.</p>;
  return (
    <div className="divide-y divide-gray-100">
      {events.map(e => {
        const animal = e.animalId ? animals.find(a => a.id === e.animalId) : null;
        return (
          <div key={e.id} className="flex items-start gap-4 py-3">
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium mt-0.5 ${EVENT_COLORS[e.eventType] ?? "bg-gray-100 text-gray-600"}`}>
              {e.eventType}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {animal && <span className="text-xs font-mono text-gray-700">{animal.tagNumber}</span>}
                {e.diagnosis && <span className="text-xs text-gray-500">{e.diagnosis}</span>}
                {e.medication && <span className="text-xs text-gray-400">· {e.medication}{e.dose ? ` ${e.dose}` : ""}</span>}
              </div>
              {e.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{e.notes}</p>}
            </div>
            <span className="text-xs text-gray-400 shrink-0">{fmt(e.eventDate)}</span>
          </div>
        );
      })}
    </div>
  );
}

function WeightHistory({ farmId, animals }: { farmId: string; animals: Animal[] }) {
  const { data: records = [], isLoading } = useQuery<LivestockWeightRecord[]>({
    queryKey: ["weight-records", farmId],
    queryFn: () => api.get(`/api/v1/farms/${farmId}/weight-records`).then(r => r.data),
    enabled: !!farmId,
  });
  if (isLoading) return <div className="animate-pulse h-16 rounded-lg bg-gray-100" />;
  if (records.length === 0) return <p className="text-sm text-gray-400 text-center py-6">No weight records yet.</p>;
  return (
    <div className="divide-y divide-gray-100">
      {records.map(r => {
        const animal = r.animalId ? animals.find(a => a.id === r.animalId) : null;
        return (
          <div key={r.id} className="flex items-center gap-4 py-3">
            <span className="text-lg font-bold text-gray-900 w-20 shrink-0">{r.weightKg} kg</span>
            <div className="flex-1 min-w-0 text-xs text-gray-500">
              {animal && <span className="font-mono text-gray-700 mr-2">{animal.tagNumber}</span>}
              <span>n={r.sampledCount}</span>
              {r.notes && <span className="ml-2 text-gray-400 truncate">{r.notes}</span>}
            </div>
            <span className="text-xs text-gray-400 shrink-0">{fmt(r.recordDate)}</span>
          </div>
        );
      })}
    </div>
  );
}

function MovementHistory({ farmId, animals, locations }: { farmId: string; animals: Animal[]; locations: LivestockLocation[] }) {
  const { data: movements = [], isLoading } = useQuery<MovementEvent[]>({
    queryKey: ["movements", farmId],
    queryFn: () => api.get(`/api/v1/farms/${farmId}/movements`).then(r => r.data),
    enabled: !!farmId,
  });
  const locName = (id: string | null) => id ? (locations.find(l => l.id === id)?.name ?? id.slice(0, 8)) : "?";
  if (isLoading) return <div className="animate-pulse h-16 rounded-lg bg-gray-100" />;
  if (movements.length === 0) return <p className="text-sm text-gray-400 text-center py-6">No movement records yet.</p>;
  return (
    <div className="divide-y divide-gray-100">
      {movements.map(m => {
        const animal = m.animalId ? animals.find(a => a.id === m.animalId) : null;
        return (
          <div key={m.id} className="flex items-center gap-4 py-3">
            <div className="flex-1 min-w-0 text-xs">
              {animal && <span className="font-mono text-gray-700 mr-2">{animal.tagNumber}</span>}
              <span className="text-gray-500">{locName(m.fromLocationId)}</span>
              <span className="mx-1 text-gray-400">→</span>
              <span className="text-gray-700 font-medium">{locName(m.toLocationId)}</span>
              {m.reason && <span className="ml-2 text-gray-400">· {m.reason}</span>}
            </div>
            <span className="text-xs text-gray-400 shrink-0">{fmt(m.moveDate)}</span>
          </div>
        );
      })}
    </div>
  );
}

function FeedHistory({ farmId, animals }: { farmId: string; animals: Animal[] }) {
  const { data: events = [], isLoading } = useQuery<LivestockFeedEvent[]>({
    queryKey: ["feed-events", farmId],
    queryFn: () => api.get(`/api/v1/farms/${farmId}/feed-events`).then(r => r.data),
    enabled: !!farmId,
  });
  if (isLoading) return <div className="animate-pulse h-16 rounded-lg bg-gray-100" />;
  if (events.length === 0) return <p className="text-sm text-gray-400 text-center py-6">No feed events yet.</p>;
  return (
    <div className="divide-y divide-gray-100">
      {events.map(e => {
        const animal = e.animalId ? animals.find(a => a.id === e.animalId) : null;
        return (
          <div key={e.id} className="flex items-center gap-4 py-3">
            <div className="flex-1 min-w-0 text-xs">
              <span className="font-medium text-gray-800">{e.feedName}</span>
              {animal && <span className="ml-2 font-mono text-gray-500">{animal.tagNumber}</span>}
              {e.notes && <span className="ml-2 text-gray-400 truncate">{e.notes}</span>}
            </div>
            <span className="text-xs text-gray-600 shrink-0">{e.quantityKg} kg</span>
            <span className="text-xs text-gray-400 shrink-0">{fmt(e.eventDate)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function LivestockEventsPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("health");
  const [viewMode, setViewMode] = useState<ViewMode>("record");
  const [selectedFarmId, setSelectedFarmId] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const { data: farms = [], isLoading: farmsLoading } = useQuery<Farm[]>({
    queryKey: ["farms"],
    queryFn: () => api.get("/api/v1/farms").then((r) => r.data),
  });

  const { data: speciesList = [] } = useQuery<Species[]>({
    queryKey: ["species"],
    queryFn: () => api.get("/api/v1/species").then((r) => r.data),
  });

  const activeFarmId = selectedFarmId || farms[0]?.id || "";

  const { data: groups = [], isLoading: groupsLoading } = useQuery<AnimalGroup[]>({
    queryKey: ["groups", activeFarmId],
    queryFn: () => api.get(`/api/v1/farms/${activeFarmId}/groups`).then((r) => r.data),
    enabled: !!activeFarmId,
  });
  const { data: animals = [], isLoading: animalsLoading } = useQuery<Animal[]>({
    queryKey: ["animals", activeFarmId],
    queryFn: () => api.get(`/api/v1/farms/${activeFarmId}/animals`).then((r) => r.data),
    enabled: !!activeFarmId,
  });
  const { data: locations = [], isLoading: locationsLoading } = useQuery<LivestockLocation[]>({
    queryKey: ["locations", activeFarmId],
    queryFn: () => api.get(`/api/v1/farms/${activeFarmId}/locations`).then((r) => r.data),
    enabled: !!activeFarmId,
  });

  const healthForm = useForm<HealthForm>({ resolver: zodResolver(healthSchema), defaultValues: { eventType: "Treatment" } });
  const weightForm = useForm<WeightForm>({ resolver: zodResolver(weightSchema) });
  const movementForm = useForm<MovementForm>({ resolver: zodResolver(movementSchema) });
  const feedForm = useForm<FeedForm>({ resolver: zodResolver(feedSchema) });

  const healthMut = useMutation({
    mutationFn: (data: HealthForm) => api.post(`/api/v1/farms/${activeFarmId}/health-events`, {
      speciesId: data.speciesId, eventDate: toIsoDate(data.eventDate), eventType: data.eventType,
      groupId: data.groupId || null, animalId: data.animalId || null,
      diagnosis: data.diagnosis || null, medication: data.medication || null, dose: data.dose || null,
      nextDueDate: data.nextDueDate ? toIsoDate(data.nextDueDate) : null, notes: data.notes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["health-events", activeFarmId] });
      setFeedback({ type: "success", message: "Health event recorded." });
      healthForm.reset({ eventType: "Treatment" });
    },
    onError: (err) => setFeedback({ type: "error", message: extractError(err) }),
  });

  const weightMut = useMutation({
    mutationFn: (data: WeightForm) => api.post(`/api/v1/farms/${activeFarmId}/weight-records`, {
      speciesId: data.speciesId, recordDate: toIsoDate(data.recordDate),
      weightKg: parseFloat(data.weightKg), sampledCount: parseInt(data.sampledCount, 10),
      groupId: data.groupId || null, animalId: data.animalId || null, notes: data.notes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weight-records", activeFarmId] });
      setFeedback({ type: "success", message: "Weight record submitted." });
      weightForm.reset();
    },
    onError: (err) => setFeedback({ type: "error", message: extractError(err) }),
  });

  const movementMut = useMutation({
    mutationFn: (data: MovementForm) => api.post(`/api/v1/farms/${activeFarmId}/movements`, {
      speciesId: data.speciesId, moveDate: toIsoDate(data.moveDate),
      groupId: data.groupId || null, animalId: data.animalId || null,
      fromLocationId: data.fromLocationId || null, toLocationId: data.toLocationId || null,
      reason: data.reason || null, notes: data.notes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["movements", activeFarmId] });
      setFeedback({ type: "success", message: "Movement recorded." });
      movementForm.reset();
    },
    onError: (err) => setFeedback({ type: "error", message: extractError(err) }),
  });

  const feedMut = useMutation({
    mutationFn: (data: FeedForm) => api.post(`/api/v1/farms/${activeFarmId}/feed-events`, {
      speciesId: data.speciesId, eventDate: toIsoDate(data.eventDate),
      feedName: data.feedName, quantityKg: parseFloat(data.quantityKg), cost: parseFloat(data.cost),
      groupId: data.groupId || null, animalId: data.animalId || null, notes: data.notes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed-events", activeFarmId] });
      setFeedback({ type: "success", message: "Feed event recorded." });
      feedForm.reset();
    },
    onError: (err) => setFeedback({ type: "error", message: extractError(err) }),
  });

  const tabBtn = (tab: Tab) =>
    `inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      activeTab === tab ? "bg-green-600 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
    }`;

  const modeBtn = (m: ViewMode) =>
    `px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
      viewMode === m ? "bg-gray-800 text-white" : "text-gray-500 hover:bg-gray-100"
    }`;

  function switchTab(tab: Tab) { setActiveTab(tab); setFeedback(null); }

  if (farmsLoading) return <div className="h-8 w-52 animate-pulse rounded bg-gray-200" />;
  if (farms.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-200">
        <p className="text-sm text-gray-500">Create at least one farm before recording livestock events.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Livestock Events</h1>
          <p className="mt-1 text-sm text-gray-500">Record and view health, weight, movement, and feed activity.</p>
        </div>
      </div>

      {/* Farm selector */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <label className={LABEL}>Farm Context</label>
        <select value={activeFarmId} onChange={(e) => setSelectedFarmId(e.target.value)} className={INPUT}>
          {farms.map((farm) => <option key={farm.id} value={farm.id}>{farm.name}</option>)}
        </select>
        <p className="mt-2 text-xs text-gray-500">
          Loaded: {groupsLoading ? "…" : groups.length} groups, {animalsLoading ? "…" : animals.length} animals,{" "}
          {locationsLoading ? "…" : locations.length} locations.
        </p>
      </div>

      {/* Main tab + mode selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={tabBtn("health")}   onClick={() => switchTab("health")}>
            <Activity className="h-4 w-4" /> Health
          </button>
          <button type="button" className={tabBtn("weight")}   onClick={() => switchTab("weight")}>
            <Scale className="h-4 w-4" /> Weight
          </button>
          <button type="button" className={tabBtn("movement")} onClick={() => switchTab("movement")}>
            <MoveRight className="h-4 w-4" /> Movement
          </button>
          <button type="button" className={tabBtn("feed")}     onClick={() => switchTab("feed")}>
            <Wheat className="h-4 w-4" /> Feed
          </button>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
          <button type="button" className={modeBtn("record")}  onClick={() => setViewMode("record")}>Record</button>
          <button type="button" className={modeBtn("history")} onClick={() => setViewMode("history")}>History</button>
        </div>
      </div>

      {/* Feedback */}
      {feedback && viewMode === "record" && (
        <div className={`rounded-xl px-4 py-3 text-sm ${feedback.type === "success" ? "bg-green-50 text-green-800 ring-1 ring-green-200" : "bg-red-50 text-red-800 ring-1 ring-red-200"}`}>
          {feedback.type === "success" && <CheckCircle2 className="mr-2 inline h-4 w-4" />}
          {feedback.message}
        </div>
      )}

      {/* ── HISTORY MODE ─────────────────────────────────────────────────────── */}
      {viewMode === "history" && (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          {activeTab === "health"   && <HealthHistory   farmId={activeFarmId} animals={animals} />}
          {activeTab === "weight"   && <WeightHistory   farmId={activeFarmId} animals={animals} />}
          {activeTab === "movement" && <MovementHistory farmId={activeFarmId} animals={animals} locations={locations} />}
          {activeTab === "feed"     && <FeedHistory     farmId={activeFarmId} animals={animals} />}
        </div>
      )}

      {/* ── RECORD FORMS ─────────────────────────────────────────────────────── */}
      {viewMode === "record" && activeTab === "health" && (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-5 text-base font-semibold text-gray-900">Record Health Event</h2>
          <form onSubmit={healthForm.handleSubmit((data) => healthMut.mutate(data))} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className={LABEL}>Species *</label>
                <select {...healthForm.register("speciesId")} className={INPUT}>
                  <option value="">Select species…</option>
                  {speciesList.map((sp) => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Event Date *</label>
                <input type="date" {...healthForm.register("eventDate")} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Event Type *</label>
                <select {...healthForm.register("eventType")} className={INPUT}>
                  {HEALTH_EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL}>Group</label>
                <select {...healthForm.register("groupId")} className={INPUT}>
                  <option value="">None</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.groupCode}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Animal</label>
                <select {...healthForm.register("animalId")} className={INPUT}>
                  <option value="">None</option>
                  {animals.map((a) => <option key={a.id} value={a.id}>{a.tagNumber}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div><label className={LABEL}>Diagnosis</label><input {...healthForm.register("diagnosis")} className={INPUT} /></div>
              <div><label className={LABEL}>Medication</label><input {...healthForm.register("medication")} className={INPUT} /></div>
              <div><label className={LABEL}>Dose</label><input {...healthForm.register("dose")} className={INPUT} /></div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><label className={LABEL}>Next Due Date</label><input type="date" {...healthForm.register("nextDueDate")} className={INPUT} /></div>
              <div><label className={LABEL}>Notes</label><input {...healthForm.register("notes")} className={INPUT} /></div>
            </div>
            <button type="submit" disabled={healthMut.isPending || !activeFarmId}
              className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {healthMut.isPending ? "Saving…" : "Save Health Event"}
            </button>
          </form>
        </div>
      )}

      {viewMode === "record" && activeTab === "weight" && (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-5 text-base font-semibold text-gray-900">Record Weight Sample</h2>
          <form onSubmit={weightForm.handleSubmit((data) => weightMut.mutate(data))} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div>
                <label className={LABEL}>Species *</label>
                <select {...weightForm.register("speciesId")} className={INPUT}>
                  <option value="">Select species…</option>
                  {speciesList.map((sp) => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
                </select>
              </div>
              <div><label className={LABEL}>Record Date *</label><input type="date" {...weightForm.register("recordDate")} className={INPUT} /></div>
              <div><label className={LABEL}>Weight (kg) *</label><input type="number" step="0.001" min={0.001} {...weightForm.register("weightKg")} className={INPUT} /></div>
              <div><label className={LABEL}>Sampled Count *</label><input type="number" min={1} {...weightForm.register("sampledCount")} className={INPUT} /></div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL}>Group</label>
                <select {...weightForm.register("groupId")} className={INPUT}>
                  <option value="">None</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.groupCode}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Animal</label>
                <select {...weightForm.register("animalId")} className={INPUT}>
                  <option value="">None</option>
                  {animals.map((a) => <option key={a.id} value={a.id}>{a.tagNumber}</option>)}
                </select>
              </div>
            </div>
            <div><label className={LABEL}>Notes</label><input {...weightForm.register("notes")} className={INPUT} /></div>
            <button type="submit" disabled={weightMut.isPending || !activeFarmId}
              className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {weightMut.isPending ? "Saving…" : "Save Weight Record"}
            </button>
          </form>
        </div>
      )}

      {viewMode === "record" && activeTab === "movement" && (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-5 text-base font-semibold text-gray-900">Record Movement</h2>
          <form onSubmit={movementForm.handleSubmit((data) => movementMut.mutate(data))} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className={LABEL}>Species *</label>
                <select {...movementForm.register("speciesId")} className={INPUT}>
                  <option value="">Select species…</option>
                  {speciesList.map((sp) => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
                </select>
              </div>
              <div><label className={LABEL}>Move Date *</label><input type="date" {...movementForm.register("moveDate")} className={INPUT} /></div>
              <div><label className={LABEL}>Reason</label><input {...movementForm.register("reason")} className={INPUT} /></div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL}>Group</label>
                <select {...movementForm.register("groupId")} className={INPUT}>
                  <option value="">None</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.groupCode}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Animal</label>
                <select {...movementForm.register("animalId")} className={INPUT}>
                  <option value="">None</option>
                  {animals.map((a) => <option key={a.id} value={a.id}>{a.tagNumber}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL}>From Location</label>
                <select {...movementForm.register("fromLocationId")} className={INPUT}>
                  <option value="">None</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>To Location</label>
                <select {...movementForm.register("toLocationId")} className={INPUT}>
                  <option value="">None</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            </div>
            <div><label className={LABEL}>Notes</label><input {...movementForm.register("notes")} className={INPUT} /></div>
            <button type="submit" disabled={movementMut.isPending || !activeFarmId}
              className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {movementMut.isPending ? "Saving…" : "Save Movement"}
            </button>
          </form>
        </div>
      )}

      {viewMode === "record" && activeTab === "feed" && (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-5 text-base font-semibold text-gray-900">Record Feed Event</h2>
          <form onSubmit={feedForm.handleSubmit((data) => feedMut.mutate(data))} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div>
                <label className={LABEL}>Species *</label>
                <select {...feedForm.register("speciesId")} className={INPUT}>
                  <option value="">Select species…</option>
                  {speciesList.map((sp) => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
                </select>
              </div>
              <div><label className={LABEL}>Event Date *</label><input type="date" {...feedForm.register("eventDate")} className={INPUT} /></div>
              <div><label className={LABEL}>Feed Name *</label><input {...feedForm.register("feedName")} className={INPUT} /></div>
              <div><label className={LABEL}>Quantity (kg) *</label><input type="number" step="0.001" min={0.001} {...feedForm.register("quantityKg")} className={INPUT} /></div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div><label className={LABEL}>Cost *</label><input type="number" step="0.01" min={0} {...feedForm.register("cost")} className={INPUT} /></div>
              <div>
                <label className={LABEL}>Group</label>
                <select {...feedForm.register("groupId")} className={INPUT}>
                  <option value="">None</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.groupCode}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Animal</label>
                <select {...feedForm.register("animalId")} className={INPUT}>
                  <option value="">None</option>
                  {animals.map((a) => <option key={a.id} value={a.id}>{a.tagNumber}</option>)}
                </select>
              </div>
            </div>
            <div><label className={LABEL}>Notes</label><input {...feedForm.register("notes")} className={INPUT} /></div>
            <button type="submit" disabled={feedMut.isPending || !activeFarmId}
              className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {feedMut.isPending ? "Saving…" : "Save Feed Event"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
