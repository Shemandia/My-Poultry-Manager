"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Activity, Scale, MoveRight, Wheat, CheckCircle2 } from "lucide-react";
import { api, extractError } from "@/lib/api";
import type { Animal, AnimalGroup, Farm, LivestockLocation, Species } from "@/types";

const INPUT =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100";
const LABEL = "block text-sm font-medium text-gray-700 mb-1";

const HEALTH_EVENT_TYPES = [
  "Vaccination",
  "Treatment",
  "Illness",
  "Checkup",
  "Deworming",
  "Other",
] as const;

type Tab = "health" | "weight" | "movement" | "feed";

const healthSchema = z.object({
  speciesId: z.string().uuid("Species is required"),
  eventDate: z.string().min(1, "Date is required"),
  eventType: z.enum(HEALTH_EVENT_TYPES),
  groupId: z.string().optional(),
  animalId: z.string().optional(),
  diagnosis: z.string().optional(),
  medication: z.string().optional(),
  dose: z.string().optional(),
  nextDueDate: z.string().optional(),
  notes: z.string().optional(),
});
type HealthForm = z.infer<typeof healthSchema>;

const weightSchema = z.object({
  speciesId: z.string().uuid("Species is required"),
  recordDate: z.string().min(1, "Date is required"),
  weightKg: z.string().min(1, "Weight is required"),
  sampledCount: z.string().min(1, "Sampled count is required"),
  groupId: z.string().optional(),
  animalId: z.string().optional(),
  notes: z.string().optional(),
});
type WeightForm = z.infer<typeof weightSchema>;

const movementSchema = z.object({
  speciesId: z.string().uuid("Species is required"),
  moveDate: z.string().min(1, "Date is required"),
  groupId: z.string().optional(),
  animalId: z.string().optional(),
  fromLocationId: z.string().optional(),
  toLocationId: z.string().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
});
type MovementForm = z.infer<typeof movementSchema>;

const feedSchema = z.object({
  speciesId: z.string().uuid("Species is required"),
  eventDate: z.string().min(1, "Date is required"),
  feedName: z.string().min(1, "Feed name is required"),
  quantityKg: z.string().min(1, "Quantity is required"),
  cost: z.string().min(1, "Cost is required"),
  groupId: z.string().optional(),
  animalId: z.string().optional(),
  notes: z.string().optional(),
});
type FeedForm = z.infer<typeof feedSchema>;

function toIsoDate(dateValue: string) {
  return new Date(`${dateValue}T00:00:00`).toISOString();
}

export default function LivestockEventsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("health");
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

  const healthForm = useForm<HealthForm>({
    resolver: zodResolver(healthSchema),
    defaultValues: {
      eventType: "Treatment",
    },
  });
  const weightForm = useForm<WeightForm>({
    resolver: zodResolver(weightSchema),
  });
  const movementForm = useForm<MovementForm>({
    resolver: zodResolver(movementSchema),
  });
  const feedForm = useForm<FeedForm>({
    resolver: zodResolver(feedSchema),
  });

  const healthMutation = useMutation({
    mutationFn: (data: HealthForm) =>
      api.post(`/api/v1/farms/${activeFarmId}/health-events`, {
        speciesId: data.speciesId,
        eventDate: toIsoDate(data.eventDate),
        eventType: data.eventType,
        groupId: data.groupId || null,
        animalId: data.animalId || null,
        diagnosis: data.diagnosis || null,
        medication: data.medication || null,
        dose: data.dose || null,
        nextDueDate: data.nextDueDate ? toIsoDate(data.nextDueDate) : null,
        notes: data.notes || null,
      }),
    onSuccess: () => {
      setFeedback({ type: "success", message: "Health event recorded." });
      healthForm.reset({ eventType: "Treatment" });
    },
    onError: (err) => setFeedback({ type: "error", message: extractError(err) }),
  });

  const weightMutation = useMutation({
    mutationFn: (data: WeightForm) =>
      api.post(`/api/v1/farms/${activeFarmId}/weight-records`, {
        speciesId: data.speciesId,
        recordDate: toIsoDate(data.recordDate),
        weightKg: parseFloat(data.weightKg),
        sampledCount: parseInt(data.sampledCount, 10),
        groupId: data.groupId || null,
        animalId: data.animalId || null,
        notes: data.notes || null,
      }),
    onSuccess: () => {
      setFeedback({ type: "success", message: "Weight record submitted." });
      weightForm.reset();
    },
    onError: (err) => setFeedback({ type: "error", message: extractError(err) }),
  });

  const movementMutation = useMutation({
    mutationFn: (data: MovementForm) =>
      api.post(`/api/v1/farms/${activeFarmId}/movements`, {
        speciesId: data.speciesId,
        moveDate: toIsoDate(data.moveDate),
        groupId: data.groupId || null,
        animalId: data.animalId || null,
        fromLocationId: data.fromLocationId || null,
        toLocationId: data.toLocationId || null,
        reason: data.reason || null,
        notes: data.notes || null,
      }),
    onSuccess: () => {
      setFeedback({ type: "success", message: "Movement recorded." });
      movementForm.reset();
    },
    onError: (err) => setFeedback({ type: "error", message: extractError(err) }),
  });

  const feedMutation = useMutation({
    mutationFn: (data: FeedForm) =>
      api.post(`/api/v1/farms/${activeFarmId}/feed-events`, {
        speciesId: data.speciesId,
        eventDate: toIsoDate(data.eventDate),
        feedName: data.feedName,
        quantityKg: parseFloat(data.quantityKg),
        cost: parseFloat(data.cost),
        groupId: data.groupId || null,
        animalId: data.animalId || null,
        notes: data.notes || null,
      }),
    onSuccess: () => {
      setFeedback({ type: "success", message: "Feed event recorded." });
      feedForm.reset();
    },
    onError: (err) => setFeedback({ type: "error", message: extractError(err) }),
  });

  const tabButtonClass = (tab: Tab) =>
    `inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      activeTab === tab
        ? "bg-green-600 text-white"
        : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
    }`;

  if (farmsLoading) {
    return <div className="h-8 w-52 animate-pulse rounded bg-gray-200" />;
  }

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
          <p className="mt-1 text-sm text-gray-500">
            Record health, weight, movement, and feed activity for livestock operations.
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <label className={LABEL}>Farm Context</label>
        <select
          value={activeFarmId}
          onChange={(e) => setSelectedFarmId(e.target.value)}
          className={INPUT}
        >
          {farms.map((farm) => (
              <option key={farm.id} value={farm.id}>
                {farm.name}
              </option>
            ))}
        </select>
        <p className="mt-2 text-xs text-gray-500">
          Loaded: {groupsLoading ? "…" : groups.length} groups, {animalsLoading ? "…" : animals.length} animals,{" "}
          {locationsLoading ? "…" : locations.length} locations.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={tabButtonClass("health")} onClick={() => { setActiveTab("health"); setFeedback(null); }}>
          <Activity className="h-4 w-4" /> Health Event
        </button>
        <button type="button" className={tabButtonClass("weight")} onClick={() => { setActiveTab("weight"); setFeedback(null); }}>
          <Scale className="h-4 w-4" /> Weight Record
        </button>
        <button type="button" className={tabButtonClass("movement")} onClick={() => { setActiveTab("movement"); setFeedback(null); }}>
          <MoveRight className="h-4 w-4" /> Movement
        </button>
        <button type="button" className={tabButtonClass("feed")} onClick={() => { setActiveTab("feed"); setFeedback(null); }}>
          <Wheat className="h-4 w-4" /> Feed Event
        </button>
      </div>

      {feedback && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            feedback.type === "success"
              ? "bg-green-50 text-green-800 ring-1 ring-green-200"
              : "bg-red-50 text-red-800 ring-1 ring-red-200"
          }`}
        >
          {feedback.type === "success" && <CheckCircle2 className="mr-2 inline h-4 w-4" />}
          {feedback.message}
        </div>
      )}

      {activeTab === "health" && (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-5 text-base font-semibold text-gray-900">Record Health Event</h2>
          <form
            onSubmit={healthForm.handleSubmit((data) => healthMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className={LABEL}>Species *</label>
                <select {...healthForm.register("speciesId")} className={INPUT}>
                  <option value="">Select species…</option>
                  {speciesList.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL}>Event Date *</label>
                <input type="date" {...healthForm.register("eventDate")} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Event Type *</label>
                <select {...healthForm.register("eventType")} className={INPUT}>
                  {HEALTH_EVENT_TYPES.map((eventType) => (
                    <option key={eventType} value={eventType}>
                      {eventType}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL}>Group</label>
                <select {...healthForm.register("groupId")} className={INPUT}>
                  <option value="">None</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.groupCode}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL}>Animal</label>
                <select {...healthForm.register("animalId")} className={INPUT}>
                  <option value="">None</option>
                  {animals.map((animal) => (
                    <option key={animal.id} value={animal.id}>
                      {animal.tagNumber}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className={LABEL}>Diagnosis</label>
                <input {...healthForm.register("diagnosis")} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Medication</label>
                <input {...healthForm.register("medication")} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Dose</label>
                <input {...healthForm.register("dose")} className={INPUT} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL}>Next Due Date</label>
                <input type="date" {...healthForm.register("nextDueDate")} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Notes</label>
                <input {...healthForm.register("notes")} className={INPUT} />
              </div>
            </div>

            <button
              type="submit"
              disabled={healthMutation.isPending || !activeFarmId}
              className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {healthMutation.isPending ? "Saving…" : "Save Health Event"}
            </button>
          </form>
        </div>
      )}

      {activeTab === "weight" && (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-5 text-base font-semibold text-gray-900">Record Weight Sample</h2>
          <form
            onSubmit={weightForm.handleSubmit((data) => weightMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div>
                <label className={LABEL}>Species *</label>
                <select {...weightForm.register("speciesId")} className={INPUT}>
                  <option value="">Select species…</option>
                  {speciesList.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL}>Record Date *</label>
                <input type="date" {...weightForm.register("recordDate")} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Weight (kg) *</label>
                <input type="number" step="0.001" min={0.001} {...weightForm.register("weightKg")} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Sampled Count *</label>
                <input type="number" min={1} {...weightForm.register("sampledCount")} className={INPUT} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL}>Group</label>
                <select {...weightForm.register("groupId")} className={INPUT}>
                  <option value="">None</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.groupCode}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL}>Animal</label>
                <select {...weightForm.register("animalId")} className={INPUT}>
                  <option value="">None</option>
                  {animals.map((animal) => (
                    <option key={animal.id} value={animal.id}>
                      {animal.tagNumber}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={LABEL}>Notes</label>
              <input {...weightForm.register("notes")} className={INPUT} />
            </div>

            <button
              type="submit"
              disabled={weightMutation.isPending || !activeFarmId}
              className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {weightMutation.isPending ? "Saving…" : "Save Weight Record"}
            </button>
          </form>
        </div>
      )}

      {activeTab === "movement" && (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-5 text-base font-semibold text-gray-900">Record Movement</h2>
          <form
            onSubmit={movementForm.handleSubmit((data) => movementMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className={LABEL}>Species *</label>
                <select {...movementForm.register("speciesId")} className={INPUT}>
                  <option value="">Select species…</option>
                  {speciesList.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL}>Move Date *</label>
                <input type="date" {...movementForm.register("moveDate")} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Reason</label>
                <input {...movementForm.register("reason")} className={INPUT} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL}>Group</label>
                <select {...movementForm.register("groupId")} className={INPUT}>
                  <option value="">None</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.groupCode}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL}>Animal</label>
                <select {...movementForm.register("animalId")} className={INPUT}>
                  <option value="">None</option>
                  {animals.map((animal) => (
                    <option key={animal.id} value={animal.id}>
                      {animal.tagNumber}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL}>From Location</label>
                <select {...movementForm.register("fromLocationId")} className={INPUT}>
                  <option value="">None</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL}>To Location</label>
                <select {...movementForm.register("toLocationId")} className={INPUT}>
                  <option value="">None</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={LABEL}>Notes</label>
              <input {...movementForm.register("notes")} className={INPUT} />
            </div>

            <button
              type="submit"
              disabled={movementMutation.isPending || !activeFarmId}
              className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {movementMutation.isPending ? "Saving…" : "Save Movement"}
            </button>
          </form>
        </div>
      )}

      {activeTab === "feed" && (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-5 text-base font-semibold text-gray-900">Record Feed Event</h2>
          <form
            onSubmit={feedForm.handleSubmit((data) => feedMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div>
                <label className={LABEL}>Species *</label>
                <select {...feedForm.register("speciesId")} className={INPUT}>
                  <option value="">Select species…</option>
                  {speciesList.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL}>Event Date *</label>
                <input type="date" {...feedForm.register("eventDate")} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Feed Name *</label>
                <input {...feedForm.register("feedName")} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Quantity (kg) *</label>
                <input type="number" step="0.001" min={0.001} {...feedForm.register("quantityKg")} className={INPUT} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className={LABEL}>Cost *</label>
                <input type="number" step="0.01" min={0} {...feedForm.register("cost")} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Group</label>
                <select {...feedForm.register("groupId")} className={INPUT}>
                  <option value="">None</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.groupCode}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL}>Animal</label>
                <select {...feedForm.register("animalId")} className={INPUT}>
                  <option value="">None</option>
                  {animals.map((animal) => (
                    <option key={animal.id} value={animal.id}>
                      {animal.tagNumber}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={LABEL}>Notes</label>
              <input {...feedForm.register("notes")} className={INPUT} />
            </div>

            <button
              type="submit"
              disabled={feedMutation.isPending || !activeFarmId}
              className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {feedMutation.isPending ? "Saving…" : "Save Feed Event"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
