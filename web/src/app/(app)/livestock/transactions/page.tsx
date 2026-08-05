"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { api, extractError } from "@/lib/api";
import type { Farm, Species, AnimalTransaction } from "@/types";

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
  speciesId:       z.string().min(1, "Species is required"),
  transactionType: z.enum(["Purchase", "Sale"]),
  headCount:       z.string().min(1),
  totalPrice:      z.string().min(1),
  transactionDate: z.string().min(1, "Date is required"),
  counterpartyName: z.string().optional(),
  notes:           z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function AnimalTransactionsPage() {
  const t  = useTranslations("transactions");
  const tc = useTranslations("common");

  const qc = useQueryClient();
  const [farmId, setFarmId] = useState("");
  const [filterType, setFilterType] = useState<"" | "Purchase" | "Sale">("");
  const [showAdd, setShowAdd] = useState(false);
  const [serverError, setServerError] = useState("");

  const { data: farms = [] }   = useQuery<Farm[]>({ queryKey: ["farms"], queryFn: () => api.get("/api/v1/farms").then(r => r.data) });
  const { data: species = [] } = useQuery<Species[]>({ queryKey: ["species"], queryFn: () => api.get("/api/v1/species").then(r => r.data) });
  const { data: txs = [], isLoading } = useQuery<AnimalTransaction[]>({
    queryKey: ["animal-txs", farmId, filterType],
    queryFn: () => api.get(`/api/v1/farms/${farmId}/animal-transactions`, { params: filterType ? { type: filterType } : {} }).then(r => r.data),
    enabled: !!farmId,
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { transactionType: "Purchase" } });

  const addMut = useMutation({
    mutationFn: (d: FormData) => api.post(`/api/v1/farms/${farmId}/animal-transactions`, {
      speciesId: d.speciesId, transactionType: d.transactionType,
      headCount: parseInt(d.headCount), totalPrice: parseFloat(d.totalPrice),
      transactionDate: d.transactionDate,
      counterpartyName: d.counterpartyName || null, notes: d.notes || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["animal-txs", farmId] }); reset(); setShowAdd(false); setServerError(""); },
    onError: (err) => setServerError(extractError(err)),
  });

  const spName = (id: string) => species.find(s => s.id === id)?.name ?? "—";
  const totalPurchases = txs.filter(tx => tx.transactionType === "Purchase").reduce((s, tx) => s + tx.totalPrice, 0);
  const totalSales     = txs.filter(tx => tx.transactionType === "Sale").reduce((s, tx) => s + tx.totalPrice, 0);

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
            {t("addTransaction")}
          </button>
        )}
      </div>

      <div className="flex gap-4 flex-wrap">
        <div className="w-56">
          <label className={LABEL}>Farm</label>
          <select value={farmId} onChange={e => setFarmId(e.target.value)} className={INPUT}>
            <option value="">{t("chooseFarm")}</option>
            {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        {farmId && (
          <div className="w-40">
            <label className={LABEL}>{tc("type")}</label>
            <select value={filterType} onChange={e => setFilterType(e.target.value as "" | "Purchase" | "Sale")} className={INPUT}>
              <option value="">{t("allTypes")}</option>
              <option value="Purchase">{t("purchases")}</option>
              <option value="Sale">{t("sales")}</option>
            </select>
          </div>
        )}
      </div>

      {farmId && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="text-xs text-gray-500">{t("totalPurchases")}</p>
              <p className="text-2xl font-bold text-red-600 mt-1">- {totalPurchases.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="text-xs text-gray-500">{t("totalSales")}</p>
              <p className="text-2xl font-bold text-green-600 mt-1">+ {totalSales.toLocaleString()}</p>
            </div>
          </div>

          {isLoading ? <div className="animate-pulse h-20 rounded-xl bg-gray-200" /> :
           txs.length === 0 ? (
            <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-200">
              <p className="text-sm text-gray-400">{t("noTransactions")}</p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 divide-y divide-gray-100">
              {txs.map(tx => (
                <div key={tx.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {spName(tx.speciesId)} — {tx.headCount} head
                      {tx.counterpartyName && <span className="text-gray-400 font-normal"> · {tx.counterpartyName}</span>}
                    </p>
                    <p className="text-xs text-gray-400">{new Date(tx.transactionDate).toLocaleDateString()}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tx.transactionType === "Purchase" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                    {tx.transactionType === "Purchase" ? t("types.purchase") : t("types.sale")}
                  </span>
                  <span className={`text-sm font-semibold ${tx.transactionType === "Purchase" ? "text-red-600" : "text-green-600"}`}>
                    {tx.transactionType === "Purchase" ? "-" : "+"}{tx.totalPrice.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Modal open={showAdd} onClose={() => { setShowAdd(false); reset(); setServerError(""); }} title={t("addTransaction")}>
        <form onSubmit={handleSubmit(d => addMut.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>{t("form.type")} *</label>
              <select {...register("transactionType")} className={INPUT}>
                <option value="Purchase">Purchase (Buy)</option>
                <option value="Sale">Sale (Sell)</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>{t("form.date")} *</label>
              <input type="date" {...register("transactionDate")} className={INPUT} defaultValue={new Date().toISOString().split("T")[0]} />
              {errors.transactionDate && <p className="mt-1 text-xs text-red-600">{errors.transactionDate.message}</p>}
            </div>
          </div>
          <div>
            <label className={LABEL}>{t("form.species")} *</label>
            <select {...register("speciesId")} className={INPUT}>
              <option value="">Select species…</option>
              {species.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {errors.speciesId && <p className="mt-1 text-xs text-red-600">{errors.speciesId.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>{t("form.headCount")} *</label>
              <input type="number" min={1} {...register("headCount")} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>{t("form.totalPrice")} *</label>
              <input type="number" min={0} step="0.01" {...register("totalPrice")} className={INPUT} />
            </div>
          </div>
          <div>
            <label className={LABEL}>{t("form.buyerSeller")}</label>
            <input {...register("counterpartyName")} placeholder="e.g. John Farmer" className={INPUT} />
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
