"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { api, extractError } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import type { Farm, Animal, Species, MilkRecord } from "@/types";

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

const schema = z.object({
  speciesId:      z.string().min(1, "Species is required"),
  recordDate:     z.string().min(1, "Date is required"),
  session:        z.enum(["Morning", "Evening", "FullDay"]),
  quantityLitres: z.string().min(1),
  animalId:       z.string().optional(),
  notes:          z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function MilkProductionPage() {
  const t  = useTranslations("milk");
  const tc = useTranslations("common");

  const qc = useQueryClient();
  const [farmId, setFarmId] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [serverError, setServerError] = useState("");

  const { data: farms = [] }   = useQuery<Farm[]>({ queryKey: ["farms"], queryFn: () => api.get("/api/v1/farms").then(r => r.data) });
  const { data: species = [] } = useQuery<Species[]>({ queryKey: ["species"], queryFn: () => api.get("/api/v1/species").then(r => r.data) });
  const { data: animals = [] } = useQuery<Animal[]>({
    queryKey: ["animals", farmId],
    queryFn: () => api.get(`/api/v1/farms/${farmId}/animals`).then(r => r.data),
    enabled: !!farmId,
  });
  const { data: records = [], isLoading } = useQuery<MilkRecord[]>({
    queryKey: ["milk", farmId],
    queryFn: () => api.get(`/api/v1/farms/${farmId}/milk`).then(r => r.data),
    enabled: !!farmId,
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { session: "FullDay" } });

  const addMut = useMutation({
    mutationFn: (d: FormData) => api.post(`/api/v1/farms/${farmId}/milk`, {
      speciesId: d.speciesId, recordDate: d.recordDate, session: d.session,
      quantityLitres: parseFloat(d.quantityLitres),
      animalId: d.animalId || null, notes: d.notes || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["milk", farmId] }); reset(); setShowAdd(false); setServerError(""); },
    onError: (err) => setServerError(extractError(err)),
  });

  // Summary stats
  const totalToday = records
    .filter(r => r.recordDate === new Date().toISOString().split("T")[0])
    .reduce((s, r) => s + r.quantityLitres, 0);
  const totalAll = records.reduce((s, r) => s + r.quantityLitres, 0);

  const spName = (id: string) => species.find(s => s.id === id)?.name ?? "—";
  const animalLabel = (id: string | null) => { if (!id) return null; const a = animals.find(x => x.id === id); return a ? a.tagNumber : null; };

  const SESSION_COLORS = { Morning: "bg-yellow-100 text-yellow-700", Evening: "bg-indigo-100 text-indigo-700", FullDay: "bg-green-100 text-green-700" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t("subtitle")}</p>
        </div>
        {farmId && (
          <button type="button" onClick={() => { setShowAdd(true); setServerError(""); }}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors">
            {t("addRecord")}
          </button>
        )}
      </div>

      <div className="max-w-xs">
        <label className={LABEL}>{t("farm")}</label>
        <select value={farmId} onChange={e => setFarmId(e.target.value)} className={INPUT}>
          <option value="">Choose a farm…</option>
          {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>

      {farmId && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="text-xs text-gray-500">{t("today")}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalToday.toFixed(1)} L</p>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="text-xs text-gray-500">{t("allRecordsTotal")}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalAll.toFixed(1)} L</p>
            </div>
          </div>

          {/* Records */}
          {isLoading ? <div className="animate-pulse h-20 rounded-xl bg-gray-200" /> :
           records.length === 0 ? (
            <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-200">
              <p className="text-sm text-gray-400">{t("noRecords")}</p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 divide-y divide-gray-100">
              {records.map(r => (
                <div key={r.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {spName(r.speciesId)}{animalLabel(r.animalId) ? ` — ${animalLabel(r.animalId)}` : ""}
                    </p>
                    <p className="text-xs text-gray-400">{new Date(r.recordDate).toLocaleDateString()}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${SESSION_COLORS[r.session]}`}>{r.session}</span>
                  <span className="text-sm font-semibold text-gray-900">{r.quantityLitres.toFixed(1)} L</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Modal open={showAdd} onClose={() => { setShowAdd(false); reset(); setServerError(""); }} title={t("addRecord")}>
        <form onSubmit={handleSubmit(d => addMut.mutate(d))} className="space-y-4">
          <div>
            <label className={LABEL}>{t("form.species")} *</label>
            <select {...register("speciesId")} className={INPUT}>
              <option value="">Select species…</option>
              {species.filter(s => s.isDairy).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {errors.speciesId && <p className="mt-1 text-xs text-red-600">{errors.speciesId.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>{t("form.date")} *</label>
              <input type="date" {...register("recordDate")} className={INPUT} defaultValue={new Date().toISOString().split("T")[0]} />
            </div>
            <div>
              <label className={LABEL}>{t("form.session")} *</label>
              <select {...register("session")} className={INPUT}>
                <option value="Morning">{t("form.sessions.morning")}</option>
                <option value="Evening">{t("form.sessions.evening")}</option>
                <option value="FullDay">{t("form.sessions.fullDay")}</option>
              </select>
            </div>
          </div>
          <div>
            <label className={LABEL}>{t("form.quantityLitres")} *</label>
            <input type="number" step="0.01" min="0" {...register("quantityLitres")} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>{t("form.animal")}</label>
            <select {...register("animalId")} className={INPUT}>
              <option value="">{t("form.groupAverage")}</option>
              {animals.filter(a => a.sex === "Female" && a.status === "Alive").map(a => (
                <option key={a.id} value={a.id}>{a.tagNumber}{a.name ? ` — ${a.name}` : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>{tc("notes")}</label>
            <textarea {...register("notes")} rows={2} className={INPUT + " resize-none"} />
          </div>
          {serverError && <p className="text-xs text-red-600">{serverError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setShowAdd(false); reset(); setServerError(""); }} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">{tc("cancel")}</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">{isSubmitting ? tc("saving") : tc("save")}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
