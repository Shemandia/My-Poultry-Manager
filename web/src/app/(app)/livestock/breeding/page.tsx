"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { api, extractError } from "@/lib/api";
import type { Farm, Animal, MatingRecord, PregnancyRecord, BirthRecord, PregnancyStatus } from "@/types";

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

// ── Status helpers ────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<PregnancyStatus, string> = {
  Suspected:    "bg-yellow-100 text-yellow-700",
  Confirmed:    "bg-blue-100 text-blue-700",
  GaveBirth:    "bg-green-100 text-green-700",
  Aborted:      "bg-red-100 text-red-600",
  NotPregnant:  "bg-gray-100 text-gray-500",
};

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

// ── Schemas ──────────────────────────────────────────────────────────────────
const matingSchema = z.object({
  damId:        z.string().min(1, "Dam is required"),
  matingDate:   z.string().min(1, "Mating date is required"),
  matingMethod: z.enum(["Natural", "AI", "ET"]),
  sireId:       z.string().optional(),
  sireTag:      z.string().optional(),
  notes:        z.string().optional(),
});
type MatingForm = z.infer<typeof matingSchema>;

const pregnancySchema = z.object({
  damId:           z.string().min(1, "Dam is required"),
  expectedDueDate: z.string().min(1, "Expected due date is required"),
  confirmedDate:   z.string().optional(),
  matingRecordId:  z.string().optional(),
  notes:           z.string().optional(),
});
type PregnancyForm = z.infer<typeof pregnancySchema>;

const birthSchema = z.object({
  damId:             z.string().min(1, "Dam is required"),
  birthDate:         z.string().min(1, "Birth date is required"),
  totalBorn:         z.string().min(1),
  liveBorn:          z.string().min(1),
  stillborn:         z.string().min(1),
  birthType:         z.enum(["Single", "Twins", "Triplets", "Other"]),
  sireId:            z.string().optional(),
  sireTag:           z.string().optional(),
  pregnancyRecordId: z.string().optional(),
  complications:     z.string().optional(),
  notes:             z.string().optional(),
});
type BirthForm = z.infer<typeof birthSchema>;

type Tab = "matings" | "pregnancies" | "births";

// ── Page ─────────────────────────────────────────────────────────────────────
export default function BreedingPage() {
  const t  = useTranslations("breeding");
  const tc = useTranslations("common");

  const qc = useQueryClient();
  const [farmId, setFarmId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<Tab>("pregnancies");
  const [serverError, setServerError] = useState("");

  const [showAddMating, setShowAddMating]       = useState(false);
  const [showAddPregnancy, setShowAddPregnancy] = useState(false);
  const [showAddBirth, setShowAddBirth]         = useState(false);
  const [statusTarget, setStatusTarget]         = useState<PregnancyRecord | null>(null);
  const [newStatus, setNewStatus]               = useState<PregnancyStatus>("Confirmed");

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: farms = [] } = useQuery<Farm[]>({
    queryKey: ["farms"],
    queryFn: () => api.get("/api/v1/farms").then((r) => r.data),
  });

  const { data: females = [] } = useQuery<Animal[]>({
    queryKey: ["animals", farmId, "female"],
    queryFn: () => api.get(`/api/v1/farms/${farmId}/animals`, { params: { sex: "Female" } }).then((r) => r.data),
    enabled: !!farmId,
  });

  const { data: males = [] } = useQuery<Animal[]>({
    queryKey: ["animals", farmId, "male"],
    queryFn: () => api.get(`/api/v1/farms/${farmId}/animals`, { params: { sex: "Male" } }).then((r) => r.data),
    enabled: !!farmId,
  });

  const { data: matings = [], isLoading: matingsLoading } = useQuery<MatingRecord[]>({
    queryKey: ["matings", farmId],
    queryFn: () => api.get(`/api/v1/farms/${farmId}/matings`).then((r) => r.data),
    enabled: !!farmId,
  });

  const { data: pregnancies = [], isLoading: pregnanciesLoading } = useQuery<PregnancyRecord[]>({
    queryKey: ["pregnancies", farmId],
    queryFn: () => api.get(`/api/v1/farms/${farmId}/pregnancies`).then((r) => r.data),
    enabled: !!farmId,
  });

  const { data: births = [], isLoading: birthsLoading } = useQuery<BirthRecord[]>({
    queryKey: ["births", farmId],
    queryFn: () => api.get(`/api/v1/farms/${farmId}/births`).then((r) => r.data),
    enabled: !!farmId,
  });

  // ── Forms ────────────────────────────────────────────────────────────────
  const { register: regM, handleSubmit: hsM, reset: resetM, formState: { errors: errM, isSubmitting: subM } } =
    useForm<MatingForm>({ resolver: zodResolver(matingSchema), defaultValues: { matingMethod: "Natural" } });

  const { register: regP, handleSubmit: hsP, reset: resetP, formState: { errors: errP, isSubmitting: subP } } =
    useForm<PregnancyForm>({ resolver: zodResolver(pregnancySchema) });

  const { register: regB, handleSubmit: hsB, reset: resetB, formState: { errors: errB, isSubmitting: subB } } =
    useForm<BirthForm>({ resolver: zodResolver(birthSchema), defaultValues: { birthType: "Single" } });

  // ── Mutations ────────────────────────────────────────────────────────────
  const addMatingMut = useMutation({
    mutationFn: (d: MatingForm) => api.post(`/api/v1/farms/${farmId}/matings`, {
      damId: d.damId, matingDate: d.matingDate, matingMethod: d.matingMethod,
      sireId: d.sireId || null, sireTag: d.sireTag || null, notes: d.notes || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["matings", farmId] }); resetM(); setShowAddMating(false); setServerError(""); },
    onError: (err) => setServerError(extractError(err)),
  });

  const addPregnancyMut = useMutation({
    mutationFn: (d: PregnancyForm) => api.post(`/api/v1/farms/${farmId}/pregnancies`, {
      damId: d.damId, expectedDueDate: d.expectedDueDate,
      confirmedDate: d.confirmedDate || null, matingRecordId: d.matingRecordId || null,
      notes: d.notes || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pregnancies", farmId] }); resetP(); setShowAddPregnancy(false); setServerError(""); },
    onError: (err) => setServerError(extractError(err)),
  });

  const addBirthMut = useMutation({
    mutationFn: (d: BirthForm) => api.post(`/api/v1/farms/${farmId}/births`, {
      damId: d.damId, birthDate: d.birthDate, totalBorn: parseInt(d.totalBorn),
      liveBorn: parseInt(d.liveBorn), stillborn: parseInt(d.stillborn), birthType: d.birthType,
      sireId: d.sireId || null, sireTag: d.sireTag || null,
      pregnancyRecordId: d.pregnancyRecordId || null,
      complications: d.complications || null, notes: d.notes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["births", farmId] });
      qc.invalidateQueries({ queryKey: ["pregnancies", farmId] });
      resetB(); setShowAddBirth(false); setServerError("");
    },
    onError: (err) => setServerError(extractError(err)),
  });

  const updateStatusMut = useMutation({
    mutationFn: () => api.patch(`/api/v1/pregnancies/${statusTarget!.id}/status`, {
      status: newStatus,
      actualBirthDate: newStatus === "GaveBirth" ? new Date().toISOString().split("T")[0] : null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pregnancies", farmId] }); setStatusTarget(null); setServerError(""); },
    onError: (err) => setServerError(extractError(err)),
  });

  // ── Helpers ──────────────────────────────────────────────────────────────
  function animalLabel(id: string) {
    const a = [...females, ...males].find((x) => x.id === id);
    return a ? `${a.tagNumber}${a.name ? ` (${a.name})` : ""}` : id.slice(0, 8);
  }

  function handleAddClick() {
    setServerError("");
    if (activeTab === "matings") setShowAddMating(true);
    else if (activeTab === "pregnancies") setShowAddPregnancy(true);
    else setShowAddBirth(true);
  }

  const ADD_LABELS: Record<Tab, string> = {
    matings:     t("addMating"),
    pregnancies: t("addPregnancy"),
    births:      t("addBirth"),
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "pregnancies", label: t("tabs.pregnancies"), count: pregnancies.length },
    { key: "matings",     label: t("tabs.matings"),     count: matings.length },
    { key: "births",      label: t("tabs.births"),      count: births.length },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t("subtitle")}</p>
        </div>
        {farmId && (
          <button type="button" onClick={handleAddClick}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors">
            {ADD_LABELS[activeTab]}
          </button>
        )}
      </div>

      {/* Farm selector */}
      <div className="max-w-xs">
        <label className={LABEL}>{t("selectFarm")}</label>
        <select value={farmId} onChange={(e) => setFarmId(e.target.value)} className={INPUT}>
          <option value="">{t("chooseFarm")}</option>
          {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>

      {!farmId && (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-200">
          <p className="text-sm text-gray-400">{t("selectFarmPrompt")}</p>
        </div>
      )}

      {farmId && (
        <>
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex">
              {tabs.map((tab) => (
                <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                  {tab.label} <span className="ml-1 text-xs text-gray-400">({tab.count})</span>
                </button>
              ))}
            </nav>
          </div>

          {/* ── PREGNANCIES ──────────────────────────────────────────────── */}
          {activeTab === "pregnancies" && (
            pregnanciesLoading ? <div className="animate-pulse h-20 rounded-xl bg-gray-200" /> :
            pregnancies.length === 0 ? (
              <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-200">
                <p className="text-sm text-gray-400">{t("noPregnancies")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pregnancies.map((p) => {
                  const days = daysUntil(p.expectedDueDate);
                  const isActive = p.status === "Suspected" || p.status === "Confirmed";
                  return (
                    <div key={p.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-900 text-sm">{animalLabel(p.damId)}</p>
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status]}`}>{p.status}</span>
                          </div>
                          <div className="mt-2 flex gap-5 text-xs text-gray-500 flex-wrap">
                            <span>{t("due")} {new Date(p.expectedDueDate).toLocaleDateString()}</span>
                            {isActive && <span className={days < 7 ? "font-semibold text-orange-600" : ""}>{days > 0 ? t("daysRemaining", { days }) : t("daysOverdue", { days: Math.abs(days) })}</span>}
                            {p.confirmedDate && <span>{t("confirmed")} {new Date(p.confirmedDate).toLocaleDateString()}</span>}
                            {p.actualBirthDate && <span>{t("born")} {new Date(p.actualBirthDate).toLocaleDateString()}</span>}
                          </div>
                          {p.notes && <p className="mt-1 text-xs text-gray-400 line-clamp-1">{p.notes}</p>}
                        </div>
                        {isActive && (
                          <button type="button"
                            onClick={() => { setStatusTarget(p); setNewStatus("Confirmed"); setServerError(""); }}
                            className="shrink-0 text-xs border border-gray-200 hover:border-green-400 text-gray-500 hover:text-green-700 rounded-lg px-3 py-1 transition-colors">
                            {t("updateStatus")}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* ── MATINGS ──────────────────────────────────────────────────── */}
          {activeTab === "matings" && (
            matingsLoading ? <div className="animate-pulse h-20 rounded-xl bg-gray-200" /> :
            matings.length === 0 ? (
              <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-200">
                <p className="text-sm text-gray-400">{t("noMatings")}</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 divide-y divide-gray-100">
                {matings.map((m) => (
                  <div key={m.id} className="flex items-center gap-4 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        Dam: {animalLabel(m.damId)}
                        {(m.sireId || m.sireTag) && <span className="text-gray-400"> × Sire: {m.sireId ? animalLabel(m.sireId) : m.sireTag}</span>}
                      </p>
                    </div>
                    <span className="rounded-full bg-purple-100 text-purple-700 px-2.5 py-0.5 text-xs font-medium">{m.matingMethod}</span>
                    <span className="text-xs text-gray-400">{new Date(m.matingDate).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )
          )}

          {/* ── BIRTHS ───────────────────────────────────────────────────── */}
          {activeTab === "births" && (
            birthsLoading ? <div className="animate-pulse h-20 rounded-xl bg-gray-200" /> :
            births.length === 0 ? (
              <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-200">
                <p className="text-sm text-gray-400">{t("noBirths")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {births.map((b) => (
                  <div key={b.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">Dam: {animalLabel(b.damId)}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{new Date(b.birthDate).toLocaleDateString()}</p>
                      </div>
                      <span className="rounded-full bg-green-100 text-green-700 px-2.5 py-0.5 text-xs font-medium">{b.birthType}</span>
                    </div>
                    <div className="mt-3 flex gap-5 text-xs text-gray-500">
                      <span>Total: <strong className="text-gray-900">{b.totalBorn}</strong></span>
                      <span>Live: <strong className="text-green-700">{b.liveBorn}</strong></span>
                      {b.stillborn > 0 && <span>Stillborn: <strong className="text-red-600">{b.stillborn}</strong></span>}
                    </div>
                    {b.complications && <p className="mt-2 text-xs text-orange-600">{b.complications}</p>}
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}

      {/* ── MODALS ───────────────────────────────────────────────────────── */}

      {/* Record Mating */}
      <Modal open={showAddMating} onClose={() => { setShowAddMating(false); resetM(); setServerError(""); }} title={t("addMating")}>
        <form onSubmit={hsM((d) => addMatingMut.mutate(d))} className="space-y-4">
          <div>
            <label className={LABEL}>{t("form.dam")} *</label>
            <select {...regM("damId")} className={INPUT}>
              <option value="">Select female…</option>
              {females.map((a) => <option key={a.id} value={a.id}>{a.tagNumber}{a.name ? ` — ${a.name}` : ""}</option>)}
            </select>
            {errM.damId && <p className="mt-1 text-xs text-red-600">{errM.damId.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>{t("form.matingDate")} *</label>
              <input type="date" {...regM("matingDate")} className={INPUT} />
              {errM.matingDate && <p className="mt-1 text-xs text-red-600">{errM.matingDate.message}</p>}
            </div>
            <div>
              <label className={LABEL}>{t("form.method")} *</label>
              <select {...regM("matingMethod")} className={INPUT}>
                <option value="Natural">{t("form.methods.natural")}</option>
                <option value="AI">{t("form.methods.ai")}</option>
                <option value="ET">{t("form.methods.et")}</option>
              </select>
            </div>
          </div>
          <div>
            <label className={LABEL}>{t("form.sireInternal")}</label>
            <select {...regM("sireId")} className={INPUT}>
              <option value="">External sire / unknown…</option>
              {males.map((a) => <option key={a.id} value={a.id}>{a.tagNumber}{a.name ? ` — ${a.name}` : ""}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>{t("form.sireExternal")}</label>
            <input {...regM("sireTag")} placeholder="e.g. BULL-EXT-001" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>{tc("notes")}</label>
            <textarea {...regM("notes")} rows={2} className={INPUT + " resize-none"} />
          </div>
          {serverError && <p className="text-xs text-red-600">{serverError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setShowAddMating(false); resetM(); setServerError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">{tc("cancel")}</button>
            <button type="submit" disabled={subM} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">{subM ? tc("saving") : tc("save")}</button>
          </div>
        </form>
      </Modal>

      {/* Track Pregnancy */}
      <Modal open={showAddPregnancy} onClose={() => { setShowAddPregnancy(false); resetP(); setServerError(""); }} title={t("addPregnancy")}>
        <form onSubmit={hsP((d) => addPregnancyMut.mutate(d))} className="space-y-4">
          <div>
            <label className={LABEL}>{t("form.dam")} *</label>
            <select {...regP("damId")} className={INPUT}>
              <option value="">Select female…</option>
              {females.map((a) => <option key={a.id} value={a.id}>{a.tagNumber}{a.name ? ` — ${a.name}` : ""}</option>)}
            </select>
            {errP.damId && <p className="mt-1 text-xs text-red-600">{errP.damId.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>{t("form.expectedDueDate")} *</label>
              <input type="date" {...regP("expectedDueDate")} className={INPUT} />
              {errP.expectedDueDate && <p className="mt-1 text-xs text-red-600">{errP.expectedDueDate.message}</p>}
            </div>
            <div>
              <label className={LABEL}>{t("form.confirmedDate")}</label>
              <input type="date" {...regP("confirmedDate")} className={INPUT} />
            </div>
          </div>
          <div>
            <label className={LABEL}>{t("form.linkMating")}</label>
            <select {...regP("matingRecordId")} className={INPUT}>
              <option value="">None</option>
              {matings.map((m) => <option key={m.id} value={m.id}>{animalLabel(m.damId)} — {new Date(m.matingDate).toLocaleDateString()}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>{tc("notes")}</label>
            <textarea {...regP("notes")} rows={2} className={INPUT + " resize-none"} />
          </div>
          {serverError && <p className="text-xs text-red-600">{serverError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setShowAddPregnancy(false); resetP(); setServerError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">{tc("cancel")}</button>
            <button type="submit" disabled={subP} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">{subP ? tc("saving") : tc("save")}</button>
          </div>
        </form>
      </Modal>

      {/* Record Birth */}
      <Modal open={showAddBirth} onClose={() => { setShowAddBirth(false); resetB(); setServerError(""); }} title={t("addBirth")}>
        <form onSubmit={hsB((d) => addBirthMut.mutate(d))} className="space-y-4">
          <div>
            <label className={LABEL}>{t("form.dam")} *</label>
            <select {...regB("damId")} className={INPUT}>
              <option value="">Select female…</option>
              {females.map((a) => <option key={a.id} value={a.id}>{a.tagNumber}{a.name ? ` — ${a.name}` : ""}</option>)}
            </select>
            {errB.damId && <p className="mt-1 text-xs text-red-600">{errB.damId.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>{t("form.birthDate")} *</label>
              <input type="date" {...regB("birthDate")} className={INPUT} />
              {errB.birthDate && <p className="mt-1 text-xs text-red-600">{errB.birthDate.message}</p>}
            </div>
            <div>
              <label className={LABEL}>{t("form.birthType")} *</label>
              <select {...regB("birthType")} className={INPUT}>
                <option value="Single">Single</option>
                <option value="Twins">Twins</option>
                <option value="Triplets">Triplets</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>{t("form.totalBorn")} *</label>
              <input type="number" min={1} {...regB("totalBorn")} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>{t("form.live")} *</label>
              <input type="number" min={0} {...regB("liveBorn")} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>{t("form.stillborn")} *</label>
              <input type="number" min={0} {...regB("stillborn")} className={INPUT} />
            </div>
          </div>
          <div>
            <label className={LABEL}>Link to pregnancy record</label>
            <select {...regB("pregnancyRecordId")} className={INPUT}>
              <option value="">None</option>
              {pregnancies.filter((p) => p.status !== "GaveBirth").map((p) => (
                <option key={p.id} value={p.id}>{animalLabel(p.damId)} — due {new Date(p.expectedDueDate).toLocaleDateString()}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Complications</label>
            <input {...regB("complications")} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>{tc("notes")}</label>
            <textarea {...regB("notes")} rows={2} className={INPUT + " resize-none"} />
          </div>
          {serverError && <p className="text-xs text-red-600">{serverError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setShowAddBirth(false); resetB(); setServerError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">{tc("cancel")}</button>
            <button type="submit" disabled={subB} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">{subB ? tc("saving") : tc("save")}</button>
          </div>
        </form>
      </Modal>

      {/* Update pregnancy status */}
      <Modal open={!!statusTarget} onClose={() => setStatusTarget(null)} title={t("updatePregnancyStatus")}>
        <div className="space-y-4">
          <div>
            <label className={LABEL}>{t("form.dam")}</label>
            <p className="text-sm text-gray-700 font-medium">{statusTarget ? animalLabel(statusTarget.damId) : ""}</p>
          </div>
          <div>
            <label className={LABEL}>New status *</label>
            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as PregnancyStatus)} className={INPUT}>
              <option value="Suspected">{t("pregnancyStatus.suspected")}</option>
              <option value="Confirmed">{t("pregnancyStatus.confirmed")}</option>
              <option value="Aborted">{t("pregnancyStatus.aborted")}</option>
              <option value="NotPregnant">{t("pregnancyStatus.notPregnant")}</option>
            </select>
          </div>
          {serverError && <p className="text-xs text-red-600">{serverError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setStatusTarget(null)} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">{tc("cancel")}</button>
            <button type="button" disabled={updateStatusMut.isPending} onClick={() => updateStatusMut.mutate()} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {updateStatusMut.isPending ? tc("saving") : t("updateStatus")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
