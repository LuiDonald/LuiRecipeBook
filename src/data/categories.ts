// Canonical list of recipe categories ("folders"), mirroring the user's
// Google Drive structure. These always show on the home screen, even when
// empty — just like folders in Drive.

export interface Category {
  name: string;
  /** Emoji used as the folder icon. */
  icon: string;
}

export const CATEGORIES: Category[] = [
  { name: "Chicken", icon: "🍗" },
  { name: "Beef", icon: "🥩" },
  { name: "Pork", icon: "🥓" },
  { name: "Lamb", icon: "🍖" },
  { name: "Seafood", icon: "🦐" },
  { name: "Egg", icon: "🥚" },
  { name: "Veggie", icon: "🥦" },
  { name: "Soup", icon: "🍲" },
  { name: "Rice Bowl / Ramen / Noodle", icon: "🍜" },
  { name: "Dessert", icon: "🍰" },
  { name: "Drink", icon: "🥤" },
];

const ICON_BY_NAME = new Map(CATEGORIES.map((c) => [c.name, c.icon]));

/** Icon for a category name, with a sensible fallback for custom folders. */
export function iconForCategory(name: string): string {
  return ICON_BY_NAME.get(name) ?? "📁";
}

/** Category shown when a recipe has no category set. */
export const UNCATEGORIZED = "Uncategorized";
