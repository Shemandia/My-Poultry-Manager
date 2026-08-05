"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { api, extractError } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import type { Farm, FarmTask } from "@/types";

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
  title:           z.string().min(1, "Title is required"),
  description:     z.string().optional(),
  dueDate:         z.string().optional(),
  priority:        z.enum(["Low", "Medium", "High"]),
  notes:           z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const PRIORITY_COLORS: Record<string, string> = {
  High:   "bg-red-100 text-red-700",
  Medium: "bg-yellow-100 text-yellow-700",
  Low:    "bg-gray-100 text-gray-600",
};

const STATUS_COLORS: Record<string, string> = {
  Pending:    "bg-blue-100 text-blue-700",
  InProgress: "bg-orange-100 text-orange-700",
  Done:       "bg-green-100 text-green-700",
  Cancelled:  "bg-gray-100 text-gray-500",
};

const NEXT_STATUS: Record<string, string> = {
  Pending:    "InProgress",
  InProgress: "Done",
};

export default function FarmTasksPage() {
  const t  = useTranslations("tasks");
  const tc = useTranslations("common");

  const qc = useQueryClient();
  const { user } = useAuthStore();
  const canManage = user?.role === "owner" || user?.role === "farm_manager";

  const [farmId, setFarmId]         = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [showAdd, setShowAdd]       = useState(false);
  const [deleteTask, setDeleteTask] = useState<FarmTask | null>(null);
  const [serverError, setServerError] = useState("");

  const { data: farms = [] } = useQuery<Farm[]>({
    queryKey: ["farms"],
    queryFn: () => api.get("/api/v1/farms").then(r => r.data),
  });

  const { data: tasks = [], isLoading } = useQuery<FarmTask[]>({
    queryKey: ["farm-tasks", farmId, filterStatus, filterPriority],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (filterStatus)   params.status   = filterStatus;
      if (filterPriority) params.priority = filterPriority;
      return api.get(`/api/v1/farms/${farmId}/tasks`, { params }).then(r => r.data);
    },
    enabled: !!farmId,
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { priority: "Medium" } });

  const addMut = useMutation({
    mutationFn: (d: FormData) => api.post(`/api/v1/farms/${farmId}/tasks`, {
      title:       d.title,
      description: d.description || null,
      dueDate:     d.dueDate || null,
      priority:    d.priority,
      notes:       d.notes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["farm-tasks", farmId] });
      reset();
      setShowAdd(false);
      setServerError("");
    },
    onError: (err) => setServerError(extractError(err)),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/v1/tasks/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["farm-tasks", farmId] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/tasks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["farm-tasks", farmId] });
      setDeleteTask(null);
    },
  });

  const pending    = tasks.filter(t => t.status === "Pending").length;
  const inProgress = tasks.filter(t => t.status === "InProgress").length;
  const done       = tasks.filter(t => t.status === "Done").length;

  const NEXT_STATUS_LABEL: Record<string, string> = {
    Pending:    t("actions.start"),
    InProgress: t("actions.markDone"),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t("subtitle")}</p>
        </div>
        {farmId && canManage && (
          <button type="button" onClick={() => { setShowAdd(true); setServerError(""); }}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors">
            {t("addTask")}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="w-56">
          <label className={LABEL}>Farm</label>
          <select value={farmId} onChange={e => setFarmId(e.target.value)} className={INPUT}>
            <option value="">{t("chooseFarm")}</option>
            {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        {farmId && (
          <>
            <div className="w-40">
              <label className={LABEL}>{tc("status")}</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={INPUT}>
                <option value="">{t("allStatuses")}</option>
                <option value="Pending">{t("status.pending")}</option>
                <option value="InProgress">{t("status.inProgress")}</option>
                <option value="Done">{t("status.done")}</option>
                <option value="Cancelled">{t("status.cancelled")}</option>
              </select>
            </div>
            <div className="w-36">
              <label className={LABEL}>Priority</label>
              <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className={INPUT}>
                <option value="">{t("allPriorities")}</option>
                <option value="High">{t("priority.high")}</option>
                <option value="Medium">{t("priority.medium")}</option>
                <option value="Low">{t("priority.low")}</option>
              </select>
            </div>
          </>
        )}
      </div>

      {farmId && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 text-center">
              <p className="text-xs text-gray-500">{t("status.pending")}</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{pending}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 text-center">
              <p className="text-xs text-gray-500">{t("status.inProgress")}</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{inProgress}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 text-center">
              <p className="text-xs text-gray-500">{t("status.done")}</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{done}</p>
            </div>
          </div>

          {/* Task list */}
          {isLoading ? (
            <div className="animate-pulse h-20 rounded-xl bg-gray-200" />
          ) : tasks.length === 0 ? (
            <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-200">
              <p className="text-sm text-gray-400">{t("noTasks")}</p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 divide-y divide-gray-100">
              {tasks.map(task => {
                const isOverdue = task.dueDate && task.status !== "Done" && task.status !== "Cancelled" &&
                  new Date(task.dueDate) < new Date();
                const nextStatus = NEXT_STATUS[task.status];

                return (
                  <div key={task.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-medium ${task.status === "Done" ? "text-gray-400 line-through" : "text-gray-900"}`}>
                          {task.title}
                        </p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[task.priority] ?? "bg-gray-100 text-gray-600"}`}>
                          {task.priority}
                        </span>
                      </div>
                      {task.description && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{task.description}</p>
                      )}
                      {task.dueDate && (
                        <p className={`text-xs mt-0.5 ${isOverdue ? "text-red-500 font-medium" : "text-gray-400"}`}>
                          Due: {new Date(task.dueDate).toLocaleDateString()}{isOverdue ? ` — ${t("overdue")}` : ""}
                        </p>
                      )}
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0 ${STATUS_COLORS[task.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {task.status === "InProgress" ? t("status.inProgress") : task.status === "Pending" ? t("status.pending") : task.status === "Done" ? t("status.done") : t("status.cancelled")}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {nextStatus && (
                        <button
                          type="button"
                          onClick={() => statusMut.mutate({ id: task.id, status: nextStatus })}
                          disabled={statusMut.isPending}
                          className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                        >
                          {NEXT_STATUS_LABEL[task.status]}
                        </button>
                      )}
                      {canManage && task.status !== "Done" && task.status !== "Cancelled" && (
                        <button
                          type="button"
                          onClick={() => statusMut.mutate({ id: task.id, status: "Cancelled" })}
                          disabled={statusMut.isPending}
                          className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                        >
                          {t("actions.cancel")}
                        </button>
                      )}
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => setDeleteTask(task)}
                          className="rounded-lg px-2 py-1 text-xs text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Add Task Modal */}
      <Modal open={showAdd} onClose={() => { setShowAdd(false); reset(); setServerError(""); }} title={t("addTask")}>
        <form onSubmit={handleSubmit(d => addMut.mutate(d))} className="space-y-4">
          <div>
            <label className={LABEL}>{t("form.title")} *</label>
            <input {...register("title")} placeholder="e.g. Vaccinate calves" className={INPUT} />
            {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
          </div>
          <div>
            <label className={LABEL}>{t("form.description")}</label>
            <textarea {...register("description")} rows={2} className={INPUT + " resize-none"} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>{t("form.dueDate")}</label>
              <input type="date" {...register("dueDate")} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>{t("form.priority")}</label>
              <select {...register("priority")} className={INPUT}>
                <option value="Low">{t("priority.low")}</option>
                <option value="Medium">{t("priority.medium")}</option>
                <option value="High">{t("priority.high")}</option>
              </select>
            </div>
          </div>
          <div>
            <label className={LABEL}>{tc("notes")}</label>
            <textarea {...register("notes")} rows={2} className={INPUT + " resize-none"} />
          </div>
          {serverError && <p className="text-xs text-red-600">{serverError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setShowAdd(false); reset(); setServerError(""); }}
              className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              {tc("cancel")}
            </button>
            <button type="submit" disabled={isSubmitting}
              className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {isSubmitting ? tc("saving") : tc("save")}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={!!deleteTask} onClose={() => setDeleteTask(null)} title={tc("delete")}>
        <p className="text-sm text-gray-600 mb-6">
          Delete task <span className="font-semibold">{deleteTask?.title}</span>? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={() => setDeleteTask(null)}
            className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            {tc("cancel")}
          </button>
          <button
            type="button"
            onClick={() => deleteMut.mutate(deleteTask!.id)}
            disabled={deleteMut.isPending}
            className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleteMut.isPending ? tc("deleting") : tc("delete")}
          </button>
        </div>
      </Modal>
    </div>
  );
}
