import { useEffect, useState } from "react";
import { Recipe, RecipeDraft } from "../types/recipe";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import {
  uploadRecipePhoto,
  deleteRecipePhoto,
  isLocalPhoto,
} from "../lib/storage";
import { MOCK_RECIPES } from "./mockRecipes";

/**
 * A tiny observable repository for recipes.
 *
 * - When Supabase is NOT configured, it operates on an in-memory copy of the
 *   mock recipes (edits persist for the session so the app feels real).
 * - When Supabase IS configured, it reads/writes the `recipes` table.
 *
 * UI subscribes via the `useRecipes` / `useRecipe` hooks below.
 */

type Listener = () => void;

class RecipeStore {
  private recipes: Recipe[] = MOCK_RECIPES.map((r) => ({ ...r }));
  private listeners = new Set<Listener>();
  private loaded = false;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  getAll(): Recipe[] {
    return this.recipes;
  }

  getById(id: string): Recipe | undefined {
    return this.recipes.find((r) => r.id === id);
  }

  /** Whether the initial Supabase fetch has completed. */
  get isLoaded(): boolean {
    return this.loaded;
  }

  /** Recipes belonging to a given category (folder). */
  getByCategory(category: string): Recipe[] {
    return this.recipes.filter((r) => r.category === category);
  }

  /** Number of recipes in each category, keyed by category name. */
  countsByCategory(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const r of this.recipes) {
      const key = r.category || "";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }

  /** Fetch from Supabase (if configured). Safe to call repeatedly. */
  async load(force = false): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return; // mock mode: nothing to load
    if (this.loaded && !force) return;

    const { data, error } = await supabase
      .from("recipes")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      console.warn("Failed to load recipes from Supabase:", error.message);
      return;
    }

    this.recipes = (data ?? []).map(fromRow);
    this.loaded = true;
    this.emit();
  }

  /**
   * When Supabase is configured, upload any local (not-yet-uploaded) photo and
   * return a draft whose photoUrl is a public Storage URL. In demo mode the
   * local URI is kept as-is (persists for the session only).
   */
  private async withUploadedPhoto(draft: RecipeDraft): Promise<RecipeDraft> {
    if (isSupabaseConfigured && draft.photoUrl && isLocalPhoto(draft.photoUrl)) {
      const publicUrl = await uploadRecipePhoto(draft.photoUrl);
      return { ...draft, photoUrl: publicUrl };
    }
    return draft;
  }

  async create(draft: RecipeDraft): Promise<Recipe> {
    const now = new Date().toISOString();
    const prepared = await this.withUploadedPhoto(draft);

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from("recipes")
        .insert(toRow(prepared))
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      const recipe = fromRow(data);
      this.recipes = [recipe, ...this.recipes];
      this.emit();
      return recipe;
    }

    // mock mode
    const recipe: Recipe = {
      ...prepared,
      id: `local-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    this.recipes = [recipe, ...this.recipes];
    this.emit();
    return recipe;
  }

  async update(id: string, draft: RecipeDraft): Promise<Recipe> {
    const now = new Date().toISOString();
    const previousPhoto = this.getById(id)?.photoUrl ?? null;
    const prepared = await this.withUploadedPhoto(draft);

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from("recipes")
        .update({ ...toRow(prepared), updated_at: now })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      const updated = fromRow(data);
      this.recipes = this.recipes.map((r) => (r.id === id ? updated : r));
      this.emit();
      // Clean up the old photo if it was replaced.
      if (previousPhoto && previousPhoto !== updated.photoUrl) {
        void deleteRecipePhoto(previousPhoto);
      }
      return updated;
    }

    // mock mode
    const existing = this.getById(id);
    const updated: Recipe = {
      ...(existing as Recipe),
      ...prepared,
      id,
      updatedAt: now,
    };
    this.recipes = this.recipes.map((r) => (r.id === id ? updated : r));
    this.emit();
    return updated;
  }

  async remove(id: string): Promise<void> {
    const photo = this.getById(id)?.photoUrl ?? null;
    if (isSupabaseConfigured && supabase) {
      // `.select()` lets us see how many rows were actually deleted. If RLS
      // blocks the delete it returns 0 rows with no error, so we surface that.
      const { data, error } = await supabase
        .from("recipes")
        .delete()
        .eq("id", id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error(
          "Delete was blocked — make sure you're logged in as the owner."
        );
      }
      void deleteRecipePhoto(photo);
    }
    this.recipes = this.recipes.filter((r) => r.id !== id);
    this.emit();
  }
}

export const recipeStore = new RecipeStore();

// ---- Row <-> Recipe mapping (snake_case columns <-> camelCase model) ----

interface RecipeRow {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  photo_url: string | null;
  ingredients: string[] | null;
  steps: string[] | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

function fromRow(row: RecipeRow): Recipe {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    category: row.category ?? "",
    photoUrl: row.photo_url,
    ingredients: row.ingredients ?? [],
    steps: row.steps ?? [],
    tags: row.tags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(draft: RecipeDraft) {
  return {
    title: draft.title,
    description: draft.description,
    category: draft.category,
    photo_url: draft.photoUrl,
    ingredients: draft.ingredients,
    steps: draft.steps,
    tags: draft.tags,
  };
}

// ---- React hooks ----

export function useRecipes(): { recipes: Recipe[]; reload: () => void } {
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = recipeStore.subscribe(() => setTick((t) => t + 1));
    recipeStore.load();
    return unsub;
  }, []);

  return {
    recipes: recipeStore.getAll(),
    reload: () => recipeStore.load(true),
  };
}

export function useRecipe(id: string | undefined): {
  recipe: Recipe | undefined;
  loading: boolean;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = recipeStore.subscribe(() => setTick((t) => t + 1));
    // Ensure data is fetched even on a direct navigation / page refresh
    // straight to a recipe detail (not just via the home/category screens).
    recipeStore.load();
    return unsub;
  }, []);

  const recipe = id ? recipeStore.getById(id) : undefined;
  // In Supabase mode, we're "loading" until the first fetch completes.
  const loading = isSupabaseConfigured && !recipeStore.isLoaded;
  return { recipe, loading };
}
