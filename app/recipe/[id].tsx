import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useRecipe, recipeStore } from "../../src/data/recipeStore";
import { useAuth } from "../../src/lib/auth";
import { colors, maxContentWidth, radius, spacing } from "../../src/lib/theme";

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { recipe, loading } = useRecipe(id);
  const { isEditor } = useAuth();

  if (!recipe) {
    return (
      <View style={styles.centered}>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.muted}>Recipe not found.</Text>
        )}
      </View>
    );
  }

  const confirmDelete = () => {
    Alert.alert("Delete recipe", `Delete “${recipe.title}”?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await recipeStore.remove(recipe.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Stack.Screen
        options={{
          title: recipe.title || "Recipe",
          headerRight: isEditor
            ? () => (
                <Pressable
                  onPress={() => router.push(`/edit/${recipe.id}`)}
                  hitSlop={12}
                >
                  <Text style={styles.headerAction}>Edit</Text>
                </Pressable>
              )
            : undefined,
        }}
      />

      {recipe.photoUrl ? (
        <Image source={{ uri: recipe.photoUrl }} style={styles.hero} />
      ) : (
        <View style={[styles.hero, styles.heroPlaceholder]}>
          <Text style={styles.muted}>No photo</Text>
        </View>
      )}

      <View style={styles.section}>
        {recipe.category ? (
          <Text style={styles.category}>{recipe.category}</Text>
        ) : null}
        <Text style={styles.title}>{recipe.title}</Text>
        {recipe.description ? (
          <Text style={styles.description}>{recipe.description}</Text>
        ) : null}
        {recipe.tags.length > 0 && (
          <View style={styles.tagRow}>
            {recipe.tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>Ingredients</Text>
        {recipe.ingredients.length === 0 ? (
          <Text style={styles.muted}>No ingredients yet.</Text>
        ) : (
          recipe.ingredients.map((item, i) => (
            <View key={i} style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>{item}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>Steps</Text>
        {recipe.steps.length === 0 ? (
          <Text style={styles.muted}>No steps yet.</Text>
        ) : (
          recipe.steps.map((step, i) => (
            <View key={i} style={styles.listItem}>
              <Text style={styles.stepNumber}>{i + 1}</Text>
              <Text style={styles.listText}>{step}</Text>
            </View>
          ))
        )}
      </View>

      {isEditor && (
        <Pressable style={styles.deleteBtn} onPress={confirmDelete}>
          <Text style={styles.deleteText}>Delete recipe</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingBottom: spacing.xl * 2,
    width: "100%",
    maxWidth: maxContentWidth,
    alignSelf: "center",
  },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerAction: { color: colors.primary, fontSize: 16, fontWeight: "600" },
  hero: { width: "100%", height: 240, backgroundColor: colors.primarySoft },
  heroPlaceholder: { alignItems: "center", justifyContent: "center" },
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  category: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: { fontSize: 24, fontWeight: "700", color: colors.text },
  description: { fontSize: 15, color: colors.textMuted, lineHeight: 22 },
  heading: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tag: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  tagText: { color: colors.primary, fontSize: 12, fontWeight: "600" },
  listItem: { flexDirection: "row", gap: spacing.sm, paddingVertical: 4 },
  bullet: { color: colors.primary, fontSize: 16, lineHeight: 22 },
  stepNumber: {
    color: "#fff",
    backgroundColor: colors.primary,
    width: 22,
    height: 22,
    borderRadius: 11,
    textAlign: "center",
    lineHeight: 22,
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden",
  },
  listText: { flex: 1, fontSize: 15, color: colors.text, lineHeight: 22 },
  muted: { color: colors.textMuted },
  deleteBtn: {
    marginTop: spacing.xl,
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  deleteText: { color: colors.danger, fontWeight: "600", fontSize: 15 },
});
