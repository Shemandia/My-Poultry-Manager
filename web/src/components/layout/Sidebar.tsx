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
import { api } from "@/lib/api";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/farms", label: "Farms", icon: Building2 },
  { href: "/flocks", label: "Flocks", icon: Bird },
  { href: "/livestock", label: "Livestock", icon: PawPrint },
  { href: "/feed", label: "Feed", icon: Wheat },
  { href: "/finance", label: "Finance", icon: DollarSign },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, refreshToken } = useAuthStore();

  const isOwnerOrManager = user?.role === "owner" || user?.role === "farm_manager";

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        await api.post("/api/v1/auth/logout", { refreshToken });
      }
    } catch {
      // ignore — we still log out locally
    }
    logout();
    router.push("/login");
  };

  return (
    <aside className="flex h-screen w-60 flex-col bg-gray-900 text-white">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 px-6 border-b border-gray-700">
        <Bird className="h-6 w-6 text-green-400" />
        <span className="font-semibold text-sm leading-tight">
          MyPoultry<br />
          <span className="text-green-400">Manager</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-green-600 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
        {isOwnerOrManager && (
          <Link
            href="/users"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              pathname === "/users"
                ? "bg-green-600 text-white"
                : "text-gray-300 hover:bg-gray-800 hover:text-white"
            )}
          >
            <Users className="h-4 w-4" />
            Team
          </Link>
        )}
      </nav>

      {/* User + logout */}
      <div className="border-t border-gray-700 p-4">
        <div className="mb-3">
          <p className="text-xs font-medium text-white truncate">
            {user?.fullName ?? user?.email}
          </p>
          <p className="text-xs text-gray-400 capitalize">{user?.role?.replace("_", " ")}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
