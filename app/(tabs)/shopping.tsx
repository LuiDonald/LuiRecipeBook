import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRecipes, recipeStore } from "../../src/data/recipeStore";
import {
  useShoppingList,
  shoppingList,
  itemKey,
  ingredientKey,
} from "../../src/data/shoppingList";
import { Recipe } from "../../src/types/recipe";
import { confirmDialog } from "../../src/lib/dialogs";
import { colors, maxContentWidth, radius, spacing } from "../../src/lib/theme";

function capitalize(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export default function ShoppingScreen() {
  const { recipes } = useRecipes();
  useShoppingList(); // subscribe for re-renders
  const [picking, setPicking] = useState(false);
  const [view, setView] = useState<"combined" | "byRecipe">("combined");
  const [query, setQuery] = useState("");

  const selectedIds = shoppingList.getRecipeIds();
  const selectedRecipes = useMemo(
    () =>
      selectedIds
        .map((id) => recipeStore.getById(id))
        .filter((r): r is Recipe => !!r),
    [selectedIds, recipes]
  );

  // Combine similar ingredients across the selected recipes into one line each.
  const groups = useMemo(() => {
    const map = new Map<
      string,
      { label: string; entries: { key: string; text: string }[] }
    >();
    for (const r of selectedRecipes) {
      r.ingredients.forEach((text, i) => {
        const gkey = ingredientKey(text);
        if (!map.has(gkey)) map.set(gkey, { label: capitalize(gkey), entries: [] });
        map.get(gkey)!.entries.push({ key: itemKey(r.id, i), text });
      });
    }
    return Array.from(map.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [selectedRecipes, recipes]);

  // Progress counts (recomputed each render; cheap, and reflects checked state).
  const lineTotal = selectedRecipes.reduce((n, r) => n + r.ingredients.length, 0);
  let lineChecked = 0;
  for (const r of selectedRecipes) {
    r.ingredients.forEach((_, i) => {
      if (shoppingList.isChecked(itemKey(r.id, i))) lineChecked += 1;
    });
  }
  const combinedChecked = groups.filter((g) =>
    g.entries.every((e) => shoppingList.isChecked(e.key))
  ).length;

  const pickerResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? recipes.filter((r) =>
          [r.title, r.category, ...r.tags].join(" ").toLowerCase().includes(q)
        )
      : recipes;
    return list;
  }, [recipes, query]);

  const onClearAll = async () => {
    const ok = await confirmDialog("Clear list", "Remove all recipes from your shopping list?", {
      confirmText: "Clear",
      destructive: true,
    });
    if (ok) shoppingList.clear();
  };

  return (
    <View style={styles.container}>
      {picking ? (
        <>
          <View style={styles.topBar}>
            <TextInput
              style={[styles.search, { flex: 1 }]}
              placeholder="Search recipes to add…"
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
            />
            <Pressable style={styles.doneBtn} onPress={() => setPicking(false)}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
          <ScrollView
            style={styles.centeredList}
            contentContainerStyle={styles.list}
          >
            {pickerResults.length === 0 ? (
              <Text style={styles.empty}>No recipes found.</Text>
            ) : (
              pickerResults.map((r) => {
                const added = shoppingList.has(r.id);
                return (
                  <Pressable
                    key={r.id}
                    style={styles.pickRow}
                    onPress={() => shoppingList.toggleRecipe(r.id)}
                  >
                    <View
                      style={[styles.checkbox, added && styles.checkboxOn]}
                    >
                      {added ? <Text style={styles.checkmark}>✓</Text> : null}
                    </View>
                    <View style={styles.pickBody}>
                      <Text style={styles.pickTitle} numberOfLines={1}>
                        {r.title}
                      </Text>
                      <Text style={styles.pickSub} numberOfLines={1}>
                        {r.category || "Uncategorized"} · {r.ingredients.length}{" "}
                        ingredient{r.ingredients.length === 1 ? "" : "s"}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </>
      ) : selectedRecipes.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyBig}>Your shopping list is empty</Text>
          <Text style={styles.emptySub}>
            Tap “Add” to pick recipes and build your market run.
          </Text>
          <Pressable style={styles.cta} onPress={() => setPicking(true)}>
            <Text style={styles.ctaText}>Add recipes</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView style={styles.centeredList} contentContainerStyle={styles.list}>
          <Pressable style={styles.addMoreBtn} onPress={() => setPicking(true)}>
            <Text style={styles.addMoreText}>＋ Add recipes</Text>
          </Pressable>
          <View style={styles.summaryRow}>
            <Text style={styles.summary}>
              {view === "combined"
                ? `${combinedChecked}/${groups.length}`
                : `${lineChecked}/${lineTotal}`}{" "}
              item{(view === "combined" ? groups.length : lineTotal) === 1 ? "" : "s"}{" "}
              checked · {selectedRecipes.length} recipe
              {selectedRecipes.length === 1 ? "" : "s"}
            </Text>
            <Pressable onPress={onClearAll} hitSlop={8}>
              <Text style={styles.clearAll}>Clear all</Text>
            </Pressable>
          </View>

          <View style={styles.toggle}>
            {(["combined", "byRecipe"] as const).map((v) => (
              <Pressable
                key={v}
                style={[styles.toggleBtn, view === v && styles.toggleBtnOn]}
                onPress={() => setView(v)}
              >
                <Text style={[styles.toggleText, view === v && styles.toggleTextOn]}>
                  {v === "combined" ? "Combined" : "By recipe"}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.chips}>
            {selectedRecipes.map((r) => (
              <Pressable
                key={r.id}
                style={styles.chip}
                onPress={() => shoppingList.removeRecipe(r.id)}
              >
                <Text style={styles.chipText} numberOfLines={1}>
                  {r.title}
                </Text>
                <Text style={styles.chipX}>×</Text>
              </Pressable>
            ))}
          </View>

          {view === "combined" ? (
            <View style={styles.group}>
              {groups.map((g) => {
                const keys = g.entries.map((e) => e.key);
                const done = keys.every((k) => shoppingList.isChecked(k));
                const showSub =
                  g.entries.length > 1 ||
                  g.entries[0].text.trim().toLowerCase() !== g.label.toLowerCase();
                return (
                  <Pressable
                    key={g.key}
                    style={styles.itemRow}
                    onPress={() => shoppingList.setItems(keys, !done)}
                  >
                    <View style={[styles.checkbox, done && styles.checkboxOn]}>
                      {done ? <Text style={styles.checkmark}>✓</Text> : null}
                    </View>
                    <View style={styles.itemBody}>
                      <Text style={[styles.itemText, done && styles.itemDone]}>
                        {g.label}
                        {g.entries.length > 1 ? `  ×${g.entries.length}` : ""}
                      </Text>
                      {showSub ? (
                        <Text style={styles.itemSub}>
                          {g.entries.map((e) => e.text).join("   +   ")}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            selectedRecipes.map((r) => (
              <View key={r.id} style={styles.group}>
                <Text style={styles.groupTitle} numberOfLines={1}>
                  {r.title}
                </Text>
                {r.ingredients.length === 0 ? (
                  <Text style={styles.noItems}>No ingredients listed.</Text>
                ) : (
                  r.ingredients.map((item, i) => {
                    const key = itemKey(r.id, i);
                    const done = shoppingList.isChecked(key);
                    return (
                      <Pressable
                        key={key}
                        style={styles.itemRow}
                        onPress={() => shoppingList.toggleItem(key)}
                      >
                        <View style={[styles.checkbox, done && styles.checkboxOn]}>
                          {done ? <Text style={styles.checkmark}>✓</Text> : null}
                        </View>
                        <Text style={[styles.itemText, done && styles.itemDone]}>
                          {item}
                        </Text>
                      </Pressable>
                    );
                  })
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.lg,
    paddingBottom: spacing.sm,
    width: "100%",
    maxWidth: maxContentWidth,
    alignSelf: "center",
  },
  doneBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  doneText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  addMoreBtn: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  addMoreText: { color: colors.primary, fontWeight: "700", fontSize: 14 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
  },
  centeredList: { width: "100%", maxWidth: maxContentWidth, alignSelf: "center" },
  list: { padding: spacing.lg, paddingBottom: 120 },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: spacing.xl },
  emptyBig: { fontSize: 18, fontWeight: "700", color: colors.text },
  emptySub: { color: colors.textMuted, textAlign: "center" },
  cta: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  searchWrap: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
    width: "100%",
    maxWidth: maxContentWidth,
    alignSelf: "center",
  },
  search: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  pickBody: { flex: 1, gap: 2 },
  pickTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  pickSub: { fontSize: 12, color: colors.textMuted },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  summary: { color: colors.textMuted, fontSize: 13, flex: 1 },
  clearAll: { color: colors.danger, fontWeight: "700", fontSize: 13 },
  toggle: {
    flexDirection: "row",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: 3,
    marginBottom: spacing.md,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderRadius: radius.sm,
  },
  toggleBtnOn: { backgroundColor: colors.card },
  toggleText: { fontSize: 13, fontWeight: "700", color: colors.primary },
  toggleTextOn: { color: colors.text },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    maxWidth: 220,
  },
  chipText: { fontSize: 13, color: colors.text, flexShrink: 1 },
  chipX: { fontSize: 16, color: colors.textMuted, fontWeight: "700" },
  group: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  noItems: { color: colors.textMuted, fontStyle: "italic" },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  itemBody: { flex: 1, gap: 2 },
  itemText: { flex: 1, fontSize: 15, color: colors.text, lineHeight: 22 },
  itemSub: { fontSize: 12, color: colors.textMuted },
  itemDone: { color: colors.textMuted, textDecorationLine: "line-through" },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.primary },
  checkmark: { color: "#fff", fontSize: 14, fontWeight: "900", lineHeight: 16 },
});
