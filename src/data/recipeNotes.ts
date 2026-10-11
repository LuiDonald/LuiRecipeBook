import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

/**
 * Cooking notes / refinement history attached to a recipe.
 *
 * These live in the `recipe_notes` table (see supabase/recipe_notes.sql) and are
 * append-only. Both the app (owner, when signed in) and the agent API write
 * here; everyone can read them (public-read RLS).
 */
export interface RecipeNote {
  id: string;
  recipeId: string;
  text: string;
  /** Who wrote it, e.g. "agent" or the owner's email. */
  author: string;
  createdAt: string;
}

interface NoteRow {
  id: string;
  recipe_id: string;
  text: string;
  author: string | null;
  created_at: string;
}

function fromRow(row: NoteRow): RecipeNote {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    text: row.text,
    author: row.author ?? "agent",
    createdAt: row.created_at,
  };
}

/** Fetch a recipe's notes, newest first. Returns [] in mock/no-Supabase mode. */
export async function fetchNotes(recipeId: string): Promise<RecipeNote[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from("recipe_notes")
    .select("*")
    .eq("recipe_id", recipeId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(fromRow);
}

/** Append a note. Requires the owner to be signed in (enforced by RLS). */
export async function addNote(
  recipeId: string,
  text: string,
  author: string
): Promise<RecipeNote> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured");
  }
  const { data, error } = await supabase
    .from("recipe_notes")
    .insert({ recipe_id: recipeId, text: text.trim(), author })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return fromRow(data);
}

/** Permanently delete a note. Requires the owner to be signed in (RLS). */
export async function deleteNote(noteId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured");
  }
  const { data, error } = await supabase
    .from("recipe_notes")
    .delete()
    .eq("id", noteId)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error(
      "Remove was blocked — make sure you're logged in as the owner."
    );
  }
}

/** Hook: load a recipe's notes and expose a refresh. */
export function useRecipeNotes(recipeId: string | undefined): {
  notes: RecipeNote[];
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [notes, setNotes] = useState<RecipeNote[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!recipeId) return;
    setLoading(true);
    try {
      setNotes(await fetchNotes(recipeId));
    } catch (e) {
      console.warn("Failed to load notes:", (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [recipeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { notes, loading, refresh };
}
