import { useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { usePendingRecipes, recipeStore } from "../../src/data/recipeStore";
import { isSupabaseConfigured } from "../../src/lib/supabase";
import { useAuth } from "../../src/lib/auth";
import { confirmDialog, alertDialog } from "../../src/lib/dialogs";
import { colors, maxContentWidth, radius, spacing } from "../../src/lib/theme";
import { Recipe } from "../../src/types/recipe";

export default function ReviewScreen() {
  const router = useRouter();
  const { isEditor, ready } = useAuth();
  const { pending } = usePendingRecipes();

  // Owner-only screen: bounce anyone else to login once auth has settled.
  useEffect(() => {
    if (ready && !isEditor) router.replace("/account");
  }, [ready, isEditor, router]);

  const loading = isSupabaseConfigured && !recipeStore.isLoaded;

  const onApprove = async (recipe: Recipe) => {
    try {
      await recipeStore.approve(recipe.id);
    } catch (e: any) {
      alertDialog("Couldn’t approve", e?.message ?? "Unknown error");
    }
  };

  const onReject = async (recipe: Recipe) => {
    const ok = await confirmDialog(
      "Reject recipe",
      `Permanently delete “${recipe.title}”? This can’t be undone.`,
      { confirmText: "Reject", destructive: true }
    );
    if (!ok) return;
    try {
      await recipeStore.rejectPending(recipe.id);
    } catch (e: any) {
      alertDialog("Couldn’t reject", e?.message ?? "Unknown error");
    }
  };

  if (!isEditor) return null;

  return (
    <View style={styles.container}>
      {loading && pending.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={pending}
          keyExtractor={(item) => item.id}
          style={styles.centeredList}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            pending.length > 0 ? (
              <Text style={styles.subtitle}>
                {pending.length} recipe{pending.length === 1 ? "" : "s"} submitted
                by the agent, awaiting your approval.
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <Text style={styles.empty}>Nothing to review right now. 🎉</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Pressable
                style={styles.cardTop}
                onPress={() => router.push(`/recipe/${item.id}`)}
              >
                {item.photoUrl ? (
                  <Image source={{ uri: item.photoUrl }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]} />
                )}
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.category ? (
                    <Text style={styles.cardCategory}>{item.category}</Text>
                  ) : null}
                  <Text style={styles.cardMeta}>
                    {item.ingredients.length} ingredient
                    {item.ingredients.length === 1 ? "" : "s"} ·{" "}
                    {item.steps.length} step{item.steps.length === 1 ? "" : "s"}
                  </Text>
                  {item.description ? (
                    <Text style={styles.cardDesc} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>

              <View style={styles.actions}>
                <Pressable
                  style={[styles.btn, styles.rejectBtn]}
                  onPress={() => onReject(item)}
                >
                  <Text style={styles.rejectText}>Reject</Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, styles.approveBtn]}
                  onPress={() => onApprove(item)}
                >
                  <Text style={styles.approveText}>Approve</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  centeredList: { width: "100%", maxWidth: maxContentWidth, alignSelf: "center" },
  list: { padding: spacing.lg, paddingBottom: 120 },
  subtitle: { color: colors.textMuted, fontSize: 14, marginBottom: spacing.md },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: spacing.xl },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  cardTop: { flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.md },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.primarySoft },
  thumbPlaceholder: { backgroundColor: colors.border },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  cardCategory: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardMeta: { fontSize: 12, color: colors.textMuted },
  cardDesc: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 22, color: colors.textMuted },
  actions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  btn: { flex: 1, paddingVertical: spacing.md, alignItems: "center" },
  rejectBtn: { borderRightWidth: 1, borderRightColor: colors.border },
  rejectText: { color: colors.danger, fontWeight: "700", fontSize: 15 },
  approveBtn: { backgroundColor: colors.primarySoft },
  approveText: { color: colors.primary, fontWeight: "700", fontSize: 15 },
});
