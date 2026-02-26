"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, TrendingUp, TrendingDown, DollarSign, Download, FileText, Pencil, Trash2 } from "lucide-react";
import { api, extractError } from "@/lib/api";
import { downloadFile } from "@/lib/download";
import { formatDate } from "@/lib/utils";
import type { FinancialTransaction, TransactionType, TransactionCategory } from "@/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES: { value: TransactionCategory; label: string; type: "income" | "expense" | "both" }[] = [
  { value: "egg_sale",   label: "Egg Sale",    type: "income"  },
  { value: "bird_sale",  label: "Bird Sale",   type: "income"  },
  { value: "feed",       label: "Feed",        type: "expense" },
  { value: "medication", label: "Medication",  type: "expense" },
  { value: "utilities",  label: "Utilities",   type: "expense" },
  { value: "labor",      label: "Labor",       type: "expense" },
  { value: "other",      label: "Other",       type: "both"    },
];

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label])
);

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  type: z.enum(["income", "expense"]),
  category: z.enum(["feed", "medication", "utilities", "egg_sale", "bird_sale", "labor", "other"]),
  amount: z.string().min(1, "Amount is required"),
  transactionDate: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
  reference: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function Modal({ open, onClose: _onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
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

function formatCurrency(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const INPUT = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100";
const LABEL = "block text-sm font-medium text-gray-700 mb-1";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editTx, setEditTx] = useState<FinancialTransaction | null>(null);
  const [deleteTx, setDeleteTx] = useState<FinancialTransaction | null>(null);
  const [serverError, setServerError] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransactionType | "">("");
  const [downloading, setDownloading] = useState<"csv" | "pdf" | null>(null);

  const handleExport = async (format: "csv" | "pdf") => {
    setDownloading(format);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo)   params.set("dateTo", dateTo);
      if (typeFilter) params.set("type", typeFilter);
      const qs = params.toString() ? `?${params}` : "";
      if (format === "csv") {
        await downloadFile(`/api/v1/export/transactions.csv${qs}`, "transactions.csv");
      } else {
        await downloadFile(`/api/v1/export/reports/finance.pdf${qs}`, "finance-report.pdf");
      }
    } catch {
      // silently ignore
    } finally {
      setDownloading(null);
    }
  };

  const queryParams = new URLSearchParams();
  if (dateFrom) queryParams.set("dateFrom", dateFrom);
  if (dateTo)   queryParams.set("dateTo", dateTo);
  if (typeFilter) queryParams.set("type", typeFilter);

  const { data: transactions = [], isLoading } = useQuery<FinancialTransaction[]>({
    queryKey: ["transactions", dateFrom, dateTo, typeFilter],
    queryFn: () => api.get(`/api/v1/transactions?${queryParams}`).then((r) => r.data),
  });

  const totalIncome  = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const netProfit    = totalIncome - totalExpense;

  const { register: regAdd, handleSubmit: hsAdd, watch: watchAdd, reset: resetAdd, formState: { errors: errAdd, isSubmitting: subAdd } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: { type: "expense", category: "other" },
    });

  const { register: regEdit, handleSubmit: hsEdit, watch: watchEdit, reset: resetEdit, formState: { errors: errEdit, isSubmitting: subEdit } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: { type: "expense", category: "other" },
    });

  const selectedTypeAdd  = watchAdd("type");
  const selectedTypeEdit = watchEdit("type");

  const availableCategoriesAdd  = CATEGORIES.filter((c) => c.type === selectedTypeAdd  || c.type === "both");
  const availableCategoriesEdit = CATEGORIES.filter((c) => c.type === selectedTypeEdit || c.type === "both");

  const addMutation = useMutation({
    mutationFn: (data: FormData) =>
      api.post("/api/v1/transactions", {
        type: data.type,
        category: data.category,
        amount: parseFloat(data.amount),
        transactionDate: data.transactionDate,
        notes: data.notes || null,
        reference: data.reference || null,
        farmId: null,
        flockId: null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      resetAdd({ type: "expense", category: "other" });
      setShowAdd(false);
      setServerError("");
    },
    onError: (err) => setServerError(extractError(err)),
  });

  const editMutation = useMutation({
    mutationFn: (data: FormData) =>
      api.put(`/api/v1/transactions/${editTx!.id}`, {
        type: data.type,
        category: data.category,
        amount: parseFloat(data.amount),
        transactionDate: data.transactionDate,
        notes: data.notes || null,
        reference: data.reference || null,
        farmId: editTx!.farmId ?? null,
        flockId: editTx!.flockId ?? null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      setEditTx(null);
      setServerError("");
    },
    onError: (err) => setServerError(extractError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/transactions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      setDeleteTx(null);
    },
    onError: (err) => setServerError(extractError(err)),
  });

  function openEdit(tx: FinancialTransaction) {
    setServerError("");
    resetEdit({
      type: tx.type,
      category: tx.category,
      amount: String(tx.amount),
      transactionDate: tx.transactionDate.slice(0, 10),
      notes: tx.notes ?? "",
      reference: tx.reference ?? "",
    });
    setEditTx(tx);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
          <p className="text-sm text-gray-500 mt-1">{transactions.length} transaction{transactions.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleExport("csv")}
            disabled={downloading !== null}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            title="Export CSV"
          >
            <Download className="h-4 w-4" />
            {downloading === "csv" ? "Exporting…" : "CSV"}
          </button>
          <button
            type="button"
            onClick={() => handleExport("pdf")}
            disabled={downloading !== null}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            title="Export PDF"
          >
            <FileText className="h-4 w-4" />
            {downloading === "pdf" ? "Exporting…" : "PDF"}
          </button>
          <button
            type="button"
            onClick={() => { setShowAdd(true); setServerError(""); }}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Transaction
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-100">
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
            <p className="text-sm text-gray-500">Total Income</p>
          </div>
          <p className="text-2xl font-bold text-green-700">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100">
              <TrendingDown className="h-4 w-4 text-red-500" />
            </div>
            <p className="text-sm text-gray-500">Total Expenses</p>
          </div>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpense)}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${netProfit >= 0 ? "bg-blue-100" : "bg-orange-100"}`}>
              <DollarSign className={`h-4 w-4 ${netProfit >= 0 ? "text-blue-600" : "text-orange-500"}`} />
            </div>
            <p className="text-sm text-gray-500">Net Profit</p>
          </div>
          <p className={`text-2xl font-bold ${netProfit >= 0 ? "text-blue-700" : "text-orange-600"}`}>
            {netProfit < 0 ? "-" : ""}{formatCurrency(Math.abs(netProfit))}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-green-500" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-green-500" />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TransactionType | "")}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-green-500">
          <option value="">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        {(dateFrom || dateTo || typeFilter) && (
          <button type="button" onClick={() => { setDateFrom(""); setDateTo(""); setTypeFilter(""); }}
            className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
        )}
      </div>

      {/* Transactions list */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-2xl bg-gray-200" />)}
        </div>
      ) : transactions.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-200">
          <p className="text-gray-400 text-sm">No transactions yet. Add your first transaction to get started.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes / Ref</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Amount</th>
                <th className="px-5 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50 group">
                  <td className="px-5 py-3 text-gray-600">{formatDate(tx.transactionDate)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        tx.type === "income" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}>
                        {tx.type === "income" ? "+" : "−"} {CATEGORY_LABELS[tx.category] ?? tx.category}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-500">
                    <span className="block truncate max-w-xs">{tx.notes ?? tx.reference ?? "—"}</span>
                  </td>
                  <td className={`px-5 py-3 text-right font-semibold ${
                    tx.type === "income" ? "text-green-700" : "text-red-600"
                  }`}>
                    {tx.type === "income" ? "+" : "−"}{formatCurrency(tx.amount)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => openEdit(tx)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDeleteTx(tx); setServerError(""); }}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Transaction Modal */}
      <Modal open={showAdd} onClose={() => { setShowAdd(false); resetAdd({ type: "expense", category: "other" }); setServerError(""); }} title="Add Transaction">
        <form onSubmit={hsAdd((d) => addMutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Type *</label>
              <select {...regAdd("type")} className={INPUT}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Category *</label>
              <select {...regAdd("category")} className={INPUT}>
                {availableCategoriesAdd.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Amount *</label>
              <input type="number" step="0.01" min="0.01" {...regAdd("amount")} className={INPUT} />
              {errAdd.amount && <p className="mt-1 text-xs text-red-600">{errAdd.amount.message}</p>}
            </div>
            <div>
              <label className={LABEL}>Date *</label>
              <input type="date" {...regAdd("transactionDate")} defaultValue={new Date().toISOString().slice(0, 10)} className={INPUT} />
              {errAdd.transactionDate && <p className="mt-1 text-xs text-red-600">{errAdd.transactionDate.message}</p>}
            </div>
          </div>
          <div>
            <label className={LABEL}>Notes</label>
            <input {...regAdd("notes")} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Reference (invoice / receipt #)</label>
            <input {...regAdd("reference")} className={INPUT} />
          </div>
          {serverError && <p className="text-xs text-red-600">{serverError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setShowAdd(false); resetAdd({ type: "expense", category: "other" }); setServerError(""); }}
              className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={subAdd}
              className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {subAdd ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Transaction Modal */}
      <Modal open={!!editTx} onClose={() => { setEditTx(null); setServerError(""); }} title="Edit Transaction">
        <form onSubmit={hsEdit((d) => editMutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Type *</label>
              <select {...regEdit("type")} className={INPUT}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Category *</label>
              <select {...regEdit("category")} className={INPUT}>
                {availableCategoriesEdit.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Amount *</label>
              <input type="number" step="0.01" min="0.01" {...regEdit("amount")} className={INPUT} />
              {errEdit.amount && <p className="mt-1 text-xs text-red-600">{errEdit.amount.message}</p>}
            </div>
            <div>
              <label className={LABEL}>Date *</label>
              <input type="date" {...regEdit("transactionDate")} className={INPUT} />
              {errEdit.transactionDate && <p className="mt-1 text-xs text-red-600">{errEdit.transactionDate.message}</p>}
            </div>
          </div>
          <div>
            <label className={LABEL}>Notes</label>
            <input {...regEdit("notes")} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Reference (invoice / receipt #)</label>
            <input {...regEdit("reference")} className={INPUT} />
          </div>
          {serverError && <p className="text-xs text-red-600">{serverError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setEditTx(null); setServerError(""); }}
              className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={subEdit}
              className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {subEdit ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={!!deleteTx} onClose={() => setDeleteTx(null)} title="Delete Transaction">
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete this transaction? This cannot be undone.
        </p>
        {serverError && <p className="mb-4 text-xs text-red-600">{serverError}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={() => setDeleteTx(null)} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button
            type="button"
            onClick={() => deleteMutation.mutate(deleteTx!.id)}
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
