"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { ArrowLeft, Plus, CheckCircle2, Clock, Scale, ShoppingBag, Download, FileText, Pencil, Trash2 } from "lucide-react";
import { api, extractError } from "@/lib/api";
import { downloadFile } from "@/lib/download";
import { formatNumber, formatDate, formatKg } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import type { Flock, DailyRecord, FlockPerformance, HealthLog, VaccinationSchedule, WeightSample, HarvestRecord } from "@/types";

// ── Schemas ───────────────────────────────────────────────────────────────────

const recordSchema = z.object({
  recordDate: z.string().min(1, "Date is required"),
  eggsTotal: z.number().int().min(0),
  eggsBroken: z.number().int().min(0),
  eggsSold: z.number().int().min(0),
  mortality: z.number().int().min(0),
  feedConsumedKg: z.number().min(0),
});
type RecordForm = z.infer<typeof recordSchema>;

const healthSchema = z.object({
  logDate: z.string().min(1, "Date is required"),
  symptoms: z.string().optional(),
  diagnosis: z.string().optional(),
  treatment: z.string().optional(),
  medication: z.string().optional(),
  dosageMl: z.string().optional(),
  vetName: z.string().optional(),
  followUpDate: z.string().optional(),
  notes: z.string().optional(),
});
type HealthForm = z.infer<typeof healthSchema>;

const vaccineSchema = z.object({
  vaccineName: z.string().min(1, "Vaccine name is required"),
  scheduledDate: z.string().min(1, "Scheduled date is required"),
  notes: z.string().optional(),
});
type VaccineForm = z.infer<typeof vaccineSchema>;

const weightSchema = z.object({
  sampleDate: z.string().min(1, "Date is required"),
  sampleSize: z.string().min(1, "Sample size is required"),
  avgWeightKg: z.string().min(1, "Avg weight is required"),
  targetWeightKg: z.string().optional(),
  notes: z.string().optional(),
});
type WeightForm = z.infer<typeof weightSchema>;

const harvestSchema = z.object({
  harvestDate: z.string().min(1, "Date is required"),
  birdsHarvested: z.string().min(1, "Birds harvested is required"),
  avgWeightKg: z.string().optional(),
  totalWeightKg: z.string().optional(),
  buyerName: z.string().optional(),
  pricePerKg: z.string().optional(),
  notes: z.string().optional(),
});
type HarvestForm = z.infer<typeof harvestSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function DeleteConfirm({ open, onClose, label, onConfirm, isPending }: {
  open: boolean; onClose: () => void; label: string; onConfirm: () => void; isPending: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Confirm Delete">
      <p className="text-sm text-gray-600 mb-6">Are you sure you want to delete this {label}? This cannot be undone.</p>
      <div className="flex gap-3">
        <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
        <button type="button" onClick={onConfirm} disabled={isPending} className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
          {isPending ? "Deleting…" : "Delete"}
        </button>
      </div>
    </Modal>
  );
}

const INPUT = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100";
const LABEL = "block text-sm font-medium text-gray-700 mb-1";

// ── Tabs ──────────────────────────────────────────────────────────────────────

type Tab = "records" | "health" | "vaccinations" | "weight" | "harvest";

export default function FlockDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const canWriteHealth = ["owner", "farm_manager", "supervisor", "vet"].includes(currentUser?.role ?? "");
  const canManageVaccines = ["owner", "farm_manager", "vet"].includes(currentUser?.role ?? "");
  const canManageWeight = ["owner", "farm_manager", "supervisor"].includes(currentUser?.role ?? "");
  const canManageHarvest = ["owner", "farm_manager"].includes(currentUser?.role ?? "");

  const [tab, setTab] = useState<Tab>("records");
  const [downloading, setDownloading] = useState<string | null>(null);

  // Add/show state
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [showAddHealth, setShowAddHealth] = useState(false);
  const [showAddVaccine, setShowAddVaccine] = useState(false);
  const [showAddWeight, setShowAddWeight] = useState(false);
  const [showAddHarvest, setShowAddHarvest] = useState(false);

  // Edit state
  const [editRecord, setEditRecord] = useState<DailyRecord | null>(null);
  const [editHealth, setEditHealth] = useState<HealthLog | null>(null);
  const [editVaccine, setEditVaccine] = useState<VaccinationSchedule | null>(null);
  const [editWeight, setEditWeight] = useState<WeightSample | null>(null);
  const [editHarvest, setEditHarvest] = useState<HarvestRecord | null>(null);

  // Delete state
  const [deleteRecord, setDeleteRecord] = useState<DailyRecord | null>(null);
  const [deleteHealth, setDeleteHealth] = useState<HealthLog | null>(null);
  const [deleteVaccine, setDeleteVaccine] = useState<VaccinationSchedule | null>(null);
  const [deleteWeight, setDeleteWeight] = useState<WeightSample | null>(null);
  const [deleteHarvest, setDeleteHarvest] = useState<HarvestRecord | null>(null);

  // Error state
  const [recordError, setRecordError] = useState("");
  const [healthError, setHealthError] = useState("");
  const [vaccineError, setVaccineError] = useState("");
  const [weightError, setWeightError] = useState("");
  const [harvestError, setHarvestError] = useState("");

  const handleExport = async (path: string, filename: string, key: string) => {
    setDownloading(key);
    try { await downloadFile(path, filename); } catch { /* ignore */ } finally { setDownloading(null); }
  };

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: flock, isLoading: flockLoading } = useQuery<Flock>({
    queryKey: ["flocks", id],
    queryFn: () => api.get(`/api/v1/flocks/${id}`).then((r) => r.data),
  });

  const { data: records = [], isLoading: recordsLoading } = useQuery<DailyRecord[]>({
    queryKey: ["records", id],
    queryFn: () => api.get(`/api/v1/flocks/${id}/daily-records`).then((r) => r.data),
  });

  const { data: performance } = useQuery<FlockPerformance>({
    queryKey: ["performance", id],
    queryFn: () => api.get(`/api/v1/reports/flocks/${id}/performance`).then((r) => r.data),
    enabled: !!flock,
  });

  const { data: healthLogs = [], isLoading: healthLoading } = useQuery<HealthLog[]>({
    queryKey: ["health", id],
    queryFn: () => api.get(`/api/v1/flocks/${id}/health-logs`).then((r) => r.data),
    enabled: tab === "health",
  });

  const { data: vaccinations = [], isLoading: vaccinesLoading } = useQuery<VaccinationSchedule[]>({
    queryKey: ["vaccinations", id],
    queryFn: () => api.get(`/api/v1/flocks/${id}/vaccinations`).then((r) => r.data),
    enabled: tab === "vaccinations",
  });

  const { data: weightSamples = [], isLoading: weightLoading } = useQuery<WeightSample[]>({
    queryKey: ["weight", id],
    queryFn: () => api.get(`/api/v1/flocks/${id}/weight-samples`).then((r) => r.data),
    enabled: tab === "weight",
  });

  const { data: harvestRecords = [], isLoading: harvestLoading } = useQuery<HarvestRecord[]>({
    queryKey: ["harvest", id],
    queryFn: () => api.get(`/api/v1/flocks/${id}/harvest-records`).then((r) => r.data),
    enabled: tab === "harvest",
  });

  // ── Forms ────────────────────────────────────────────────────────────────

  const recordForm = useForm<RecordForm>({ resolver: zodResolver(recordSchema) });
  const recordEditForm = useForm<RecordForm>({ resolver: zodResolver(recordSchema) });
  const healthForm = useForm<HealthForm>({ resolver: zodResolver(healthSchema) });
  const healthEditForm = useForm<HealthForm>({ resolver: zodResolver(healthSchema) });
  const vaccineForm = useForm<VaccineForm>({ resolver: zodResolver(vaccineSchema) });
  const vaccineEditForm = useForm<VaccineForm>({ resolver: zodResolver(vaccineSchema) });
  const weightForm = useForm<WeightForm>({ resolver: zodResolver(weightSchema) });
  const weightEditForm = useForm<WeightForm>({ resolver: zodResolver(weightSchema) });
  const harvestForm = useForm<HarvestForm>({ resolver: zodResolver(harvestSchema) });
  const harvestEditForm = useForm<HarvestForm>({ resolver: zodResolver(harvestSchema) });

  // ── Mutations ────────────────────────────────────────────────────────────

  const addRecordMutation = useMutation({
    mutationFn: (data: RecordForm) => api.post(`/api/v1/flocks/${id}/daily-records`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["records", id] });
      qc.invalidateQueries({ queryKey: ["performance", id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      recordForm.reset(); setShowAddRecord(false); setRecordError("");
    },
    onError: (err) => setRecordError(extractError(err)),
  });

  const updateRecordMutation = useMutation({
    mutationFn: (data: RecordForm) => api.put(`/api/v1/daily-records/${editRecord!.id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["records", id] });
      qc.invalidateQueries({ queryKey: ["performance", id] });
      setEditRecord(null); setRecordError("");
    },
    onError: (err) => setRecordError(extractError(err)),
  });

  const deleteRecordMutation = useMutation({
    mutationFn: (rid: string) => api.delete(`/api/v1/daily-records/${rid}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["records", id] });
      qc.invalidateQueries({ queryKey: ["performance", id] });
      setDeleteRecord(null);
    },
  });

  const addHealthMutation = useMutation({
    mutationFn: (data: HealthForm) =>
      api.post(`/api/v1/flocks/${id}/health-logs`, {
        logDate: data.logDate, symptoms: data.symptoms || null, diagnosis: data.diagnosis || null,
        treatment: data.treatment || null, medication: data.medication || null,
        dosageMl: data.dosageMl ? parseFloat(data.dosageMl) : null,
        vetName: data.vetName || null, followUpDate: data.followUpDate || null, notes: data.notes || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["health", id] });
      healthForm.reset(); setShowAddHealth(false); setHealthError("");
    },
    onError: (err) => setHealthError(extractError(err)),
  });

  const updateHealthMutation = useMutation({
    mutationFn: (data: HealthForm) =>
      api.put(`/api/v1/health-logs/${editHealth!.id}`, {
        logDate: data.logDate, symptoms: data.symptoms || null, diagnosis: data.diagnosis || null,
        treatment: data.treatment || null, medication: data.medication || null,
        dosageMl: data.dosageMl ? parseFloat(data.dosageMl) : null,
        vetName: data.vetName || null, followUpDate: data.followUpDate || null, notes: data.notes || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["health", id] });
      setEditHealth(null); setHealthError("");
    },
    onError: (err) => setHealthError(extractError(err)),
  });

  const deleteHealthMutation = useMutation({
    mutationFn: (hid: string) => api.delete(`/api/v1/health-logs/${hid}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["health", id] }); setDeleteHealth(null); },
  });

  const addVaccineMutation = useMutation({
    mutationFn: (data: VaccineForm) =>
      api.post(`/api/v1/flocks/${id}/vaccinations`, {
        vaccineName: data.vaccineName, scheduledDate: data.scheduledDate, notes: data.notes || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vaccinations", id] });
      vaccineForm.reset(); setShowAddVaccine(false); setVaccineError("");
    },
    onError: (err) => setVaccineError(extractError(err)),
  });

  const updateVaccineMutation = useMutation({
    mutationFn: (data: VaccineForm) =>
      api.put(`/api/v1/vaccinations/${editVaccine!.id}`, {
        vaccineName: data.vaccineName, scheduledDate: data.scheduledDate, notes: data.notes || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vaccinations", id] });
      setEditVaccine(null); setVaccineError("");
    },
    onError: (err) => setVaccineError(extractError(err)),
  });

  const deleteVaccineMutation = useMutation({
    mutationFn: (vid: string) => api.delete(`/api/v1/vaccinations/${vid}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vaccinations", id] }); setDeleteVaccine(null); },
  });

  const markGivenMutation = useMutation({
    mutationFn: (vaccId: string) => api.patch(`/api/v1/vaccinations/${vaccId}/mark-given`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vaccinations", id] }),
  });

  const addWeightMutation = useMutation({
    mutationFn: (data: WeightForm) =>
      api.post(`/api/v1/flocks/${id}/weight-samples`, {
        sampleDate: data.sampleDate, sampleSize: parseInt(data.sampleSize),
        avgWeightKg: parseFloat(data.avgWeightKg),
        targetWeightKg: data.targetWeightKg ? parseFloat(data.targetWeightKg) : null,
        notes: data.notes || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weight", id] });
      weightForm.reset(); setShowAddWeight(false); setWeightError("");
    },
    onError: (err) => setWeightError(extractError(err)),
  });

  const updateWeightMutation = useMutation({
    mutationFn: (data: WeightForm) =>
      api.put(`/api/v1/weight-samples/${editWeight!.id}`, {
        sampleDate: data.sampleDate, sampleSize: parseInt(data.sampleSize),
        avgWeightKg: parseFloat(data.avgWeightKg),
        targetWeightKg: data.targetWeightKg ? parseFloat(data.targetWeightKg) : null,
        notes: data.notes || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weight", id] });
      setEditWeight(null); setWeightError("");
    },
    onError: (err) => setWeightError(extractError(err)),
  });

  const deleteWeightMutation = useMutation({
    mutationFn: (wid: string) => api.delete(`/api/v1/weight-samples/${wid}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["weight", id] }); setDeleteWeight(null); },
  });

  const addHarvestMutation = useMutation({
    mutationFn: (data: HarvestForm) =>
      api.post(`/api/v1/flocks/${id}/harvest-records`, {
        harvestDate: data.harvestDate, birdsHarvested: parseInt(data.birdsHarvested),
        avgWeightKg: data.avgWeightKg ? parseFloat(data.avgWeightKg) : null,
        totalWeightKg: data.totalWeightKg ? parseFloat(data.totalWeightKg) : null,
        buyerName: data.buyerName || null,
        pricePerKg: data.pricePerKg ? parseFloat(data.pricePerKg) : null,
        notes: data.notes || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["harvest", id] });
      harvestForm.reset(); setShowAddHarvest(false); setHarvestError("");
    },
    onError: (err) => setHarvestError(extractError(err)),
  });

  const updateHarvestMutation = useMutation({
    mutationFn: (data: HarvestForm) =>
      api.put(`/api/v1/harvest-records/${editHarvest!.id}`, {
        harvestDate: data.harvestDate, birdsHarvested: parseInt(data.birdsHarvested),
        avgWeightKg: data.avgWeightKg ? parseFloat(data.avgWeightKg) : null,
        totalWeightKg: data.totalWeightKg ? parseFloat(data.totalWeightKg) : null,
        buyerName: data.buyerName || null,
        pricePerKg: data.pricePerKg ? parseFloat(data.pricePerKg) : null,
        notes: data.notes || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["harvest", id] });
      setEditHarvest(null); setHarvestError("");
    },
    onError: (err) => setHarvestError(extractError(err)),
  });

  const deleteHarvestMutation = useMutation({
    mutationFn: (hid: string) => api.delete(`/api/v1/harvest-records/${hid}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["harvest", id] }); setDeleteHarvest(null); },
  });

  // ── Open-edit helpers ────────────────────────────────────────────────────

  function openEditRecord(r: DailyRecord) {
    recordEditForm.reset({
      recordDate: r.recordDate.slice(0, 10),
      eggsTotal: r.eggsTotal, eggsBroken: r.eggsBroken, eggsSold: r.eggsSold,
      mortality: r.mortality, feedConsumedKg: r.feedConsumedKg,
    });
    setRecordError(""); setEditRecord(r);
  }

  function openEditHealth(log: HealthLog) {
    healthEditForm.reset({
      logDate: log.logDate.slice(0, 10),
      symptoms: log.symptoms ?? "", diagnosis: log.diagnosis ?? "",
      treatment: log.treatment ?? "", medication: log.medication ?? "",
      dosageMl: log.dosageMl != null ? String(log.dosageMl) : "",
      vetName: log.vetName ?? "",
      followUpDate: log.followUpDate ? log.followUpDate.slice(0, 10) : "",
      notes: log.notes ?? "",
    });
    setHealthError(""); setEditHealth(log);
  }

  function openEditVaccine(v: VaccinationSchedule) {
    vaccineEditForm.reset({
      vaccineName: v.vaccineName,
      scheduledDate: v.scheduledDate.slice(0, 10),
      notes: v.notes ?? "",
    });
    setVaccineError(""); setEditVaccine(v);
  }

  function openEditWeight(w: WeightSample) {
    weightEditForm.reset({
      sampleDate: w.sampleDate.slice(0, 10),
      sampleSize: String(w.sampleSize),
      avgWeightKg: String(w.avgWeightKg),
      targetWeightKg: w.targetWeightKg != null ? String(w.targetWeightKg) : "",
      notes: w.notes ?? "",
    });
    setWeightError(""); setEditWeight(w);
  }

  function openEditHarvest(h: HarvestRecord) {
    harvestEditForm.reset({
      harvestDate: h.harvestDate.slice(0, 10),
      birdsHarvested: String(h.birdsHarvested),
      avgWeightKg: h.avgWeightKg != null ? String(h.avgWeightKg) : "",
      totalWeightKg: h.totalWeightKg != null ? String(h.totalWeightKg) : "",
      buyerName: h.buyerName ?? "",
      pricePerKg: h.pricePerKg != null ? String(h.pricePerKg) : "",
      notes: h.notes ?? "",
    });
    setHarvestError(""); setEditHarvest(h);
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (flockLoading) return <div className="animate-pulse h-8 w-48 rounded bg-gray-200" />;
  if (!flock) return <p className="text-sm text-gray-500">Flock not found.</p>;

  const summary = performance?.summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/flocks" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Flocks
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{flock.batchCode}</h1>
            <p className="text-sm text-gray-500 mt-1 capitalize">
              {flock.birdType} · {flock.breed} · {formatNumber(flock.initialCount)} birds arrived {formatDate(flock.arrivalDate)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleExport(`/api/v1/export/flocks/${id}/performance.pdf`, `flock-${flock.batchCode}-performance.pdf`, "pdf")}
              disabled={downloading !== null}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <FileText className="h-3.5 w-3.5" />
              {downloading === "pdf" ? "Exporting…" : "Export PDF"}
            </button>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${flock.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
              {flock.status}
            </span>
          </div>
        </div>
      </div>

      {/* Performance summary */}
      {summary && (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="text-base font-semibold text-gray-900 mb-4">All-time Performance</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["Total Eggs", formatNumber(summary.totalEggs)],
              ["Net Eggs", formatNumber(summary.netEggs)],
              ["Total Mortality", formatNumber(summary.totalMortality)],
              ["Feed Consumed", formatKg(summary.totalFeedConsumedKg)],
              ...(flock.birdType === "layer" && summary.layingRatePercent != null
                ? [["Laying Rate", `${summary.layingRatePercent}%`]]
                : []),
              ["Days Recorded", String(summary.daysRecorded)],
            ].map(([label, val]) => (
              <div key={label} className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className="text-xl font-bold text-gray-900">{val}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div>
        <div className="flex gap-1 border-b border-gray-200 mb-4">
          {(["records", "health", "vaccinations", "weight", "harvest"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                tab === t
                  ? "border-green-600 text-green-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "records" ? "Daily Records"
                : t === "health" ? "Health Logs"
                : t === "vaccinations" ? "Vaccinations"
                : t === "weight" ? "Weight"
                : "Harvest"}
            </button>
          ))}
        </div>

        {/* ── Daily Records tab ──────────────────────────────────────────── */}
        {tab === "records" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-900">Daily Records ({records.length})</h2>
              <div className="flex items-center gap-2">
                {records.length > 0 && (
                  <button type="button"
                    onClick={() => handleExport(`/api/v1/export/flocks/${id}/daily-records.csv`, `flock-${flock.batchCode}-daily-records.csv`, "records-csv")}
                    disabled={downloading !== null}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                    <Download className="h-3.5 w-3.5" /> CSV
                  </button>
                )}
                <button type="button" onClick={() => setShowAddRecord(true)}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors">
                  <Plus className="h-3.5 w-3.5" /> Add Record
                </button>
              </div>
            </div>
            {recordsLoading ? (
              <div className="animate-pulse h-32 rounded-2xl bg-gray-200" />
            ) : records.length === 0 ? (
              <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-200">
                <p className="text-sm text-gray-400">No daily records yet.</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-left">
                      <th className="px-5 py-3 font-medium text-gray-500">Date</th>
                      <th className="px-5 py-3 font-medium text-gray-500 text-right">Eggs</th>
                      <th className="px-5 py-3 font-medium text-gray-500 text-right">Broken</th>
                      <th className="px-5 py-3 font-medium text-gray-500 text-right">Sold</th>
                      <th className="px-5 py-3 font-medium text-gray-500 text-right">Mortality</th>
                      <th className="px-5 py-3 font-medium text-gray-500 text-right">Feed (kg)</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[...records].sort((a, b) => b.recordDate.localeCompare(a.recordDate)).map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50 group">
                        <td className="px-5 py-3 text-gray-700">{formatDate(r.recordDate)}</td>
                        <td className="px-5 py-3 text-right font-medium text-gray-900">{formatNumber(r.eggsTotal)}</td>
                        <td className="px-5 py-3 text-right text-gray-500">{formatNumber(r.eggsBroken)}</td>
                        <td className="px-5 py-3 text-right text-gray-500">{formatNumber(r.eggsSold)}</td>
                        <td className="px-5 py-3 text-right text-red-600">{r.mortality > 0 ? formatNumber(r.mortality) : "—"}</td>
                        <td className="px-5 py-3 text-right text-gray-500">{r.feedConsumedKg}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button type="button" onClick={() => openEditRecord(r)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><Pencil className="h-3.5 w-3.5" /></button>
                            <button type="button" onClick={() => setDeleteRecord(r)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Health Logs tab ────────────────────────────────────────────── */}
        {tab === "health" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-900">Health Logs ({healthLogs.length})</h2>
              {canWriteHealth && (
                <button type="button" onClick={() => setShowAddHealth(true)}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors">
                  <Plus className="h-3.5 w-3.5" /> Add Log
                </button>
              )}
            </div>
            {healthLoading ? (
              <div className="animate-pulse h-32 rounded-2xl bg-gray-200" />
            ) : healthLogs.length === 0 ? (
              <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-200">
                <p className="text-sm text-gray-400">No health logs yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {healthLogs.map((log) => (
                  <div key={log.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
                    <div className="flex items-start justify-between mb-3">
                      <p className="font-semibold text-gray-900">{formatDate(log.logDate)}</p>
                      <div className="flex items-center gap-2">
                        {log.followUpDate && (
                          <span className="text-xs text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
                            Follow-up {formatDate(log.followUpDate)}
                          </span>
                        )}
                        {canWriteHealth && (
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => openEditHealth(log)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><Pencil className="h-3.5 w-3.5" /></button>
                            <button type="button" onClick={() => setDeleteHealth(log)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        )}
                      </div>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      {log.symptoms && <><dt className="text-gray-500">Symptoms</dt><dd className="text-gray-900">{log.symptoms}</dd></>}
                      {log.diagnosis && <><dt className="text-gray-500">Diagnosis</dt><dd className="text-gray-900">{log.diagnosis}</dd></>}
                      {log.treatment && <><dt className="text-gray-500">Treatment</dt><dd className="text-gray-900">{log.treatment}</dd></>}
                      {log.medication && <><dt className="text-gray-500">Medication</dt><dd className="text-gray-900">{log.medication}{log.dosageMl != null ? ` — ${log.dosageMl} ml` : ""}</dd></>}
                      {log.vetName && <><dt className="text-gray-500">Vet</dt><dd className="text-gray-900">{log.vetName}</dd></>}
                      {log.notes && <><dt className="text-gray-500 col-span-2">Notes</dt><dd className="text-gray-900 col-span-2">{log.notes}</dd></>}
                    </dl>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Vaccinations tab ───────────────────────────────────────────── */}
        {tab === "vaccinations" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-900">Vaccination Schedule ({vaccinations.length})</h2>
              {canManageVaccines && (
                <button type="button" onClick={() => setShowAddVaccine(true)}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors">
                  <Plus className="h-3.5 w-3.5" /> Schedule
                </button>
              )}
            </div>
            {vaccinesLoading ? (
              <div className="animate-pulse h-32 rounded-2xl bg-gray-200" />
            ) : vaccinations.length === 0 ? (
              <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-200">
                <p className="text-sm text-gray-400">No vaccinations scheduled.</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-left">
                      <th className="px-5 py-3 font-medium text-gray-500">Vaccine</th>
                      <th className="px-5 py-3 font-medium text-gray-500">Scheduled</th>
                      <th className="px-5 py-3 font-medium text-gray-500">Status</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {vaccinations.map((v) => (
                      <tr key={v.id} className="hover:bg-gray-50 group">
                        <td className="px-5 py-3 font-medium text-gray-900">{v.vaccineName}</td>
                        <td className="px-5 py-3 text-gray-600">{formatDate(v.scheduledDate)}</td>
                        <td className="px-5 py-3">
                          {v.givenDate ? (
                            <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Given {formatDate(v.givenDate)}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
                              <Clock className="h-3.5 w-3.5" /> Pending
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {canWriteHealth && !v.givenDate && (
                              <button type="button" onClick={() => markGivenMutation.mutate(v.id)}
                                className="text-xs font-medium text-green-600 hover:text-green-800">
                                Mark given
                              </button>
                            )}
                            {canManageVaccines && (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button type="button" onClick={() => openEditVaccine(v)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><Pencil className="h-3.5 w-3.5" /></button>
                                <button type="button" onClick={() => setDeleteVaccine(v)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Weight Samples tab ─────────────────────────────────────────── */}
        {tab === "weight" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-900">Weight Samples ({weightSamples.length})</h2>
              <div className="flex items-center gap-2">
                {weightSamples.length > 0 && (
                  <button type="button"
                    onClick={() => handleExport(`/api/v1/export/flocks/${id}/weight-samples.csv`, `flock-${flock.batchCode}-weight-samples.csv`, "weight-csv")}
                    disabled={downloading !== null}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                    <Download className="h-3.5 w-3.5" /> CSV
                  </button>
                )}
                {canManageWeight && (
                  <button type="button" onClick={() => setShowAddWeight(true)}
                    className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors">
                    <Plus className="h-3.5 w-3.5" /> Record Weight
                  </button>
                )}
              </div>
            </div>
            {weightLoading ? (
              <div className="animate-pulse h-32 rounded-2xl bg-gray-200" />
            ) : weightSamples.length === 0 ? (
              <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-200">
                <Scale className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No weight samples recorded.</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-left">
                      <th className="px-5 py-3 font-medium text-gray-500">Date</th>
                      <th className="px-5 py-3 font-medium text-gray-500 text-right">Sample</th>
                      <th className="px-5 py-3 font-medium text-gray-500 text-right">Avg Weight</th>
                      <th className="px-5 py-3 font-medium text-gray-500 text-right">Target</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {weightSamples.map((w) => (
                      <tr key={w.id} className="hover:bg-gray-50 group">
                        <td className="px-5 py-3 text-gray-700">{formatDate(w.sampleDate)}</td>
                        <td className="px-5 py-3 text-right text-gray-600">{w.sampleSize} birds</td>
                        <td className="px-5 py-3 text-right font-semibold text-gray-900">{formatKg(w.avgWeightKg)}</td>
                        <td className="px-5 py-3 text-right text-gray-400">{w.targetWeightKg != null ? formatKg(w.targetWeightKg) : "—"}</td>
                        <td className="px-5 py-3">
                          {canManageWeight && (
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button type="button" onClick={() => openEditWeight(w)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><Pencil className="h-3.5 w-3.5" /></button>
                              <button type="button" onClick={() => setDeleteWeight(w)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Harvest Records tab ────────────────────────────────────────── */}
        {tab === "harvest" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-900">Harvest Records ({harvestRecords.length})</h2>
              <div className="flex items-center gap-2">
                {harvestRecords.length > 0 && (
                  <button type="button"
                    onClick={() => handleExport(`/api/v1/export/flocks/${id}/harvest-records.csv`, `flock-${flock.batchCode}-harvest-records.csv`, "harvest-csv")}
                    disabled={downloading !== null}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                    <Download className="h-3.5 w-3.5" /> CSV
                  </button>
                )}
                {canManageHarvest && (
                  <button type="button" onClick={() => setShowAddHarvest(true)}
                    className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors">
                    <Plus className="h-3.5 w-3.5" /> Record Harvest
                  </button>
                )}
              </div>
            </div>
            {harvestLoading ? (
              <div className="animate-pulse h-32 rounded-2xl bg-gray-200" />
            ) : harvestRecords.length === 0 ? (
              <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-200">
                <ShoppingBag className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No harvest records yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {harvestRecords.map((h) => (
                  <div key={h.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-gray-900">{formatDate(h.harvestDate)}</p>
                        <p className="text-sm text-gray-500 mt-0.5">{formatNumber(h.birdsHarvested)} birds harvested</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {h.pricePerKg != null && h.totalWeightKg != null && (
                          <div className="text-right">
                            <p className="text-sm font-semibold text-green-700">
                              {(h.totalWeightKg * h.pricePerKg).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <p className="text-xs text-gray-400">est. revenue</p>
                          </div>
                        )}
                        {canManageHarvest && (
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => openEditHarvest(h)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><Pencil className="h-3.5 w-3.5" /></button>
                            <button type="button" onClick={() => setDeleteHarvest(h)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        )}
                      </div>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                      {h.avgWeightKg != null && <><dt className="text-gray-500">Avg weight</dt><dd className="text-gray-900">{formatKg(h.avgWeightKg)}</dd></>}
                      {h.totalWeightKg != null && <><dt className="text-gray-500">Total weight</dt><dd className="text-gray-900">{formatKg(h.totalWeightKg)}</dd></>}
                      {h.buyerName && <><dt className="text-gray-500">Buyer</dt><dd className="text-gray-900">{h.buyerName}</dd></>}
                      {h.pricePerKg != null && <><dt className="text-gray-500">Price/kg</dt><dd className="text-gray-900">{h.pricePerKg}</dd></>}
                      {h.notes && <><dt className="text-gray-500 col-span-2">Notes</dt><dd className="text-gray-900 col-span-2">{h.notes}</dd></>}
                    </dl>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Add Daily Record Modal ───────────────────────────────────────────── */}
      <Modal open={showAddRecord} onClose={() => { setShowAddRecord(false); recordForm.reset(); setRecordError(""); }} title="Add Daily Record">
        <form onSubmit={recordForm.handleSubmit((d) => addRecordMutation.mutate(d))} className="space-y-4">
          <div>
            <label className={LABEL}>Date *</label>
            <input type="date" {...recordForm.register("recordDate")} defaultValue={new Date().toISOString().slice(0, 10)} className={INPUT} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {([["eggsTotal", "Eggs collected"], ["eggsBroken", "Eggs broken"], ["eggsSold", "Eggs sold"], ["mortality", "Mortality"]] as const).map(([field, label]) => (
              <div key={field}>
                <label className={LABEL}>{label}</label>
                <input type="number" min={0} defaultValue={0} {...recordForm.register(field, { valueAsNumber: true })} className={INPUT} />
              </div>
            ))}
          </div>
          <div>
            <label className={LABEL}>Feed consumed (kg)</label>
            <input type="number" step="0.1" min={0} defaultValue={0} {...recordForm.register("feedConsumedKg", { valueAsNumber: true })} className={INPUT} />
          </div>
          {recordError && <p className="text-xs text-red-600">{recordError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setShowAddRecord(false); recordForm.reset(); setRecordError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={recordForm.formState.isSubmitting} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {recordForm.formState.isSubmitting ? "Saving…" : "Save Record"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Daily Record Modal ──────────────────────────────────────────── */}
      <Modal open={!!editRecord} onClose={() => { setEditRecord(null); setRecordError(""); }} title="Edit Daily Record">
        <form onSubmit={recordEditForm.handleSubmit((d) => updateRecordMutation.mutate(d))} className="space-y-4">
          <div>
            <label className={LABEL}>Date *</label>
            <input type="date" {...recordEditForm.register("recordDate")} className={INPUT} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {([["eggsTotal", "Eggs collected"], ["eggsBroken", "Eggs broken"], ["eggsSold", "Eggs sold"], ["mortality", "Mortality"]] as const).map(([field, label]) => (
              <div key={field}>
                <label className={LABEL}>{label}</label>
                <input type="number" min={0} {...recordEditForm.register(field, { valueAsNumber: true })} className={INPUT} />
              </div>
            ))}
          </div>
          <div>
            <label className={LABEL}>Feed consumed (kg)</label>
            <input type="number" step="0.1" min={0} {...recordEditForm.register("feedConsumedKg", { valueAsNumber: true })} className={INPUT} />
          </div>
          {recordError && <p className="text-xs text-red-600">{recordError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setEditRecord(null); setRecordError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={updateRecordMutation.isPending} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {updateRecordMutation.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Add Health Log Modal ─────────────────────────────────────────────── */}
      <Modal open={showAddHealth} onClose={() => { setShowAddHealth(false); healthForm.reset(); setHealthError(""); }} title="Add Health Log">
        <form onSubmit={healthForm.handleSubmit((d) => addHealthMutation.mutate(d))} className="space-y-4">
          <div>
            <label className={LABEL}>Date *</label>
            <input type="date" {...healthForm.register("logDate")} defaultValue={new Date().toISOString().slice(0, 10)} className={INPUT} />
          </div>
          <div><label className={LABEL}>Symptoms</label><textarea rows={2} {...healthForm.register("symptoms")} className={INPUT} /></div>
          <div><label className={LABEL}>Diagnosis</label><textarea rows={2} {...healthForm.register("diagnosis")} className={INPUT} /></div>
          <div><label className={LABEL}>Treatment</label><textarea rows={2} {...healthForm.register("treatment")} className={INPUT} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Medication</label><input {...healthForm.register("medication")} className={INPUT} /></div>
            <div><label className={LABEL}>Dosage (ml)</label><input type="number" step="0.1" min={0} {...healthForm.register("dosageMl")} className={INPUT} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Vet name</label><input {...healthForm.register("vetName")} className={INPUT} /></div>
            <div><label className={LABEL}>Follow-up date</label><input type="date" {...healthForm.register("followUpDate")} className={INPUT} /></div>
          </div>
          <div><label className={LABEL}>Notes</label><textarea rows={2} {...healthForm.register("notes")} className={INPUT} /></div>
          {healthError && <p className="text-xs text-red-600">{healthError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setShowAddHealth(false); healthForm.reset(); setHealthError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={healthForm.formState.isSubmitting} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {healthForm.formState.isSubmitting ? "Saving…" : "Save Log"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Health Log Modal ────────────────────────────────────────────── */}
      <Modal open={!!editHealth} onClose={() => { setEditHealth(null); setHealthError(""); }} title="Edit Health Log">
        <form onSubmit={healthEditForm.handleSubmit((d) => updateHealthMutation.mutate(d))} className="space-y-4">
          <div>
            <label className={LABEL}>Date *</label>
            <input type="date" {...healthEditForm.register("logDate")} className={INPUT} />
          </div>
          <div><label className={LABEL}>Symptoms</label><textarea rows={2} {...healthEditForm.register("symptoms")} className={INPUT} /></div>
          <div><label className={LABEL}>Diagnosis</label><textarea rows={2} {...healthEditForm.register("diagnosis")} className={INPUT} /></div>
          <div><label className={LABEL}>Treatment</label><textarea rows={2} {...healthEditForm.register("treatment")} className={INPUT} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Medication</label><input {...healthEditForm.register("medication")} className={INPUT} /></div>
            <div><label className={LABEL}>Dosage (ml)</label><input type="number" step="0.1" min={0} {...healthEditForm.register("dosageMl")} className={INPUT} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Vet name</label><input {...healthEditForm.register("vetName")} className={INPUT} /></div>
            <div><label className={LABEL}>Follow-up date</label><input type="date" {...healthEditForm.register("followUpDate")} className={INPUT} /></div>
          </div>
          <div><label className={LABEL}>Notes</label><textarea rows={2} {...healthEditForm.register("notes")} className={INPUT} /></div>
          {healthError && <p className="text-xs text-red-600">{healthError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setEditHealth(null); setHealthError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={updateHealthMutation.isPending} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {updateHealthMutation.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Schedule Vaccination Modal ───────────────────────────────────────── */}
      <Modal open={showAddVaccine} onClose={() => { setShowAddVaccine(false); vaccineForm.reset(); setVaccineError(""); }} title="Schedule Vaccination">
        <form onSubmit={vaccineForm.handleSubmit((d) => addVaccineMutation.mutate(d))} className="space-y-4">
          <div>
            <label className={LABEL}>Vaccine name *</label>
            <input {...vaccineForm.register("vaccineName")} className={INPUT} placeholder="e.g. Newcastle Disease" />
            {vaccineForm.formState.errors.vaccineName && <p className="mt-1 text-xs text-red-600">{vaccineForm.formState.errors.vaccineName.message}</p>}
          </div>
          <div>
            <label className={LABEL}>Scheduled date *</label>
            <input type="date" {...vaccineForm.register("scheduledDate")} className={INPUT} />
          </div>
          <div><label className={LABEL}>Notes</label><textarea rows={2} {...vaccineForm.register("notes")} className={INPUT} /></div>
          {vaccineError && <p className="text-xs text-red-600">{vaccineError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setShowAddVaccine(false); vaccineForm.reset(); setVaccineError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={vaccineForm.formState.isSubmitting} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {vaccineForm.formState.isSubmitting ? "Saving…" : "Schedule"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Vaccination Modal ───────────────────────────────────────────── */}
      <Modal open={!!editVaccine} onClose={() => { setEditVaccine(null); setVaccineError(""); }} title="Edit Vaccination">
        <form onSubmit={vaccineEditForm.handleSubmit((d) => updateVaccineMutation.mutate(d))} className="space-y-4">
          <div>
            <label className={LABEL}>Vaccine name *</label>
            <input {...vaccineEditForm.register("vaccineName")} className={INPUT} />
            {vaccineEditForm.formState.errors.vaccineName && <p className="mt-1 text-xs text-red-600">{vaccineEditForm.formState.errors.vaccineName.message}</p>}
          </div>
          <div>
            <label className={LABEL}>Scheduled date *</label>
            <input type="date" {...vaccineEditForm.register("scheduledDate")} className={INPUT} />
          </div>
          <div><label className={LABEL}>Notes</label><textarea rows={2} {...vaccineEditForm.register("notes")} className={INPUT} /></div>
          {vaccineError && <p className="text-xs text-red-600">{vaccineError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setEditVaccine(null); setVaccineError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={updateVaccineMutation.isPending} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {updateVaccineMutation.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Record Weight Modal ──────────────────────────────────────────────── */}
      <Modal open={showAddWeight} onClose={() => { setShowAddWeight(false); weightForm.reset(); setWeightError(""); }} title="Record Weight Sample">
        <form onSubmit={weightForm.handleSubmit((d) => addWeightMutation.mutate(d))} className="space-y-4">
          <div>
            <label className={LABEL}>Date *</label>
            <input type="date" {...weightForm.register("sampleDate")} defaultValue={new Date().toISOString().slice(0, 10)} className={INPUT} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Birds sampled *</label><input type="number" min={1} {...weightForm.register("sampleSize")} className={INPUT} /></div>
            <div><label className={LABEL}>Avg weight (kg) *</label><input type="number" step="0.001" min={0} {...weightForm.register("avgWeightKg")} className={INPUT} /></div>
          </div>
          <div><label className={LABEL}>Target weight (kg)</label><input type="number" step="0.001" min={0} {...weightForm.register("targetWeightKg")} className={INPUT} /></div>
          <div><label className={LABEL}>Notes</label><input {...weightForm.register("notes")} className={INPUT} /></div>
          {weightError && <p className="text-xs text-red-600">{weightError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setShowAddWeight(false); weightForm.reset(); setWeightError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={weightForm.formState.isSubmitting} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {weightForm.formState.isSubmitting ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Weight Sample Modal ─────────────────────────────────────────── */}
      <Modal open={!!editWeight} onClose={() => { setEditWeight(null); setWeightError(""); }} title="Edit Weight Sample">
        <form onSubmit={weightEditForm.handleSubmit((d) => updateWeightMutation.mutate(d))} className="space-y-4">
          <div>
            <label className={LABEL}>Date *</label>
            <input type="date" {...weightEditForm.register("sampleDate")} className={INPUT} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Birds sampled *</label><input type="number" min={1} {...weightEditForm.register("sampleSize")} className={INPUT} /></div>
            <div><label className={LABEL}>Avg weight (kg) *</label><input type="number" step="0.001" min={0} {...weightEditForm.register("avgWeightKg")} className={INPUT} /></div>
          </div>
          <div><label className={LABEL}>Target weight (kg)</label><input type="number" step="0.001" min={0} {...weightEditForm.register("targetWeightKg")} className={INPUT} /></div>
          <div><label className={LABEL}>Notes</label><input {...weightEditForm.register("notes")} className={INPUT} /></div>
          {weightError && <p className="text-xs text-red-600">{weightError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setEditWeight(null); setWeightError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={updateWeightMutation.isPending} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {updateWeightMutation.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Record Harvest Modal ─────────────────────────────────────────────── */}
      <Modal open={showAddHarvest} onClose={() => { setShowAddHarvest(false); harvestForm.reset(); setHarvestError(""); }} title="Record Harvest">
        <form onSubmit={harvestForm.handleSubmit((d) => addHarvestMutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Date *</label><input type="date" {...harvestForm.register("harvestDate")} defaultValue={new Date().toISOString().slice(0, 10)} className={INPUT} /></div>
            <div><label className={LABEL}>Birds harvested *</label><input type="number" min={1} {...harvestForm.register("birdsHarvested")} className={INPUT} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Avg weight (kg)</label><input type="number" step="0.001" min={0} {...harvestForm.register("avgWeightKg")} className={INPUT} /></div>
            <div><label className={LABEL}>Total weight (kg)</label><input type="number" step="0.01" min={0} {...harvestForm.register("totalWeightKg")} className={INPUT} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Buyer name</label><input {...harvestForm.register("buyerName")} className={INPUT} /></div>
            <div><label className={LABEL}>Price per kg</label><input type="number" step="0.01" min={0} {...harvestForm.register("pricePerKg")} className={INPUT} /></div>
          </div>
          <div><label className={LABEL}>Notes</label><textarea rows={2} {...harvestForm.register("notes")} className={INPUT} /></div>
          {harvestError && <p className="text-xs text-red-600">{harvestError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setShowAddHarvest(false); harvestForm.reset(); setHarvestError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={harvestForm.formState.isSubmitting} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {harvestForm.formState.isSubmitting ? "Saving…" : "Save Harvest"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Harvest Modal ───────────────────────────────────────────────── */}
      <Modal open={!!editHarvest} onClose={() => { setEditHarvest(null); setHarvestError(""); }} title="Edit Harvest Record">
        <form onSubmit={harvestEditForm.handleSubmit((d) => updateHarvestMutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Date *</label><input type="date" {...harvestEditForm.register("harvestDate")} className={INPUT} /></div>
            <div><label className={LABEL}>Birds harvested *</label><input type="number" min={1} {...harvestEditForm.register("birdsHarvested")} className={INPUT} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Avg weight (kg)</label><input type="number" step="0.001" min={0} {...harvestEditForm.register("avgWeightKg")} className={INPUT} /></div>
            <div><label className={LABEL}>Total weight (kg)</label><input type="number" step="0.01" min={0} {...harvestEditForm.register("totalWeightKg")} className={INPUT} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Buyer name</label><input {...harvestEditForm.register("buyerName")} className={INPUT} /></div>
            <div><label className={LABEL}>Price per kg</label><input type="number" step="0.01" min={0} {...harvestEditForm.register("pricePerKg")} className={INPUT} /></div>
          </div>
          <div><label className={LABEL}>Notes</label><textarea rows={2} {...harvestEditForm.register("notes")} className={INPUT} /></div>
          {harvestError && <p className="text-xs text-red-600">{harvestError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setEditHarvest(null); setHarvestError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={updateHarvestMutation.isPending} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {updateHarvestMutation.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Confirmations ─────────────────────────────────────────────── */}
      <DeleteConfirm open={!!deleteRecord} onClose={() => setDeleteRecord(null)} label="daily record"
        onConfirm={() => deleteRecordMutation.mutate(deleteRecord!.id)} isPending={deleteRecordMutation.isPending} />
      <DeleteConfirm open={!!deleteHealth} onClose={() => setDeleteHealth(null)} label="health log"
        onConfirm={() => deleteHealthMutation.mutate(deleteHealth!.id)} isPending={deleteHealthMutation.isPending} />
      <DeleteConfirm open={!!deleteVaccine} onClose={() => setDeleteVaccine(null)} label="vaccination"
        onConfirm={() => deleteVaccineMutation.mutate(deleteVaccine!.id)} isPending={deleteVaccineMutation.isPending} />
      <DeleteConfirm open={!!deleteWeight} onClose={() => setDeleteWeight(null)} label="weight sample"
        onConfirm={() => deleteWeightMutation.mutate(deleteWeight!.id)} isPending={deleteWeightMutation.isPending} />
      <DeleteConfirm open={!!deleteHarvest} onClose={() => setDeleteHarvest(null)} label="harvest record"
        onConfirm={() => deleteHarvestMutation.mutate(deleteHarvest!.id)} isPending={deleteHarvestMutation.isPending} />
    </div>
  );
}
