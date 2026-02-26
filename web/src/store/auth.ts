"use client";

import { create } from "zustand";
import type { AuthUser } from "@/types";

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  initialized: boolean;
  initialize: () => void;
  login: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  initialized: false,

  initialize: () => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("access_token");
    const refresh = localStorage.getItem("refresh_token");
    const raw = localStorage.getItem("auth_user");
    const user = raw ? (JSON.parse(raw) as AuthUser) : null;
    set({ accessToken: token, refreshToken: refresh, user, initialized: true });
  },

  login: (user, accessToken, refreshToken) => {
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);
    localStorage.setItem("auth_user", JSON.stringify(user));
    set({ user, accessToken, refreshToken, initialized: true });
  },

  logout: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("auth_user");
    set({ user: null, accessToken: null, refreshToken: null });
  },
}));
