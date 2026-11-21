/**
 * Reduce a free-text ingredient line to a canonical name so that lines naming
 * the same thing group together on the shopping list, e.g.
 *
 *   "2 cloves garlic, minced", "Sauce: garlic", "蒜頭 4粒", "蒜 garlic" -> "garlic"
 *   "Green onion", "spring onions", "青蔥 scallion"                      -> "scallion"
 *
 * The result doubles as the shopping-list label, so it stays readable English
 * where we can tell what the ingredient is.
 *
 * Pure (no React Native imports) so it can be reused by scripts.
 */

// Units / measures stripped from the name.
const UNIT_WORDS = new Set([
  "tbsp", "tbsps", "tbs", "tablespoon", "tablespoons", "tsp", "tsps", "tspn",
  "teaspoon", "teaspoons", "cup", "cups", "g", "gram", "grams", "kg", "kgs",
  "ml", "l", "oz", "ounce", "ounces", "lb", "lbs", "pound", "pounds", "clove",
  "cloves", "slice", "slices", "piece", "pieces", "can", "cans", "pack", "packs",
  "packet", "packets", "bunch", "bunches", "stalk", "stalks", "pinch", "pinches",
  "dash", "dashes", "handful", "handfuls", "sprig", "sprigs", "head", "heads",
  "sheet", "sheets", "cube", "cubes", "stick", "sticks", "bottle", "bottles",
  "jar", "jars", "bag", "bags", "box", "boxes", "inch", "inches", "cm", "knob",
  "knobs", "thumb", "size", "sized", "x", "part", "parts", "chunk", "chunks",
  "splash", "drizzle", "spoon", "spoons", "pc", "pcs", "catty",
]);

// Size / prep / filler words stripped from the name.
const FILLER_WORDS = new Set([
  "of", "a", "an", "the", "fresh", "freshly", "large", "small", "medium", "big",
  "to", "taste", "for", "finely", "thinly", "roughly", "coarsely", "coarse",
  "chopped", "minced", "sliced", "diced", "grated", "ground", "optional",
  "about", "approx", "approximately", "halved", "quartered", "peeled", "cooked",
  "raw", "dried", "whole", "ripe", "boneless", "skinless", "extra", "plus",
  "more", "or", "and", "into", "in", "some", "little", "lot", "lots", "bit",
  "tiny", "each", "if", "needed", "cut", "softened", "melted", "beaten",
  "shredded", "julienned",
]);

// Chinese ingredient names -> canonical English (longest match wins).
const CJK_NAMES: Record<string, string> = {
  "生食等級干貝": "scallop",
  "巴馬臣芝士刨片": "parmesan",
  "粗粒花生醬": "peanut butter",
  "忌廉雞湯": "cream of chicken soup",
  "無糖豆奶": "soy milk",
  "無糖豆漿": "soy milk",
  "粗磨黑胡椒": "black pepper",
  "日本醬油": "japanese soy sauce",
  "乾海帶": "kelp",
  "鰹魚粉": "bonito powder",
  "青蘿蔔": "green radish",
  "紅蘿蔔": "carrot",
  "車厘茄": "cherry tomato",
  "火箭菜": "arugula",
  "紹興酒": "shaoxing wine",
  "花生油": "peanut oil",
  "橄欖油": "olive oil",
  "沙嗲醬": "satay sauce",
  "花生醬": "peanut butter",
  "咖喱粉": "curry powder",
  "辣椒碎": "chili flake",
  "清雞湯": "chicken broth",
  "黑胡椒": "black pepper",
  "胡椒粉": "white pepper",
  "白芝麻": "sesame seed",
  "無鹽奶油": "unsalted butter",
  "生蛋黃": "egg yolk",
  "海帶": "kelp",
  "烏冬": "udon",
  "清酒": "sake",
  "清水": "water",
  "醬油": "soy sauce",
  "豉油": "soy sauce",
  "生抽": "light soy sauce",
  "老抽": "dark soy sauce",
  "牛油": "butter",
  "奶油": "butter",
  "蔥花": "scallion",
  "青蔥": "scallion",
  "乾蔥": "shallot",
  "干貝": "scallop",
  "銀芽": "bean sprout",
  "蒜蓉": "garlic",
  "蒜頭": "garlic",
  "砂糖": "sugar",
  "紅糖": "brown sugar",
  "冰糖": "rock sugar",
  "紹酒": "shaoxing wine",
  "料酒": "cooking wine",
  "米酒": "rice wine",
  "麻油": "sesame oil",
  "食油": "cooking oil",
  "豬骨": "pork bone",
  "蜜棗": "candied date",
  "生薑": "ginger",
  "薑蓉": "ginger",
  "姜片": "ginger",
  "陳皮": "dried tangerine peel",
  "白米": "rice",
  "牛扒": "steak",
  "黑醋": "black vinegar",
  "牛肉": "beef",
  "粟粉": "cornstarch",
  "生粉": "cornstarch",
  "雞湯": "chicken broth",
  "豆奶": "soy milk",
  "豆漿": "soy milk",
  "味醂": "mirin",
  "雞蛋": "egg",
  "蛋黃": "egg yolk",
  "蠔油": "oyster sauce",
  "椒鹽": "salt and pepper",
  "蜆": "clam",
  "水": "water",
  "鹽": "salt",
  "糖": "sugar",
  "油": "cooking oil",
  "蒜": "garlic",
  "蔥": "scallion",
  "薑": "ginger",
  "姜": "ginger",
  "橙": "orange",
  "蛋": "egg",
};
const CJK_KEYS = Object.keys(CJK_NAMES).sort((a, b) => b.length - a.length);

// Different English names for the same thing (applied to the whole name).
const SYNONYMS: Record<string, string> = {
  "green onion": "scallion",
  "spring onion": "scallion",
  "long green onion": "scallion",
  "corn starch": "cornstarch",
  "cornstarch slurry": "cornstarch",
  "corn starch water": "cornstarch",
  "light soy": "light soy sauce",
  "dark soy": "dark soy sauce",
  "thick soy sauce": "dark soy sauce",
  "hua diao wine": "shaoxing wine",
  "huadiao wine": "shaoxing wine",
  "shaoxing cooking wine": "shaoxing wine",
  "chinese cooking wine": "cooking wine",
  "oil": "cooking oil",
  "neutral oil": "cooking oil",
  "cooking neutral oil": "cooking oil",
  "vegetable oil": "cooking oil",
  "chicken stock": "chicken broth",
  "beef stock": "beef broth",
  "yellow onion": "onion",
  "white sesame": "sesame seed",
  "toasted sesame": "sesame seed",
  "white pepper powder": "white pepper",
  "salt pepper": "salt and pepper",
  "salt black pepper": "salt and pepper",
  "pepper flake": "chili flake",
  "red pepper flake": "chili flake",
  "egg yolk": "egg yolk",
};

// Single-word spelling variants.
const SPELLINGS: Record<string, string> = {
  chilli: "chili",
  chillies: "chili",
  chilies: "chili",
};

// Words that end in "s" but aren't plurals.
const NOT_PLURAL = new Set([
  "molasses", "hummus", "couscous", "asparagus", "citrus", "octopus", "swiss",
  "brussels", "series", "mayonnaise", "jus", "this", "ques",
]);

/** Light English singularization: "tomatoes" -> "tomato", "berries" -> "berry". */
function singular(t: string): string {
  if (t.length <= 3 || !t.endsWith("s") || NOT_PLURAL.has(t)) return t;
  if (t.endsWith("ss") || t.endsWith("us")) return t;
  if (t.endsWith("ies")) return t.slice(0, -3) + "y";
  if (t.endsWith("oes")) return t.slice(0, -2);
  if (t.endsWith("leaves")) return t.slice(0, -6) + "leaf";
  if (/(ch|sh|x)es$/.test(t)) return t.slice(0, -2);
  return t.slice(0, -1);
}

const HAS_CJK =/[㐀-鿿]/;
const HAS_LATIN_WORD = /[a-z]{2,}/i;

/** Map a Chinese-only line to an English name if we know it. */
function translateCjk(s: string): string | null {
  for (const k of CJK_KEYS) if (s.includes(k)) return CJK_NAMES[k];
  return null;
}

/** Strip CJK quantities / units so unknown Chinese names still group. */
function cjkName(s: string): string {
  return s
    .replace(/[（(][^）)]*[）)]/g, "")
    .split(/[，,]/)[0]
    .replace(/[0-9.\/]+\s*(ml|g|kg|l)?/gi, "")
    .replace(/約|少許|適量|另加|[一二三四五六七八九十兩半]/g, "")
    .replace(/大湯匙|湯匙|茶匙|毫升|小瓣|[杯個粒瓣片條塊隻扎磅克瓶包根顆]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

export function ingredientKey(text: string): string {
  let s = text.trim();

  // "Sauce: oyster sauce" / "For cooking: 1 tbsp oil" -> drop the section label.
  s = s.replace(/^\s*[^:：\d]{1,25}[:：]\s*(?=\S)/, "");

  // Chinese text: drop it when there's an English name too, otherwise translate.
  if (HAS_CJK.test(s)) {
    const stripUnits = (x: string) => x.replace(/\d\s*(ml|g|kg|cm|tbsp|tsp)\b/gi, "");
    const outsideParens = stripUnits(s.replace(/[（(][^）)]*[）)]/g, " "));
    const inParens = /[（(]([^）)]*[a-z]{2,}[^）)]*)[）)]/i.exec(s)?.[1];
    if (HAS_LATIN_WORD.test(outsideParens)) {
      // "蒜頭 / Garlic 2 spoons", "生抽 light soy sauce" -> keep the English.
      s = s
        .replace(/[㐀-鿿　-〿＀-￯]+/g, " ")
        .replace(/^([^a-z0-9]*?:)?[\s\/]+/i, "$1 ");
    } else {
      const en = translateCjk(cjkName(s)) ?? translateCjk(s);
      if (en) return en;
      // "松露醬 (Truffle sauce)" -> use the English in brackets.
      if (inParens) s = inParens;
      else {
        const name = cjkName(s);
        if (name) return name;
      }
    }
  }

  s = s.toLowerCase();
  s = s.split(",")[0]; // drop modifiers after a comma
  s = s.replace(/\([^)]*\)/g, " "); // drop parentheticals
  s = s.split(/\s+\/\s+|\s+or\s+/)[0]; // "A / B", "A or B" -> first option
  s = s.replace(/[0-9]+([\/.][0-9]+)?/g, " "); // numbers, decimals, fractions
  s = s.replace(/[½¼¾⅓⅔⅛⅜⅝⅞]/g, " "); // unicode fractions
  s = s.replace(/[^\p{L}\p{N}\s]/gu, " "); // punctuation -> space

  const tokens = s
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !UNIT_WORDS.has(t) && !FILLER_WORDS.has(t))
    .map((t) => SPELLINGS[t] ?? t)
    .map(singular);

  const key = tokens.join(" ").trim();
  if (!key) {
    // Only a quantity was outside the brackets, e.g. "5 slice 當歸 (dang gui)".
    const bracketed = /\(([^)]*[a-z]{2,}[^)]*)\)/i.exec(text)?.[1];
    if (bracketed && bracketed !== text) return ingredientKey(bracketed);
    return text.trim().toLowerCase();
  }
  return SYNONYMS[key] ?? key;
}
