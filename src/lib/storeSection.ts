/**
 * Which part of the store an ingredient is in, so the shopping list can be
 * walked aisle by aisle. Works on the canonical names from ingredientKey().
 *
 * Rules are checked in order and the first match wins, so more specific rules
 * come first ("chicken broth" is a pantry item, not meat; "oyster sauce" is a
 * sauce, not seafood; "garlic powder" is a spice, not produce).
 *
 * Pure (no React Native imports) so it can be reused by scripts.
 */

export type StoreSection =
  | "Produce"
  | "Meat and poultry"
  | "Seafood"
  | "Eggs, dairy and tofu"
  | "Rice, noodles and bread"
  | "Sauces and condiments"
  | "Spices, oils and seasonings"
  | "Baking and dry goods"
  | "Wine and drinks"
  | "Other";

/** Display order on the shopping list (roughly a walk through the store). */
export const SECTION_ORDER: StoreSection[] = [
  "Produce",
  "Meat and poultry",
  "Seafood",
  "Eggs, dairy and tofu",
  "Rice, noodles and bread",
  "Sauces and condiments",
  "Spices, oils and seasonings",
  "Baking and dry goods",
  "Wine and drinks",
  "Other",
];

const w = (words: string) => new RegExp(`\\b(?:${words})\\b`);

const RULES: [StoreSection, RegExp][] = [
  // Exceptions whose names contain a word from a later rule.
  ["Produce", w("water chestnut|yukon gold")],
  ["Baking and dry goods", w("cornstarch water|baking powder|baking soda|gypsum|honey date|candied date")],
  ["Sauces and condiments", w("soy sauce water mix|bachan s")],

  // Things you don't buy, or don't buy as food.
  ["Other", w("water|ice|paper towel|plastic wrap|ziploc|egg water")],

  // Drinks and cooking alcohol (before "rice" and "sauce").
  ["Wine and drinks", w("wine|sake|brandy|whisky|whiskey|grand marnier|sprite|coca cola|cola|beer|coffee bean|tea leaf")],

  // Oils flavoured with something else stay with the condiments.
  ["Sauces and condiments", w("chili oil|garlic oil|garlic oil with garlic|fried garlic oil|mala chili oil")],

  // Stock, broth and bouillon (before meat: "chicken broth" isn't chicken).
  ["Baking and dry goods", w("broth|stock|bouillon|dashi|hondashi|bonito|katsuobushi|soup|cream chicken soup")],

  // Sauces, pastes and jars (before seafood: "oyster sauce", "shrimp paste").
  ["Sauces and condiments", w("sauce|paste|vinegar|ketchup|mayo|mayonnaise|miso|gochujang|doenjang|doubanjiang|sambal|sriracha|hoisin|mirin|mustard|wasabi|kecap manis|kecap mani|honey|peanut butter|fermented tofu|fermented red bean curd|ishiri|worcestershire|truffle|smoke|kimchi brine|preserved mustard|spicy hotpot base|salted fish")],

  // Seasonings and spices (before produce: "garlic powder", "chili flake").
  ["Spices, oils and seasonings", w("salt|pepper|peppercorn|powder|paprika|cumin|cinnamon|star anise|bay leaf|clove|cardamom|fennel seed|coriander seed|oregano|italian herb|italian seasoning|old bay|msg|seasoning|spice|gochugaru|chili flake|crushed red pepper|sesame seed|five spice|turmeric|shichimi|vanilla extract|shio kombu|spice fennel")],
  ["Spices, oils and seasonings", w("oil")],

  // Dry and canned goods.
  ["Baking and dry goods", w("sugar|flour|starch|cornstarch|cornstarch water|baking soda|baking powder|erythritol|gypsum|tangerine peel|goji berry|date|honey date|candied date|kelp|kombu|nori|seaweed|red bean|lotus seed|dang gui|dang shen|amomum|almond|canned|coconut milk|coconut cream|tomato paste|tomato puree|tomato purée|japanese curry|chestnut")],

  ["Seafood", w("shrimp|prawn|clam|scallop|fish|salmon|tuna|cod|sea bass|yellowtail|scad|crab|abalone|squid|oyster|mussel|lobster")],

  ["Meat and poultry", w("chicken|beef|pork|lamb|duck|steak|rib|ribs|bacon|pancetta|prosciutto|sausage|oxtail|tongue|tenderloin|sirloin|brisket|tendon|shank|jowl|chuck|patty|meat|bone|marrow|chuck roast")],

  ["Eggs, dairy and tofu", w("egg|yolk|butter|cream|cheese|parmesan|burrata|milk|tofu|bean curd|kimchi|cabbage kimchi")],

  ["Rice, noodles and bread", w("rice|noodle|pasta|spaghetti|linguine|fettuccine|tagliatelle|capellini|udon|soba|ramen|vermicelli|bread|bun|sourdough")],

  ["Produce", w("garlic|ginger|scallion|onion|shallot|leek|carrot|potato|tomato|cilantro|parsley|basil|thai basil|thyme|rosemary|lemongrass|lemon|lime|orange|apple|pear|fig|mushroom|celery|cabbage|bok choy|choy sum|daikon|radish|cucumber|eggplant|chili|chive|arugula|microgreen|asparagus|broccoli|squash|burdock|lotus root|bean sprout|melon|water chestnut|bamboo|herb|lettuce|spinach|corn|pepper")],
];

export function storeSection(key: string): StoreSection {
  const k = key.toLowerCase();
  for (const [section, re] of RULES) if (re.test(k)) return section;
  return "Other";
}
