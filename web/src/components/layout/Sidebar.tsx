"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Bird,
  Wheat,
  BarChart3,
  DollarSign,
  Users,
  LogOut,
  PawPrint,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { useLanguageStore } from "@/store/language";
import { api } from "@/lib/api";
import { useTranslations } from "next-intl";

type SidebarProps = {
  className?: string;
  onNavigate?: () => void;
};

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, refreshToken } = useAuthStore();
  const { locale, setLocale } = useLanguageStore();
  const t = useTranslations("nav");

  const isOwnerOrManager = user?.role === "owner" || user?.role === "farm_manager";

  const navItems = [
    { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/farms", label: t("farms"), icon: Building2 },
    { href: "/flocks", label: t("flocks"), icon: Bird },
    { href: "/livestock", label: t("livestock"), icon: PawPrint },
    { href: "/feed", label: t("feed"), icon: Wheat },
    { href: "/finance", label: t("finance"), icon: DollarSign },
    { href: "/reports", label: t("reports"), icon: BarChart3 },
  ];

  const LIVESTOCK_SUBNAV = [
    { href: "/livestock", label: t("livestock_species") },
    { href: "/livestock/reports", label: t("livestock_reports") },
    { href: "/livestock/breeding", label: t("livestock_breeding") },
    { href: "/livestock/milk", label: t("livestock_milk") },
    { href: "/livestock/transactions", label: t("livestock_transactions") },
    { href: "/livestock/tasks", label: t("livestock_tasks") },
    { href: "/livestock/events", label: t("livestock_events") },
  ];

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        await api.post("/api/v1/auth/logout", { refreshToken });
      }
    } catch {
      // Ignore API failure and continue local logout.
    }
    logout();
    onNavigate?.();
    router.push("/login");
  };

  return (
    <aside className={cn("flex h-full w-60 flex-col bg-gray-900 text-white", className)}>
      <div className="flex h-16 items-center gap-2 border-b border-gray-700 px-6">
        <Bird className="h-6 w-6 text-green-400" />
        <span className="text-sm font-semibold leading-tight">
          MyPoultry
          <br />
          <span className="text-green-400">Manager</span>
        </span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isLivestock = href === "/livestock";
          const livestockExpanded = isLivestock && pathname.startsWith("/livestock");
          const active = isLivestock
            ? pathname === "/livestock"
            : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <div key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-green-600 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>

              {livestockExpanded && (
                <div className="ml-3 mt-0.5 space-y-0.5">
                  {LIVESTOCK_SUBNAV.map((sub) => {
                    const subActive =
                      sub.href === "/livestock"
                        ? pathname === "/livestock"
                        : pathname === sub.href || pathname.startsWith(`${sub.href}/`);

                    return (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        onClick={onNavigate}
                        className={cn(
                          "block rounded-lg py-1.5 pl-5 pr-3 text-xs font-medium transition-colors",
                          subActive
                            ? "bg-green-600/25 text-green-300"
                            : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                        )}
                      >
                        {sub.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {isOwnerOrManager && (
          <Link
            href="/users"
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              pathname === "/users"
                ? "bg-green-600 text-white"
                : "text-gray-300 hover:bg-gray-800 hover:text-white"
            )}
          >
            <Users className="h-4 w-4" />
            {t("team")}
          </Link>
        )}
      </nav>

      <div className="border-t border-gray-700 p-4">
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLocale("en")}
            className={cn(
              "flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors",
              locale === "en" ? "bg-green-600 text-white" : "text-gray-400 hover:text-gray-200"
            )}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLocale("sw")}
            className={cn(
              "flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors",
              locale === "sw" ? "bg-green-600 text-white" : "text-gray-400 hover:text-gray-200"
            )}
          >
            Swahili
          </button>
        </div>

        <div className="mb-3">
          <p className="truncate text-xs font-medium text-white">{user?.fullName ?? user?.email}</p>
          <p className="text-xs capitalize text-gray-400">{user?.role?.replace("_", " ")}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          {t("signOut")}
        </button>
      </div>
    </aside>
  );
}
