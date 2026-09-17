import { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RecipeCard } from "../../src/components/RecipeCard";
import { useRecipes, recipeStore } from "../../src/data/recipeStore";
import { iconForCategory } from "../../src/data/categories";
import { useAuth } from "../../src/lib/auth";
import { useGrid } from "../../src/lib/useGrid";
import { colors, spacing } from "../../src/lib/theme";

export default function CategoryScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const category = decodeURIComponent(name ?? "");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isEditor } = useAuth();
  const { columns, cardWidth, containerWidth, gap, padding } = useGrid();

  // Re-render when recipes change.
  useRecipes();
  const recipes = useMemo(
    () => recipeStore.getByCategory(category),
    [category, recipeStore.getAll().length]
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{ title: `${iconForCategory(category)}  ${category}` }}
      />

      <FlatList
        // key forces a fresh list when the column count changes (e.g. resize).
        key={columns}
        data={recipes}
        keyExtractor={(item) => item.id}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? { gap } : undefined}
        style={{ alignSelf: "center", width: containerWidth }}
        contentContainerStyle={{ padding, paddingBottom: 120, gap }}
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item}
            width={cardWidth}
            onPress={() => router.push(`/recipe/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No recipes in {category} yet. Tap ＋ to add one.
          </Text>
        }
      />

      {isEditor && (
        <Pressable
          style={[styles.fab, { bottom: insets.bottom + spacing.lg }]}
          onPress={() =>
            router.push(`/edit/new?category=${encodeURIComponent(category)}`)
          }
        >
          <Text style={styles.fabText}>＋</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
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
