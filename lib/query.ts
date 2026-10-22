"use client";

import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
let query = "";
let loaded = false;

function emit() {
  listeners.forEach((listener) => listener());
}

function readLocationQuery() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("q") ?? "";
}

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  query = readLocationQuery();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSiteQuery() {
  return useSyncExternalStore(
    subscribe,
    () => {
      ensureLoaded();
      return query;
    },
    () => "",
  );
}

export function commitQuery(next: string, pathname: string) {
  query = next;
  loaded = true;
  emit();
  if (typeof window === "undefined") return;
  const base = pathname.startsWith("/posts/") ? "/" : pathname;
  const params = new URLSearchParams();
  if (next) params.set("q", next);
  const qs = params.toString();
  const url = qs ? `${base}?${qs}` : base;
  window.history.replaceState(null, "", url);
}

export function adoptQuery(next: string) {
  if (next === query) return;
  query = next;
  loaded = true;
  emit();
}
