import { useEffect, useState } from "react";
import { loadRaw, saveRaw } from "../lib/deviceStorage";

/**
 * A small, locally-persisted shopping list: a set of selected recipe ids plus
 * which ingredient lines have been checked off. Items are derived from the
 * recipe store at render time, so the list always reflects the latest recipes.
 *
 * Storage is per-device: localStorage on web, AsyncStorage on native.
 */

const KEY = "shopping-list-v1";

interface PersistShape {
  recipeIds: string[];
  checked: Record<string, boolean>;
}

/** Stable key for one ingredient line within a recipe. */
export function itemKey(recipeId: string, index: number): string {
  return `${recipeId}::${index}`;
}

export { ingredientKey } from "../lib/ingredientKey";

type Listener = () => void;

class ShoppingListStore {
  private recipeIds: string[] = [];
  private checked: Record<string, boolean> = {};
  private listeners = new Set<Listener>();
  private hydrated = false;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    void this.hydrate();
    return () => this.listeners.delete(listener);
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  private async hydrate() {
    if (this.hydrated) return;
    this.hydrated = true;
    const raw = await loadRaw(KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as PersistShape;
      this.recipeIds = Array.isArray(parsed.recipeIds) ? parsed.recipeIds : [];
      this.checked = parsed.checked ?? {};
      this.emit();
    } catch {
      /* ignore corrupt payload */
    }
  }

  private persist() {
    saveRaw(KEY, JSON.stringify({ recipeIds: this.recipeIds, checked: this.checked }));
  }

  getRecipeIds(): string[] {
    return this.recipeIds;
  }

  has(recipeId: string): boolean {
    return this.recipeIds.includes(recipeId);
  }

  isChecked(key: string): boolean {
    return !!this.checked[key];
  }

  addRecipe(recipeId: string) {
    if (this.recipeIds.includes(recipeId)) return;
    this.recipeIds = [...this.recipeIds, recipeId];
    this.persist();
    this.emit();
  }

  toggleRecipe(recipeId: string) {
    if (this.has(recipeId)) this.removeRecipe(recipeId);
    else this.addRecipe(recipeId);
  }

  removeRecipe(recipeId: string) {
    this.recipeIds = this.recipeIds.filter((id) => id !== recipeId);
    const prefix = `${recipeId}::`;
    this.checked = Object.fromEntries(
      Object.entries(this.checked).filter(([k]) => !k.startsWith(prefix))
    );
    this.persist();
    this.emit();
  }

  clear() {
    this.recipeIds = [];
    this.checked = {};
    this.persist();
    this.emit();
  }

  toggleItem(key: string) {
    this.checked = { ...this.checked, [key]: !this.checked[key] };
    this.persist();
    this.emit();
  }

  /** Set several item keys to a value at once (used for grouped items). */
  setItems(keys: string[], value: boolean) {
    const next = { ...this.checked };
    for (const k of keys) next[k] = value;
    this.checked = next;
    this.persist();
    this.emit();
  }
}

export const shoppingList = new ShoppingListStore();

/** Re-renders the caller whenever the shopping list changes. */
export function useShoppingList() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const unsub = shoppingList.subscribe(() => setTick((t) => t + 1));
    return unsub;
  }, []);
  return shoppingList;
}
