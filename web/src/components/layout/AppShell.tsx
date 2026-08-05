"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  LayoutDashboard,
  Building2,
  Bird,
  Wheat,
  BarChart3,
} from "lucide-react";
import { Sidebar } from "./Sidebar";
import { NotificationBell } from "./NotificationBell";
import { LanguagePill } from "./LanguagePill";
import { cn } from "@/lib/utils";

const MOBILE_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/farms", label: "Farms", icon: Building2 },
  { href: "/flocks", label: "Flocks", icon: Bird },
  { href: "/feed", label: "Feed", icon: Wheat },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-2 py-2 backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1">
        {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium transition-colors",
                active ? "bg-green-50 text-green-700" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <div className="hidden h-screen shrink-0 lg:block">
        <Sidebar className="h-screen border-r border-gray-800" />
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Close navigation drawer"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative h-full w-[18.5rem] max-w-[88vw]">
            <Sidebar className="h-full w-full shadow-2xl" onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-3 sm:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 lg:hidden"
              aria-label="Open navigation drawer"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 lg:hidden">
              <Bird className="h-4 w-4 text-green-600" />
              <span className="text-sm font-semibold text-gray-800">MyPoultryManager</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <LanguagePill />
            </div>
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8 lg:pb-8">{children}</main>
      </div>

      <BottomNav />
    </div>
  );
}
