import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { useRecipes, recipeStore } from "../src/data/recipeStore";
import {
  useShoppingList,
  shoppingList,
  itemKey,
} from "../src/data/shoppingList";
import { confirmDialog } from "../src/lib/dialogs";
import { colors, maxContentWidth, radius, spacing } from "../src/lib/theme";

export default function ShoppingScreen() {
  const { recipes } = useRecipes();
  useShoppingList(); // subscribe for re-renders
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");

  const selectedIds = shoppingList.getRecipeIds();
  const selectedRecipes = useMemo(
    () => selectedIds.map((id) => recipeStore.getById(id)).filter(Boolean),
    [selectedIds, recipes]
  );

  const { totalItems, checkedItems } = useMemo(() => {
    let total = 0;
    let checked = 0;
    for (const r of selectedRecipes) {
      if (!r) continue;
      total += r.ingredients.length;
      r.ingredients.forEach((_, i) => {
        if (shoppingList.isChecked(itemKey(r.id, i))) checked += 1;
      });
    }
    return { totalItems: total, checkedItems: checked };
  }, [selectedRecipes, recipes]);

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
      <Stack.Screen
        options={{
          title: picking ? "Add recipes" : "Shopping list",
          headerRight: () => (
            <Pressable onPress={() => setPicking((p) => !p)} hitSlop={12}>
              <Text style={styles.headerAction}>{picking ? "Done" : "Add"}</Text>
            </Pressable>
          ),
        }}
      />

      {picking ? (
        <>
          <View style={styles.searchWrap}>
            <TextInput
              style={styles.search}
              placeholder="Search recipes to add…"
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
            />
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
          <View style={styles.summaryRow}>
            <Text style={styles.summary}>
              {checkedItems}/{totalItems} item{totalItems === 1 ? "" : "s"} checked
              · {selectedRecipes.length} recipe
              {selectedRecipes.length === 1 ? "" : "s"}
            </Text>
            <Pressable onPress={onClearAll} hitSlop={8}>
              <Text style={styles.clearAll}>Clear all</Text>
            </Pressable>
          </View>

          {selectedRecipes.map((r) =>
            r ? (
              <View key={r.id} style={styles.group}>
                <View style={styles.groupHeader}>
                  <Text style={styles.groupTitle} numberOfLines={1}>
                    {r.title}
                  </Text>
                  <Pressable onPress={() => shoppingList.removeRecipe(r.id)} hitSlop={8}>
                    <Text style={styles.removeRecipe}>Remove</Text>
                  </Pressable>
                </View>
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
            ) : null
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  headerAction: { color: colors.primary, fontSize: 16, fontWeight: "600" },
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
  group: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  groupTitle: { fontSize: 16, fontWeight: "700", color: colors.text, flex: 1 },
  removeRecipe: { color: colors.danger, fontWeight: "700", fontSize: 13 },
  noItems: { color: colors.textMuted, fontStyle: "italic" },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  itemText: { flex: 1, fontSize: 15, color: colors.text, lineHeight: 22 },
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
