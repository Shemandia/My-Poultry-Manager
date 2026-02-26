"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, AlertTriangle, AlertCircle, X } from "lucide-react";
import { api } from "@/lib/api";

interface Alert {
  type: string;
  severity: "warning" | "danger";
  title: string;
  message: string;
  relatedId: string;
  relatedType: string;
}

interface AlertsResponse {
  totalCount: number;
  alerts: Alert[];
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery<AlertsResponse>({
    queryKey: ["alerts"],
    queryFn: () => api.get("/api/v1/alerts").then((r) => r.data),
    refetchInterval: 5 * 60 * 1000, // refetch every 5 minutes
  });

  const count = data?.totalCount ?? 0;
  const alerts = data?.alerts ?? [];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white leading-none">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-2xl bg-white shadow-xl ring-1 ring-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">
              Alerts {count > 0 && <span className="ml-1 text-xs font-normal text-gray-500">({count})</span>}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <Bell className="h-8 w-8 text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">No active alerts.</p>
                <p className="text-xs text-gray-300 mt-1">All systems are looking good.</p>
              </div>
            ) : (
              alerts.map((alert, i) => (
                <div key={i} className="flex gap-3 px-4 py-3 hover:bg-gray-50">
                  <div className="mt-0.5 shrink-0">
                    {alert.severity === "danger" ? (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-900">{alert.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{alert.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
