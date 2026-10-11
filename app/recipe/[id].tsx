import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useRecipe, recipeStore } from "../../src/data/recipeStore";
import { useRecipeNotes, addNote, deleteNote } from "../../src/data/recipeNotes";
import { useAuth } from "../../src/lib/auth";
import { confirmDialog, alertDialog } from "../../src/lib/dialogs";
import { colors, maxContentWidth, radius, spacing } from "../../src/lib/theme";

/** Format an ISO timestamp as a short, readable date + time. */
function formatNoteDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { recipe, loading } = useRecipe(id);
  const { isEditor, email } = useAuth();
  const { notes, loading: notesLoading, refresh: refreshNotes } =
    useRecipeNotes(id);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

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

  const confirmDelete = async () => {
    const ok = await confirmDialog(
      "Delete recipe",
      `Delete “${recipe.title}”? It will be hidden from the app but can be recovered.`,
      { confirmText: "Delete", destructive: true }
    );
    if (!ok) return;
    try {
      await recipeStore.remove(recipe.id);
      router.canGoBack() ? router.back() : router.replace("/");
    } catch (e: any) {
      alertDialog("Couldn’t delete", e?.message ?? "Unknown error");
    }
  };

  const onAddNote = async () => {
    const text = noteText.trim();
    if (!text || savingNote) return;
    setSavingNote(true);
    try {
      await addNote(recipe.id, text, email ?? "owner");
      setNoteText("");
      await refreshNotes();
    } catch (e: any) {
      alertDialog("Couldn’t add note", e?.message ?? "Unknown error");
    } finally {
      setSavingNote(false);
    }
  };

  const onDeleteNote = async (noteId: string) => {
    const ok = await confirmDialog("Remove note", "Remove this note?", {
      confirmText: "Remove",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteNote(noteId);
      await refreshNotes();
    } catch (e: any) {
      alertDialog("Couldn’t remove note", e?.message ?? "Unknown error");
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Stack.Screen
        options={{
          title: recipe.title || "Recipe",
          // Explicit back control so it also shows on web and after saving
          // a new recipe (returns to the previous screen, or home).
          headerLeft: () => (
            <Pressable
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/")
              }
              hitSlop={12}
              style={styles.backBtn}
            >
              <Text style={styles.backText}>‹ Back</Text>
            </Pressable>
          ),
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

      <View style={styles.section}>
        <Text style={styles.heading}>Cooking notes</Text>

        {isEditor && (
          <View style={styles.noteComposer}>
            <TextInput
              style={styles.noteInput}
              placeholder="Add a note (e.g. “used 1.5 tbsp soy sauce, less salty”)"
              placeholderTextColor={colors.textMuted}
              value={noteText}
              onChangeText={setNoteText}
              multiline
              editable={!savingNote}
            />
            <Pressable
              style={[
                styles.addNoteBtn,
                (!noteText.trim() || savingNote) && styles.addNoteBtnDisabled,
              ]}
              onPress={onAddNote}
              disabled={!noteText.trim() || savingNote}
            >
              {savingNote ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.addNoteText}>Add note</Text>
              )}
            </Pressable>
          </View>
        )}

        {notesLoading && notes.length === 0 ? (
          <ActivityIndicator color={colors.primary} />
        ) : notes.length === 0 ? (
          <Text style={styles.muted}>No notes yet.</Text>
        ) : (
          notes.map((note) => (
            <View key={note.id} style={styles.noteCard}>
              <Text style={styles.noteText}>{note.text}</Text>
              <View style={styles.noteFooter}>
                <Text style={styles.noteMeta}>
                  {note.author} · {formatNoteDate(note.createdAt)}
                </Text>
                {isEditor && (
                  <Pressable
                    onPress={() => onDeleteNote(note.id)}
                    hitSlop={8}
                  >
                    <Text style={styles.noteRemove}>Remove</Text>
                  </Pressable>
                )}
              </View>
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
  backBtn: { paddingHorizontal: spacing.sm },
  backText: { color: colors.primary, fontSize: 16, fontWeight: "600" },
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
  noteComposer: { gap: spacing.sm, marginBottom: spacing.sm },
  noteInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text,
    minHeight: 72,
    textAlignVertical: "top",
  },
  addNoteBtn: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minWidth: 96,
    alignItems: "center",
  },
  addNoteBtnDisabled: { opacity: 0.5 },
  addNoteText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  noteCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  noteText: { fontSize: 15, color: colors.text, lineHeight: 22 },
  noteFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  noteMeta: { fontSize: 12, color: colors.textMuted },
  noteRemove: { fontSize: 12, fontWeight: "700", color: colors.danger },
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
