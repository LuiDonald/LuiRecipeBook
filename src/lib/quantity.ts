/**
 * Read, scale, and add up the amount at the start of an ingredient line.
 *
 *   parseAmount("Sauce: 1 1/2 tbsp soy sauce") -> { qty: 1.5, unit: "tbsp", ... }
 *   scaleLine("2 chicken thighs (450 g)", 2)    -> "4 chicken thighs (900 g)"
 *   totalAmount(["1 tbsp soy sauce", "2 tsp soy sauce"]) -> "1 2/3 tbsp"
 *
 * Works on the standard ingredient style ("<amount> <unit> <name>, <prep>").
 * Lines it can't read are left alone (scaled lines come back unchanged).
 *
 * Pure (no React Native imports) so it can be reused by scripts.
 */

export interface Amount {
  /** Text before the amount, e.g. "Sauce: ". */
  prefix: string;
  qty: number;
  /** Upper end of a range like "1-2 tbsp". */
  qtyMax?: number;
  /** Canonical unit ("tbsp", "g", "clove", ...) or "" for a plain count. */
  unit: string;
  /** Everything after the amount and unit. */
  rest: string;
}

const UNIT_ALIASES: Record<string, string> = {
  tsp: "tsp", tsps: "tsp", tspn: "tsp", teaspoon: "tsp", teaspoons: "tsp",
  tbsp: "tbsp", tbsps: "tbsp", tbs: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp",
  cup: "cup", cups: "cup",
  g: "g", gram: "g", grams: "g", kg: "kg", kgs: "kg",
  ml: "ml", l: "L", liter: "L", liters: "L", litre: "L", litres: "L",
  oz: "oz", ounce: "oz", ounces: "oz",
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  clove: "clove", cloves: "clove", slice: "slice", slices: "slice",
  piece: "piece", pieces: "piece", pc: "piece", pcs: "piece",
  can: "can", cans: "can", pack: "pack", packs: "pack", packet: "pack", packets: "pack",
  stalk: "stalk", stalks: "stalk", bunch: "bunch", bunches: "bunch",
  sprig: "sprig", sprigs: "sprig", pinch: "pinch", pinches: "pinch",
  inch: "inch", inches: "inch", bag: "bag", bags: "bag", block: "block", blocks: "block",
  bottle: "bottle", bottles: "bottle", head: "head", heads: "head",
};

const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 1 / 2, "¼": 1 / 4, "¾": 3 / 4, "⅓": 1 / 3, "⅔": 2 / 3,
  "⅛": 1 / 8, "⅜": 3 / 8, "⅝": 5 / 8, "⅞": 7 / 8,
};

// One number: "1 1/2", "1/2", "1.5", "½", "1½".
const NUM = String.raw`(?:\d+(?:\.\d+)?\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?\s*[½¼¾⅓⅔⅛⅜⅝⅞]?|[½¼¾⅓⅔⅛⅜⅝⅞])`;
const AMOUNT_RE = new RegExp(
  String.raw`^(~\s*)?(${NUM})(?:\s*(?:-|–|to)\s*(${NUM}))?\s*`
);
const UNIT_RE = /^([a-zA-Z]+)\b\.?\s*/;
const LABEL_RE = /^([^:：\d]{1,25}[:：]\s*)/;

function toNumber(s: string): number {
  s = s.trim();
  const uni = s.match(/[½¼¾⅓⅔⅛⅜⅝⅞]$/);
  if (uni) {
    const whole = s.slice(0, -1).trim();
    return (whole ? Number(whole) : 0) + UNICODE_FRACTIONS[uni[0]];
  }
  const mixed = s.match(/^(\d+(?:\.\d+)?)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  return Number(s);
}

export function parseAmount(text: string): Amount | null {
  const label = LABEL_RE.exec(text);
  const prefix = label ? label[1] : "";
  const body = text.slice(prefix.length);
  const m = AMOUNT_RE.exec(body);
  if (!m) return null;
  const qty = toNumber(m[2]);
  const qtyMax = m[3] ? toNumber(m[3]) : undefined;
  if (!isFinite(qty) || qty <= 0) return null;
  let rest = body.slice(m[0].length);
  // "1:1" is a ratio, not an amount.
  if (rest.startsWith(":")) return null;
  let unit = "";
  const u = UNIT_RE.exec(rest);
  if (u) {
    // "1 part soy sauce" is a ratio too.
    if (/^parts?$/i.test(u[1])) return null;
    const canon = UNIT_ALIASES[u[1].toLowerCase()];
    if (canon) {
      unit = canon;
      rest = rest.slice(u[0].length);
    }
  }
  return { prefix, qty, qtyMax, unit, rest };
}

/** Nearest 1/4 or 1/3, as a mixed number: 1.5 -> "1 1/2", 0.33 -> "1/3". */
function fraction(x: number): string {
  const whole = Math.floor(x + 1e-9);
  const parts: [number, string][] = [
    [0, ""], [1 / 4, "1/4"], [1 / 3, "1/3"], [1 / 2, "1/2"], [2 / 3, "2/3"], [3 / 4, "3/4"], [1, ""],
  ];
  const f = x - whole;
  let best = parts[0];
  for (const p of parts) if (Math.abs(p[0] - f) < Math.abs(best[0] - f)) best = p;
  const w = best[0] === 1 ? whole + 1 : whole;
  // Below 1/8, still show a non-zero amount.
  if (!best[1]) return w ? String(w) : x > 0 ? "1/8" : "0";
  return w ? `${w} ${best[1]}` : best[1];
}

/** Format a number for a unit: grams/ml as whole numbers, the rest as fractions. */
export function formatQty(n: number, unit: string): string {
  if (unit === "g" || unit === "ml") {
    if (n >= 100) return String(Math.round(n / 5) * 5);
    return String(Math.round(n * 10) / 10).replace(/\.0$/, "");
  }
  if (unit === "kg" || unit === "L") return String(Math.round(n * 100) / 100);
  return fraction(n);
}

function plural(unit: string, n: number): string {
  if (!unit || n <= 1) return unit;
  if (["clove", "slice", "piece", "can", "pack", "stalk", "sprig", "bag", "block", "bottle", "head", "cup"].includes(unit)) return unit + "s";
  if (unit === "bunch" || unit === "pinch") return unit + "es";
  if (unit === "inch") return "inches";
  return unit;
}

/**
 * Multiply the amount(s) in a line by `factor`, keeping the rest of the text.
 * Also scales metric amounts in brackets: "2 chicken thighs (450 g)".
 */
export function scaleLine(text: string, factor: number): string {
  if (factor === 1) return text;
  const a = parseAmount(text);
  if (!a) return text;
  const lo = formatQty(a.qty * factor, a.unit);
  const hi = a.qtyMax !== undefined ? formatQty(a.qtyMax * factor, a.unit) : null;
  const top = (a.qtyMax ?? a.qty) * factor;
  const unit = a.unit ? ` ${plural(a.unit, top)}` : "";
  const rest = a.rest.replace(
    /\((~?)(\d+(?:\.\d+)?)\s*(g|ml|kg|L|oz|lb)\b/g,
    (_m, tilde: string, n: string, u: string) => `(${tilde}${formatQty(Number(n) * factor, u)} ${u}`
  );
  const tilde = /^~/.test(text.slice(a.prefix.length)) ? "~" : "";
  return `${a.prefix}${tilde}${hi ? `${lo}-${hi}` : lo}${unit}${rest ? " " + rest.trimStart() : ""}`;
}

// Units that add together, converted to one base unit first.
const BASE: Record<string, [string, number]> = {
  tsp: ["tsp", 1], tbsp: ["tsp", 3],
  g: ["g", 1], kg: ["g", 1000],
  ml: ["ml", 1], L: ["ml", 1000],
};

/** Pick the display unit for a base-unit total, and convert to it. */
function display(base: string, n: number, usedTbsp = false): [number, string] {
  // Stay in tablespoons if any recipe measured in them ("1/2 tbsp", not "1 1/2 tsp").
  if (base === "tsp") return n >= 3 || usedTbsp ? [n / 3, "tbsp"] : [n, "tsp"];
  if (base === "g" && n >= 1000) return [n / 1000, "kg"];
  if (base === "ml" && n >= 1000) return [n / 1000, "L"];
  return [n, base];
}

/**
 * Add up the amounts in several lines for the same ingredient.
 * Returns e.g. "5 tbsp", "1 cup + 100 ml", "2 tsp, plus some", or null when
 * no line has an amount.
 */
export function totalAmount(lines: string[]): string | null {
  const lo = new Map<string, number>();
  let usedTbsp = false;
  const hi = new Map<string, number>();
  let loose = false;
  for (const line of lines) {
    const a = parseAmount(line);
    if (!a) {
      loose = true;
      continue;
    }
    const [base, mult] = BASE[a.unit] ?? [a.unit, 1];
    if (a.unit === "tbsp") usedTbsp = true;
    lo.set(base, (lo.get(base) ?? 0) + a.qty * mult);
    hi.set(base, (hi.get(base) ?? 0) + (a.qtyMax ?? a.qty) * mult);
  }
  if (lo.size === 0) return null;
  const parts = [...lo.keys()].map((base) => {
    const [top, unit] = display(base, hi.get(base)!, usedTbsp);
    const scale = top / hi.get(base)!;
    const low = lo.get(base)! * scale;
    const label = unit ? ` ${plural(unit, top)}` : "";
    const lowText = formatQty(low, unit);
    const topText = formatQty(top, unit);
    return lowText === topText ? `${topText}${label}` : `${lowText}-${topText}${label}`;
  });
  return parts.join(" + ") + (loose ? ", plus some" : "");
}
