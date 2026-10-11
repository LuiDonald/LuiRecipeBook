import { useEffect, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

// Units / filler words stripped when grouping "similar" ingredients together.
const UNIT_WORDS = new Set([
  "tbsp", "tbsps", "tablespoon", "tablespoons", "tsp", "tsps", "teaspoon",
  "teaspoons", "cup", "cups", "g", "gram", "grams", "kg", "kgs", "ml", "l",
  "oz", "ounce", "ounces", "lb", "lbs", "pound", "pounds", "clove", "cloves",
  "slice", "slices", "piece", "pieces", "can", "cans", "pack", "packs",
  "packet", "packets", "bunch", "bunches", "stalk", "stalks", "pinch",
  "pinches", "dash", "dashes", "handful", "handfuls", "sprig", "sprigs",
  "head", "heads", "sheet", "sheets", "cube", "cubes", "stick", "sticks",
  "bottle", "bottles", "jar", "jars", "bag", "bags", "box", "boxes",
]);

const FILLER_WORDS = new Set([
  "of", "a", "an", "the", "fresh", "large", "small", "medium", "to", "taste",
  "for", "finely", "roughly", "coarsely", "chopped", "minced", "sliced",
  "diced", "grated", "ground", "optional", "about", "approx", "approximately",
  "halved", "quartered", "peeled", "cooked", "raw", "dried", "whole", "ripe",
  "boneless", "skinless", "extra", "plus", "more", "or", "and", "into",
]);

/**
 * Reduce an ingredient line to a canonical key so similar lines group together.
 * Strips quantities, units, and common prep words, then lightly singularizes.
 * e.g. "2 cloves garlic, minced" and "1 clove of Garlic" -> "garlic".
 * Falls back to the trimmed lowercase line if nothing recognizable remains.
 */
export function ingredientKey(text: string): string {
  let s = text.toLowerCase().trim();
  s = s.split(",")[0]; // drop modifiers after a comma
  s = s.replace(/\([^)]*\)/g, " "); // drop parentheticals
  s = s.replace(/[0-9]+([\/.][0-9]+)?/g, " "); // numbers, decimals, fractions
  s = s.replace(/[½¼¾⅓⅔⅛⅜⅝⅞]/g, " "); // unicode fractions
  s = s.replace(/[^\p{L}\p{N}\s]/gu, " "); // punctuation -> space (keeps CJK)

  const tokens = s
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !UNIT_WORDS.has(t) && !FILLER_WORDS.has(t))
    .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t));

  const key = tokens.join(" ").trim();
  return key || text.trim().toLowerCase();
}

async function loadRaw(): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    } catch {
      return null;
    }
  }
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function saveRaw(value: string): void {
  if (Platform.OS === "web") {
    try {
      localStorage.setItem(KEY, value);
    } catch {
      /* ignore quota / unavailable */
    }
    return;
  }
  void AsyncStorage.setItem(KEY, value).catch(() => {});
}

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
    const raw = await loadRaw();
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
    saveRaw(JSON.stringify({ recipeIds: this.recipeIds, checked: this.checked }));
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
