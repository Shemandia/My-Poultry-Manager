"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserPlus, Shield, Trash2, UserX } from "lucide-react";
import { api, extractError } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import type { TenantUser, UserRole } from "@/types";

const ROLES: { value: UserRole; label: string }[] = [
  { value: "farm_manager", label: "Farm Manager" },
  { value: "supervisor", label: "Supervisor" },
  { value: "worker", label: "Worker" },
  { value: "vet", label: "Vet" },
  { value: "accountant", label: "Accountant" },
];

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  farm_manager: "Farm Manager",
  supervisor: "Supervisor",
  worker: "Worker",
  vet: "Vet",
  accountant: "Accountant",
};

const inviteSchema = z.object({
  email: z.string().email("Invalid email"),
  fullName: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["farm_manager", "supervisor", "worker", "vet", "accountant"]),
});
type InviteFormData = z.infer<typeof inviteSchema>;

const roleSchema = z.object({
  role: z.enum(["farm_manager", "supervisor", "worker", "vet", "accountant"]),
});
type RoleFormData = z.infer<typeof roleSchema>;

function Modal({ open, onClose, title, children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
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

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    owner: "bg-purple-100 text-purple-700",
    farm_manager: "bg-blue-100 text-blue-700",
    supervisor: "bg-cyan-100 text-cyan-700",
    worker: "bg-gray-100 text-gray-700",
    vet: "bg-green-100 text-green-700",
    accountant: "bg-amber-100 text-amber-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[role] ?? "bg-gray-100 text-gray-700"}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

export default function UsersPage() {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const isOwner = currentUser?.role === "owner";

  const [showInvite, setShowInvite] = useState(false);
  const [roleTarget, setRoleTarget] = useState<TenantUser | null>(null);
  const [inviteError, setInviteError] = useState("");
  const [roleError, setRoleError] = useState("");

  const { data: users = [], isLoading } = useQuery<TenantUser[]>({
    queryKey: ["users"],
    queryFn: () => api.get("/api/v1/users").then((r) => r.data),
  });

  // ── Invite form ────────────────────────────────────────────────────────────
  const inviteForm = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: "worker" },
  });

  const inviteMutation = useMutation({
    mutationFn: (data: InviteFormData) =>
      api.post("/api/v1/users", {
        email: data.email,
        password: data.password,
        role: data.role,
        fullName: data.fullName || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      inviteForm.reset({ role: "worker" });
      setShowInvite(false);
      setInviteError("");
    },
    onError: (err) => setInviteError(extractError(err)),
  });

  // ── Role change form ───────────────────────────────────────────────────────
  const roleForm = useForm<RoleFormData>({ resolver: zodResolver(roleSchema) });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      api.put(`/api/v1/users/${id}/role`, { role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setRoleTarget(null);
      setRoleError("");
    },
    onError: (err) => setRoleError(extractError(err)),
  });

  // ── Deactivate ─────────────────────────────────────────────────────────────
  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const openRoleModal = (user: TenantUser) => {
    setRoleTarget(user);
    setRoleError("");
    roleForm.setValue("role", user.role === "owner" ? "farm_manager" : user.role);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-sm text-gray-500 mt-1">
            {users.length} member{users.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isOwner && (
          <button
            onClick={() => { setShowInvite(true); setInviteError(""); }}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
          >
            <UserPlus className="h-4 w-4" /> Invite User
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-gray-200" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-200">
          <p className="text-gray-400 text-sm">No team members found.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
                {isOwner && (
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => {
                const isSelf = user.id === currentUser?.id;
                return (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 text-xs font-bold uppercase">
                          {(user.fullName ?? user.email)[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {user.fullName ?? <span className="text-gray-400 italic">—</span>}
                            {isSelf && (
                              <span className="ml-2 text-xs text-gray-400">(you)</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-400">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${user.isActive ? "text-green-600" : "text-gray-400"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${user.isActive ? "bg-green-500" : "bg-gray-300"}`} />
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-500">{formatDate(user.createdAt)}</td>
                    {isOwner && (
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {user.role !== "owner" && (
                            <button
                              onClick={() => openRoleModal(user)}
                              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Change role"
                            >
                              <Shield className="h-3.5 w-3.5" /> Role
                            </button>
                          )}
                          {!isSelf && user.role !== "owner" && user.isActive && (
                            <button
                              onClick={() => {
                                if (confirm(`Deactivate ${user.fullName ?? user.email}?`)) {
                                  deactivateMutation.mutate(user.id);
                                }
                              }}
                              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
                              title="Deactivate user"
                            >
                              <UserX className="h-3.5 w-3.5" /> Deactivate
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Invite Modal ─────────────────────────────────────────────────── */}
      <Modal open={showInvite} onClose={() => { setShowInvite(false); inviteForm.reset({ role: "worker" }); setInviteError(""); }} title="Invite Team Member">
        <form
          onSubmit={inviteForm.handleSubmit((d) => inviteMutation.mutate(d))}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              type="email"
              {...inviteForm.register("email")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
            />
            {inviteForm.formState.errors.email && (
              <p className="mt-1 text-xs text-red-600">{inviteForm.formState.errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
            <input
              {...inviteForm.register("fullName")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Temporary password *</label>
            <input
              type="password"
              {...inviteForm.register("password")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
            />
            {inviteForm.formState.errors.password && (
              <p className="mt-1 text-xs text-red-600">{inviteForm.formState.errors.password.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
            <select
              {...inviteForm.register("role")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {inviteError && (
            <p className="text-xs text-red-600">{inviteError}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setShowInvite(false); inviteForm.reset({ role: "worker" }); setInviteError(""); }}
              className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={inviteForm.formState.isSubmitting}
              className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {inviteForm.formState.isSubmitting ? "Inviting…" : "Invite"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Change Role Modal ─────────────────────────────────────────────── */}
      <Modal
        open={roleTarget !== null}
        onClose={() => { setRoleTarget(null); setRoleError(""); }}
        title={`Change role — ${roleTarget?.fullName ?? roleTarget?.email}`}
      >
        <form
          onSubmit={roleForm.handleSubmit((d) =>
            roleMutation.mutate({ id: roleTarget!.id, role: d.role })
          )}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New role</label>
            <select
              {...roleForm.register("role")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {roleError && <p className="text-xs text-red-600">{roleError}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setRoleTarget(null); setRoleError(""); }}
              className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={roleForm.formState.isSubmitting}
              className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {roleForm.formState.isSubmitting ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
