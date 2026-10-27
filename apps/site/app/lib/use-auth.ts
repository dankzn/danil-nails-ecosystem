"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "./api-url";

export type AuthUser = {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  role: string;
};

type AuthState =
  | { status: "loading"; user: null }
  | { status: "signed-out"; user: null }
  | { status: "signed-in"; user: AuthUser };

export function useAuthStatus(): AuthState {
  const [state, setState] = useState<AuthState>({ status: "loading", user: null });

  useEffect(() => {
    let cancelled = false;

    fetch(`${apiUrl}/v1/auth/me`, { credentials: "include" })
      .then((response) => {
        if (cancelled) return;
        if (!response.ok) {
          setState({ status: "signed-out", user: null });
          return;
        }
        return response.json().then((data) => {
          if (cancelled) return;
          if (data?.user) {
            setState({ status: "signed-in", user: data.user });
          } else {
            setState({ status: "signed-out", user: null });
          }
        });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "signed-out", user: null });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
