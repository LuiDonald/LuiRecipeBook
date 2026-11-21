import { useEffect, useState } from "react";
import { loadRaw, saveRaw } from "../lib/deviceStorage";

/**
 * Favorites and "cooked on" history, saved per device (like the shopping list).
 *
 * Cooked dates are stored as local calendar days ("2026-11-20"), at most one
 * per recipe per day, newest last.
 */

const KEY = "kitchen-log-v1";

interface PersistShape {
  favorites: string[];
  cooked: Record<string, string[]>;
}

/** Today's local date as YYYY-MM-DD. */
export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "Today", "Yesterday", "3 days ago", or a short date like "Nov 2". */
export function describeDay(day: string, now = new Date()): string {
  const [y, m, d] = day.split("-").map(Number);
  const then = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((today.getTime() - then.getTime()) / 86_400_000);
  if (diff === 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff > 1 && diff < 7) return `${diff} days ago`;
  return then.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(then.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

type Listener = () => void;

class KitchenLogStore {
  private favorites: string[] = [];
  private cooked: Record<string, string[]> = {};
  private listeners = new Set<Listener>();
  private loading: Promise<void> | null = null;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    void this.hydrate();
    return () => this.listeners.delete(listener);
  }

  /**
   * Run a change only after saved data has loaded, so a write from a screen
   * that opened first (e.g. cook mode after a page reload) can't overwrite
   * the existing favorites and history.
   */
  private change(fn: () => void) {
    void this.hydrate().then(() => {
      fn();
      this.persist();
    });
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  private hydrate(): Promise<void> {
    this.loading ??= this.load();
    return this.loading;
  }

  private async load() {
    const raw = await loadRaw(KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<PersistShape>;
      this.favorites = Array.isArray(parsed.favorites) ? parsed.favorites : [];
      this.cooked = parsed.cooked && typeof parsed.cooked === "object" ? parsed.cooked : {};
      this.emit();
    } catch {
      /* ignore corrupt payload */
    }
  }

  private persist() {
    saveRaw(KEY, JSON.stringify({ favorites: this.favorites, cooked: this.cooked }));
    this.emit();
  }

  isFavorite(recipeId: string): boolean {
    return this.favorites.includes(recipeId);
  }

  toggleFavorite(recipeId: string) {
    this.change(() => {
      this.favorites = this.isFavorite(recipeId)
        ? this.favorites.filter((id) => id !== recipeId)
        : [...this.favorites, recipeId];
    });
  }

  /** Favorite recipe ids, most recently starred first. */
  getFavorites(): string[] {
    return [...this.favorites].reverse();
  }

  cookedDays(recipeId: string): string[] {
    return this.cooked[recipeId] ?? [];
  }

  lastCooked(recipeId: string): string | null {
    const days = this.cookedDays(recipeId);
    return days.length ? days[days.length - 1] : null;
  }

  cookedToday(recipeId: string): boolean {
    return this.lastCooked(recipeId) === todayKey();
  }

  /** Record that the recipe was made today (no-op if already logged today). */
  logCooked(recipeId: string) {
    this.change(() => {
      if (this.cookedToday(recipeId)) return;
      // Re-insert the key so object order tracks the latest cook (tie-break
      // for recipes cooked on the same day).
      const { [recipeId]: prev = [], ...rest } = this.cooked;
      this.cooked = { ...rest, [recipeId]: [...prev, todayKey()] };
    });
  }

  /** Undo today's entry (for a mistaken tap). */
  unlogToday(recipeId: string) {
    this.change(() => {
      if (!this.cookedToday(recipeId)) return;
      const days = this.cookedDays(recipeId).slice(0, -1);
      const next = { ...this.cooked };
      if (days.length) next[recipeId] = days;
      else delete next[recipeId];
      this.cooked = next;
    });
  }

  /** Recipe ids by most recent cook, newest first. */
  getRecentlyCooked(limit = 5): string[] {
    return Object.entries(this.cooked)
      .reverse() // newest-logged first, kept by the stable sort for same-day ties
      .filter(([, days]) => days.length > 0)
      .sort((a, b) => b[1][b[1].length - 1].localeCompare(a[1][a[1].length - 1]))
      .slice(0, limit)
      .map(([id]) => id);
  }
}

export const kitchenLog = new KitchenLogStore();

/** Re-renders the caller whenever favorites or cooked history change. */
export function useKitchenLog() {
  const [, setTick] = useState(0);
  useEffect(() => kitchenLog.subscribe(() => setTick((t) => t + 1)), []);
  return kitchenLog;
}
