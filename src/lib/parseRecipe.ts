import { supabase, isSupabaseConfigured } from "./supabase";
import { RecipeDraft } from "../types/recipe";

/** The subset of a recipe the parser returns. */
export type ParsedRecipe = Pick<
  RecipeDraft,
  "title" | "description" | "ingredients" | "steps" | "tags" | "category"
>;

/**
 * Send pasted free-form text (a recipe, notes, or an Instagram caption) to the
 * `parse-recipe` Edge Function and get back a structured recipe. Requires the
 * owner to be signed in (the function rejects everyone else).
 */
export async function parseRecipeText(text: string): Promise<ParsedRecipe> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured");
  }
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Nothing to parse");

  const { data, error } = await supabase.functions.invoke("parse-recipe", {
    body: { text: trimmed },
  });

  if (error) {
    // Supabase wraps non-2xx responses in a FunctionsHttpError; surface the
    // function's JSON error message when we can read it.
    let message = error.message ?? "Parsing failed";
    try {
      const ctx = (error as any).context;
      if (ctx && typeof ctx.json === "function") {
        const body = await ctx.json();
        if (body?.error) message = body.error;
      }
    } catch {
      // ignore — fall back to the generic message
    }
    throw new Error(message);
  }

  const recipe = (data as any)?.recipe;
  if (!recipe) throw new Error("Parser returned no recipe");

  return {
    title: typeof recipe.title === "string" ? recipe.title : "",
    description: typeof recipe.description === "string" ? recipe.description : "",
    ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
    steps: Array.isArray(recipe.steps) ? recipe.steps : [],
    tags: Array.isArray(recipe.tags) ? recipe.tags : [],
    category: typeof recipe.category === "string" ? recipe.category : "",
  };
}
