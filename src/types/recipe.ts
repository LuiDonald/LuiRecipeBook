// Core data model for a recipe.
// This shape maps 1:1 to the `recipes` table in Supabase (see supabase/schema.sql).

export interface Recipe {
  id: string;
  title: string;
  description: string;
  /** The folder / category this recipe belongs to (e.g. "Chicken"). */
  category: string;
  /** Public URL (Supabase Storage) or a local/remote image URI. */
  photoUrl: string | null;
  ingredients: string[];
  steps: string[];
  tags: string[];
  /**
   * "published" (visible everywhere) or "pending" (an agent submission awaiting
   * the owner's review). Owner-created recipes are published immediately.
   * Absent in demo/mock data (treated as published).
   */
  status?: "published" | "pending";
  /** ISO timestamp. */
  createdAt: string;
  updatedAt: string;
}

/** Fields the user can edit in the create/edit form. */
export type RecipeDraft = Omit<Recipe, "id" | "createdAt" | "updatedAt">;

export function emptyDraft(category = ""): RecipeDraft {
  return {
    title: "",
    description: "",
    category,
    photoUrl: null,
    ingredients: [],
    steps: [],
    tags: [],
  };
}
