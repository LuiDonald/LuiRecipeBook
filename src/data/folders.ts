import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { CATEGORIES, iconForCategory as canonicalIcon } from "./categories";

/**
 * Folders ("categories") as manageable records.
 *
 * - Supabase mode: reads/writes the `folders` table (see supabase/folders.sql).
 *   Create = upsert an active row. Delete = soft-delete (upsert a row whose
 *   `deleted_at` is set), so even data-derived folders can be hidden yet
 *   recovered later.
 * - Demo mode (no Supabase): operates on an in-memory copy of the canonical
 *   list so the app still feels real for the session.
 */

export interface Folder {
  name: string;
  icon: string;
  sortOrder: number;
  /** ISO timestamp when soft-deleted, or null if active. */
  deletedAt: string | null;
}

type Listener = () => void;

const DEFAULT_ICON = "📁";

function seedFolders(): Folder[] {
  return CATEGORIES.map((c, i) => ({
    name: c.name,
    icon: c.icon,
    sortOrder: (i + 1) * 10,
    deletedAt: null,
  }));
}

class FolderStore {
  private folders: Folder[] = seedFolders();
  private listeners = new Set<Listener>();
  private loaded = false;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  get isLoaded(): boolean {
    return this.loaded;
  }

  /** All managed folder rows (active + soft-deleted). */
  getAll(): Folder[] {
    return this.folders;
  }

  /** Active folders, sorted for display. */
  getActive(): Folder[] {
    return this.folders
      .filter((f) => !f.deletedAt)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  /** Every managed name (active or deleted) — used to suppress stale extras. */
  managedNames(): Set<string> {
    return new Set(this.folders.map((f) => f.name));
  }

  /** Icon for a folder name: managed row → canonical → generic fallback. */
  iconFor(name: string): string {
    const row = this.folders.find((f) => f.name === name);
    if (row) return row.icon;
    return canonicalIcon(name);
  }

  async load(force = false): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return; // demo mode
    if (this.loaded && !force) return;

    const { data, error } = await supabase
      .from("folders")
      .select("name, icon, sort_order, deleted_at");

    if (error) {
      console.warn("Failed to load folders:", error.message);
      return;
    }

    this.folders = (data ?? []).map((r: any) => ({
      name: r.name,
      icon: r.icon ?? DEFAULT_ICON,
      sortOrder: r.sort_order ?? 1000,
      deletedAt: r.deleted_at ?? null,
    }));
    this.loaded = true;
    this.emit();
  }

  /**
   * Create (or restore) a folder. Upserts an active row; if a soft-deleted row
   * with the same name exists it is reactivated.
   */
  async create(name: string, icon?: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Folder name can't be empty.");
    const useIcon = (icon ?? "").trim() || DEFAULT_ICON;

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from("folders")
        .upsert(
          { name: trimmed, icon: useIcon, sort_order: 1000, deleted_at: null },
          { onConflict: "name" }
        );
      if (error) throw new Error(error.message);
      await this.load(true);
      return;
    }

    // demo mode
    const existing = this.folders.find((f) => f.name === trimmed);
    if (existing) {
      existing.deletedAt = null;
      existing.icon = useIcon;
    } else {
      this.folders = [
        ...this.folders,
        { name: trimmed, icon: useIcon, sortOrder: 1000, deletedAt: null },
      ];
    }
    this.emit();
  }

  /** Soft-delete a folder by name (recoverable). */
  async remove(name: string): Promise<void> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      // Upsert a tombstone so even data-derived (unmanaged) folders can be
      // hidden. Only `name` + `deleted_at` are sent, so an existing row keeps
      // its icon/sort_order.
      const { data, error } = await supabase
        .from("folders")
        .upsert({ name, deleted_at: now }, { onConflict: "name" })
        .select("name");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error(
          "Delete was blocked — make sure you're logged in as the owner."
        );
      }
      await this.load(true);
      return;
    }

    // demo mode
    const existing = this.folders.find((f) => f.name === name);
    if (existing) {
      existing.deletedAt = now;
    } else {
      this.folders = [
        ...this.folders,
        { name, icon: DEFAULT_ICON, sortOrder: 1000, deletedAt: now },
      ];
    }
    this.emit();
  }
}

export const folderStore = new FolderStore();

/** Subscribe to the active folder list (re-renders on change). */
export function useFolders(): {
  folders: Folder[];
  managedNames: Set<string>;
  reload: () => void;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = folderStore.subscribe(() => setTick((t) => t + 1));
    folderStore.load();
    return unsub;
  }, []);

  return {
    folders: folderStore.getActive(),
    managedNames: folderStore.managedNames(),
    reload: () => folderStore.load(true),
  };
}
