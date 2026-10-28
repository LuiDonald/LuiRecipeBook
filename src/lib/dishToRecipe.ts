import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { supabase, isSupabaseConfigured } from "./supabase";
import type { ParsedRecipe } from "./parseRecipe";

/**
 * Reverse-engineer a recipe from photos of a finished dish + an optional
 * description, via the `dish-to-recipe` Edge Function (GPT-4o vision).
 * Requires the owner to be signed in (the function rejects everyone else).
 */

function mimeFromUri(uri: string): string {
  const ext = (/\.(\w+)(?:\?.*)?$/.exec(uri)?.[1] ?? "jpg").toLowerCase();
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    heic: "image/heic",
  };
  return map[ext] ?? "image/jpeg";
}

/** Convert a local/web image URI into a base64 `data:` URL the API can read. */
async function toDataUrl(uri: string): Promise<string> {
  // Already a usable URL (remote https or an existing data URL).
  if (/^data:image\//i.test(uri) || /^https?:\/\//i.test(uri)) return uri;

  if (Platform.OS === "web") {
    const res = await fetch(uri);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Could not read image"));
      reader.readAsDataURL(blob);
    });
  }

  // Native: read the file as base64 and prefix with its mime type.
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:${mimeFromUri(uri)};base64,${base64}`;
}

export async function reverseEngineerRecipe(
  imageUris: string[],
  description: string
): Promise<ParsedRecipe> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured");
  }
  if (!imageUris.length) throw new Error("Add at least one photo");

  const images = await Promise.all(imageUris.map(toDataUrl));

  const { data, error } = await supabase.functions.invoke("dish-to-recipe", {
    body: { images, description: description.trim() },
  });

  if (error) {
    let message = error.message ?? "Analysis failed";
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
  if (!recipe) throw new Error("No recipe came back");

  return {
    title: typeof recipe.title === "string" ? recipe.title : "",
    description: typeof recipe.description === "string" ? recipe.description : "",
    ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
    steps: Array.isArray(recipe.steps) ? recipe.steps : [],
    tags: Array.isArray(recipe.tags) ? recipe.tags : [],
    category: typeof recipe.category === "string" ? recipe.category : "",
  };
}
