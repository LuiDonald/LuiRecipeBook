import { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  activateKeepAwakeAsync,
  deactivateKeepAwake,
  isAvailableAsync,
} from "expo-keep-awake";
import { useRecipe } from "../../src/data/recipeStore";
import { scaleLine } from "../../src/lib/quantity";
import { kitchenLog } from "../../src/data/kitchenLog";
import { colors, maxContentWidth, radius, spacing } from "../../src/lib/theme";

const KEEP_AWAKE_TAG = "cook-mode";

/**
 * Keep the screen on while cooking. Native always supports it; on web it
 * depends on the browser (Screen Wake Lock), so check first and fail quietly.
 */
function useCookKeepAwake() {
  useEffect(() => {
    let active = false;
    isAvailableAsync()
      .then((ok) => (ok ? activateKeepAwakeAsync(KEEP_AWAKE_TAG) : undefined))
      .then(() => {
        active = true;
      })
      .catch(() => {});
    return () => {
      if (active) deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, []);
}

/** Full-screen, one-step-at-a-time view of a recipe for use while cooking. */
export default function CookScreen() {
  const { id, scale: scaleParam } = useLocalSearchParams<{ id: string; scale?: string }>();
  const scale = Number(scaleParam) > 0 ? Number(scaleParam) : 1;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { recipe } = useRecipe(id);
  const [step, setStep] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  useCookKeepAwake();

  const steps = recipe?.steps ?? [];
  const last = Math.max(steps.length - 1, 0);
  const close = () => (router.canGoBack() ? router.back() : router.replace(`/recipe/${id}`));

  // Arrow keys / space on web (handy on a laptop propped up in the kitchen).
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setStep((s) => Math.min(s + 1, last));
      } else if (e.key === "ArrowLeft") {
        setStep((s) => Math.max(s - 1, 0));
      } else if (e.key === "Escape") {
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last]);

  if (!recipe) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.muted}>Loading recipe…</Text>
      </View>
    );
  }

  const scaleText = scale === 1 ? null : `${scale === 0.5 ? "½" : scale === 1.5 ? "1½" : scale}×`;

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.column}>
        <View style={styles.topBar}>
          <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Exit cook mode">
            <Text style={styles.close}>✕ Exit</Text>
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {recipe.title}
          </Text>
          <Pressable
            onPress={() => setShowIngredients((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityState={{ expanded: showIngredients }}
          >
            <Text style={styles.toggle}>
              {showIngredients ? "Hide ingredients" : "Ingredients"}
            </Text>
          </Pressable>
        </View>

        {steps.length > 0 ? (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${((step + 1) / steps.length) * 100}%` }]} />
          </View>
        ) : null}

        {showIngredients ? (
          <ScrollView style={styles.ingredients} contentContainerStyle={{ gap: 6 }}>
            {scaleText ? <Text style={styles.scaleNote}>Amounts at {scaleText}</Text> : null}
            {recipe.ingredients.map((item, i) => (
              <Text key={i} style={styles.ingredientText}>
                • {scaleLine(item, scale)}
              </Text>
            ))}
          </ScrollView>
        ) : null}

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {steps.length === 0 ? (
            <Text style={styles.muted}>This recipe has no steps yet.</Text>
          ) : (
            <>
              <Text style={styles.stepLabel}>
                Step {step + 1} of {steps.length}
              </Text>
              <Text style={styles.stepText}>{steps[step]}</Text>
              {scaleText ? (
                <Text style={styles.scaleNote}>
                  Ingredients are at {scaleText}. Amounts written in the steps aren't scaled.
                </Text>
              ) : null}
            </>
          )}
        </ScrollView>

        <View style={styles.nav}>
          <Pressable
            style={[styles.navBtn, styles.navBack, step === 0 && styles.navHidden]}
            onPress={() => setStep((s) => Math.max(s - 1, 0))}
            disabled={step === 0}
            accessibilityRole="button"
            accessibilityLabel="Previous step"
          >
            <Text style={styles.navBackText}>‹ Back</Text>
          </Pressable>
          {step < last ? (
            <Pressable
              style={[styles.navBtn, styles.navNext]}
              onPress={() => setStep((s) => Math.min(s + 1, last))}
              accessibilityRole="button"
              accessibilityLabel="Next step"
            >
              <Text style={styles.navNextText}>Next ›</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.navBtn, styles.navNext]}
              onPress={() => {
                // Finishing the last step counts as having made it today.
                kitchenLog.logCooked(recipe.id);
                close();
              }}
              accessibilityRole="button"
              accessibilityLabel="Done, mark as made today"
            >
              <Text style={styles.navNextText}>Done</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },
  column: { flex: 1, width: "100%", maxWidth: maxContentWidth, alignSelf: "center" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  close: { color: colors.textMuted, fontSize: 15, fontWeight: "600" },
  title: { flex: 1, textAlign: "center", fontSize: 15, fontWeight: "700", color: colors.text },
  toggle: { color: colors.primary, fontSize: 15, fontWeight: "700" },
  progressTrack: {
    height: 4,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.primarySoft,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: { height: 4, backgroundColor: colors.primary },
  ingredients: {
    maxHeight: 220,
    margin: spacing.lg,
    marginBottom: 0,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  ingredientText: { fontSize: 16, color: colors.text, lineHeight: 22 },
  body: { flex: 1 },
  bodyContent: { padding: spacing.xl, gap: spacing.lg, flexGrow: 1, justifyContent: "center" },
  stepLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  stepText: { fontSize: 26, lineHeight: 38, color: colors.text, fontWeight: "500" },
  scaleNote: { fontSize: 13, color: colors.textMuted },
  muted: { color: colors.textMuted, fontSize: 16 },
  nav: { flexDirection: "row", gap: spacing.md, padding: spacing.lg },
  navBtn: {
    flex: 1,
    minHeight: 64,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  navBack: { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  navHidden: { opacity: 0 },
  navNext: { backgroundColor: colors.primary },
  navBackText: { fontSize: 18, fontWeight: "700", color: colors.text },
  navNextText: { fontSize: 18, fontWeight: "700", color: "#fff" },
});
