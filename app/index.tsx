import { useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRecipes, usePendingRecipes, recipeStore } from "../src/data/recipeStore";
import { CATEGORIES, iconForCategory } from "../src/data/categories";
import { isSupabaseConfigured } from "../src/lib/supabase";
import { useAuth } from "../src/lib/auth";
import { colors, maxContentWidth, radius, spacing } from "../src/lib/theme";
import { Recipe } from "../src/types/recipe";

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { recipes } = useRecipes();
  const { pending } = usePendingRecipes();
  const { isEditor, isSignedIn } = useAuth();
  const [query, setQuery] = useState("");

  const counts = useMemo(() => recipeStore.countsByCategory(), [recipes]);

  // Show every canonical category, plus any custom categories present in data.
  const folders = useMemo(() => {
    const known = new Set(CATEGORIES.map((c) => c.name));
    const extras = Object.keys(counts)
      .filter((name) => name && !known.has(name))
      .map((name) => ({ name, icon: iconForCategory(name) }));
    return [...CATEGORIES, ...extras];
  }, [counts]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return recipes.filter((r) => {
      const haystack = [r.title, r.description, r.category, ...r.tags, ...r.ingredients]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [recipes, query]);

  const searching = query.trim().length > 0;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerRow}>
              <Pressable onPress={() => router.push("/shopping")} hitSlop={12}>
                <Text style={styles.headerAction}>Shopping</Text>
              </Pressable>
              {isEditor && pending.length > 0 && (
                <Pressable onPress={() => router.push("/review")} hitSlop={12}>
                  <Text style={styles.headerAction}>Review ({pending.length})</Text>
                </Pressable>
              )}
              <Pressable onPress={() => router.push("/login")} hitSlop={12}>
                <Text style={styles.headerAction}>
                  {isSignedIn ? "Account" : "Log in"}
                </Text>
              </Pressable>
            </View>
          ),
        }}
      />
      {!isSupabaseConfigured && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Demo mode — sample recipes. Add Supabase keys in .env to save your own.
          </Text>
        </View>
      )}

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder="Search all recipes…"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
      </View>

      {searching ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          style={styles.centeredList}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <RecipeRow
              recipe={item}
              onPress={() => router.push(`/recipe/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No recipes match “{query}”.</Text>
          }
        />
      ) : (
        <FlatList
          data={folders}
          keyExtractor={(item) => item.name}
          style={styles.centeredList}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <FolderRow
              icon={item.icon}
              name={item.name}
              count={counts[item.name] ?? 0}
              onPress={() =>
                router.push(`/category/${encodeURIComponent(item.name)}`)
              }
            />
          )}
        />
      )}

      {isEditor && (
        <Pressable
          style={[styles.fab, { bottom: insets.bottom + spacing.lg }]}
          onPress={() => router.push("/edit/new")}
        >
          <Text style={styles.fabText}>＋</Text>
        </Pressable>
      )}
    </View>
  );
}

function FolderRow({
  icon,
  name,
  count,
  onPress,
}: {
  icon: string;
  name: string;
  count: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
    >
      <View style={styles.iconTile}>
        <Text style={styles.iconText}>{icon}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{name}</Text>
        <Text style={styles.rowSubtitle}>
          {count} {count === 1 ? "recipe" : "recipes"}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function RecipeRow({
  recipe,
  onPress,
}: {
  recipe: Recipe;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
    >
      {recipe.photoUrl ? (
        <Image source={{ uri: recipe.photoUrl }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]} />
      )}
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {recipe.title}
        </Text>
        <Text style={styles.rowSubtitle} numberOfLines={1}>
          {recipe.category || "Uncategorized"}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  headerAction: { color: colors.primary, fontSize: 15, fontWeight: "600" },
  banner: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  bannerText: { color: colors.primary, fontSize: 12 },
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
  centeredList: {
    width: "100%",
    maxWidth: maxContentWidth,
    alignSelf: "center",
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 120 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  rowPressed: { opacity: 0.8 },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { fontSize: 22 },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
  },
  thumbPlaceholder: { backgroundColor: colors.border },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
  rowSubtitle: { fontSize: 13, color: colors.textMuted },
  chevron: { fontSize: 22, color: colors.textMuted },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: spacing.xl },
  fab: {
    position: "absolute",
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  fabText: { color: "#fff", fontSize: 30, lineHeight: 34, fontWeight: "600" },
});
