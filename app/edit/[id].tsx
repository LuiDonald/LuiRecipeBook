import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { recipeStore } from "../../src/data/recipeStore";
import { emptyDraft, RecipeDraft } from "../../src/types/recipe";
import { CATEGORIES } from "../../src/data/categories";
import { pickImageFromLibrary, takePhoto } from "../../src/lib/imagePicker";
import { isSupabaseConfigured } from "../../src/lib/supabase";
import { useAuth } from "../../src/lib/auth";
import { parseRecipeText } from "../../src/lib/parseRecipe";
import { isLocalPhoto } from "../../src/lib/storage";
import { colors, maxContentWidth, radius, spacing } from "../../src/lib/theme";

export default function EditRecipeScreen() {
  const { id, category: categoryParam } = useLocalSearchParams<{
    id: string;
    category?: string;
  }>();
  const router = useRouter();
  const isNew = id === "new";
  const { isEditor, ready } = useAuth();

  // Guard: only the owner can reach the editor. Bounce everyone else once the
  // auth state has resolved (so we don't redirect the owner mid-load).
  useEffect(() => {
    if (ready && !isEditor) {
      router.replace("/login");
    }
  }, [ready, isEditor, router]);

  const existing = useMemo(
    () => (isNew ? undefined : recipeStore.getById(id)),
    [id, isNew]
  );

  const [draft, setDraft] = useState<RecipeDraft>(() =>
    existing
      ? {
          title: existing.title,
          description: existing.description,
          category: existing.category,
          photoUrl: existing.photoUrl,
          ingredients: [...existing.ingredients],
          steps: [...existing.steps],
          tags: [...existing.tags],
        }
      : emptyDraft(categoryParam ? decodeURIComponent(categoryParam) : "")
  );
  const [tagsText, setTagsText] = useState(existing?.tags.join(", ") ?? "");
  const [saving, setSaving] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [parsing, setParsing] = useState(false);
  const isPasteLink = /instagram\.com\//i.test(pasteText);

  const patch = (p: Partial<RecipeDraft>) => setDraft((d) => ({ ...d, ...p }));

  const onParse = async () => {
    if (!pasteText.trim()) return;
    setParsing(true);
    try {
      const p = await parseRecipeText(pasteText);
      const gotSomething =
        p.title || p.ingredients.length || p.steps.length;
      if (!gotSomething) {
        Alert.alert(
          "No recipe found",
          "That text didn't look like a recipe. Try pasting the full recipe or caption."
        );
        return;
      }
      setDraft((d) => ({
        ...d,
        title: p.title || d.title,
        description: p.description || d.description,
        category: p.category || d.category,
        ingredients: p.ingredients.length ? p.ingredients : d.ingredients,
        steps: p.steps.length ? p.steps : d.steps,
        tags: p.tags.length ? p.tags : d.tags,
      }));
      if (p.tags.length) setTagsText(p.tags.join(", "));
    } catch (e: any) {
      Alert.alert("Couldn't parse", e?.message ?? "Unknown error");
    } finally {
      setParsing(false);
    }
  };

  const willUploadPhoto =
    isSupabaseConfigured && !!draft.photoUrl && isLocalPhoto(draft.photoUrl);
  const busyLabel = willUploadPhoto ? "Uploading…" : "Saving…";

  // --- list helpers (ingredients / steps) ---
  const updateItem = (key: "ingredients" | "steps", i: number, val: string) =>
    setDraft((d) => {
      const next = [...d[key]];
      next[i] = val;
      return { ...d, [key]: next };
    });
  const addItem = (key: "ingredients" | "steps") =>
    setDraft((d) => ({ ...d, [key]: [...d[key], ""] }));
  const removeItem = (key: "ingredients" | "steps", i: number) =>
    setDraft((d) => ({ ...d, [key]: d[key].filter((_, idx) => idx !== i) }));

  const onPickImage = async () => {
    const uri = await pickImageFromLibrary();
    if (uri) patch({ photoUrl: uri });
  };
  const onTakePhoto = async () => {
    const uri = await takePhoto();
    if (uri) patch({ photoUrl: uri });
  };

  const onSave = async () => {
    if (!draft.title.trim()) {
      Alert.alert("Title required", "Please give your recipe a title.");
      return;
    }
    setSaving(true);
    try {
      const cleaned: RecipeDraft = {
        ...draft,
        title: draft.title.trim(),
        tags: tagsText
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        ingredients: draft.ingredients.map((s) => s.trim()).filter(Boolean),
        steps: draft.steps.map((s) => s.trim()).filter(Boolean),
      };
      if (isNew) {
        const created = await recipeStore.create(cleaned);
        router.replace(`/recipe/${created.id}`);
      } else {
        await recipeStore.update(id, cleaned);
        router.back();
      }
    } catch (e: any) {
      Alert.alert("Could not save", e?.message ?? "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{
          title: isNew ? "New Recipe" : "Edit Recipe",
          headerRight: () => (
            <Pressable onPress={onSave} disabled={saving} hitSlop={12}>
              <Text style={[styles.headerAction, saving && { opacity: 0.5 }]}>
                {saving ? busyLabel : "Save"}
              </Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Paste-to-autofill */}
        {isSupabaseConfigured && (
          <View style={styles.pasteCard}>
            <Text style={styles.pasteTitle}>✨ Paste a recipe to auto-fill</Text>
            <Text style={styles.pasteHint}>
              Paste a full recipe, an Instagram caption, or an Instagram link,
              then tap the button. Review the fields below before saving.
            </Text>
            <TextInput
              style={[styles.input, styles.pasteInput]}
              value={pasteText}
              onChangeText={setPasteText}
              placeholder="Paste recipe text, a caption, or an Instagram link…"
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <Pressable
              style={[
                styles.parseBtn,
                (parsing || !pasteText.trim()) && { opacity: 0.6 },
              ]}
              onPress={onParse}
              disabled={parsing || !pasteText.trim()}
            >
              <Text style={styles.parseBtnText}>
                {parsing
                  ? isPasteLink
                    ? "Fetching…"
                    : "Parsing…"
                  : isPasteLink
                  ? "Fetch & fill"
                  : "Parse & fill"}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Photo */}
        {draft.photoUrl ? (
          <Image source={{ uri: draft.photoUrl }} style={styles.photo} />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]}>
            <Text style={styles.muted}>No photo yet</Text>
          </View>
        )}
        <View style={styles.photoActions}>
          <Pressable style={styles.secondaryBtn} onPress={onPickImage}>
            <Text style={styles.secondaryBtnText}>Choose photo</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={onTakePhoto}>
            <Text style={styles.secondaryBtnText}>Take photo</Text>
          </Pressable>
        </View>

        {/* Title + description */}
        <Field label="Title">
          <TextInput
            style={styles.input}
            value={draft.title}
            onChangeText={(t) => patch({ title: t })}
            placeholder="e.g. Grandma's lasagna"
            placeholderTextColor={colors.textMuted}
          />
        </Field>

        <Field label="Category">
          <View style={styles.chipWrap}>
            {CATEGORIES.map((c) => {
              const selected = draft.category === c.name;
              return (
                <Pressable
                  key={c.name}
                  onPress={() => patch({ category: c.name })}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selected && styles.chipTextSelected,
                    ]}
                  >
                    {c.icon} {c.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field label="Description">
          <TextInput
            style={[styles.input, styles.multiline]}
            value={draft.description}
            onChangeText={(t) => patch({ description: t })}
            placeholder="A short description…"
            placeholderTextColor={colors.textMuted}
            multiline
          />
        </Field>

        <Field label="Tags (comma separated)">
          <TextInput
            style={styles.input}
            value={tagsText}
            onChangeText={setTagsText}
            placeholder="dinner, italian, vegetarian"
            placeholderTextColor={colors.textMuted}
          />
        </Field>

        {/* Ingredients */}
        <ListEditor
          label="Ingredients"
          items={draft.ingredients}
          placeholder="e.g. 2 cups flour"
          onChange={(i, v) => updateItem("ingredients", i, v)}
          onAdd={() => addItem("ingredients")}
          onRemove={(i) => removeItem("ingredients", i)}
          addLabel="+ Add ingredient"
        />

        {/* Steps */}
        <ListEditor
          label="Steps"
          items={draft.steps}
          placeholder="Describe this step…"
          numbered
          onChange={(i, v) => updateItem("steps", i, v)}
          onAdd={() => addItem("steps")}
          onRemove={(i) => removeItem("steps", i)}
          addLabel="+ Add step"
        />

        <Pressable
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={onSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>
            {saving ? busyLabel : "Save recipe"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function ListEditor({
  label,
  items,
  placeholder,
  numbered,
  addLabel,
  onChange,
  onAdd,
  onRemove,
}: {
  label: string;
  items: string[];
  placeholder: string;
  numbered?: boolean;
  addLabel: string;
  onChange: (i: number, v: string) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {items.map((item, i) => (
        <View key={i} style={styles.listRow}>
          <Text style={styles.listMarker}>{numbered ? `${i + 1}.` : "•"}</Text>
          <TextInput
            style={[styles.input, styles.listInput]}
            value={item}
            onChangeText={(v) => onChange(i, v)}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            multiline
          />
          <Pressable onPress={() => onRemove(i)} hitSlop={8}>
            <Text style={styles.removeBtn}>✕</Text>
          </Pressable>
        </View>
      ))}
      <Pressable onPress={onAdd}>
        <Text style={styles.addLink}>{addLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
    gap: spacing.md,
    width: "100%",
    maxWidth: maxContentWidth,
    alignSelf: "center",
  },
  headerAction: { color: colors.primary, fontSize: 16, fontWeight: "700" },
  pasteCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  pasteTitle: { fontSize: 15, fontWeight: "700", color: colors.primary },
  pasteHint: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  pasteInput: {
    minHeight: 90,
    textAlignVertical: "top",
    backgroundColor: colors.card,
  },
  parseBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: "center",
  },
  parseBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  photo: {
    width: "100%",
    height: 200,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  photoPlaceholder: { alignItems: "center", justifyContent: "center" },
  photoActions: { flexDirection: "row", gap: spacing.md },
  secondaryBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
  },
  secondaryBtnText: { color: colors.primary, fontWeight: "600" },
  field: { gap: spacing.xs },
  label: { fontSize: 14, fontWeight: "700", color: colors.text },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipText: { fontSize: 13, color: colors.textMuted },
  chipTextSelected: { color: colors.primary, fontWeight: "700" },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  multiline: { minHeight: 72, textAlignVertical: "top" },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  listMarker: {
    width: 20,
    textAlign: "center",
    color: colors.primary,
    fontWeight: "700",
  },
  listInput: { flex: 1 },
  removeBtn: { color: colors.danger, fontSize: 16, paddingHorizontal: 4 },
  addLink: {
    color: colors.primary,
    fontWeight: "600",
    paddingVertical: spacing.sm,
  },
  muted: { color: colors.textMuted },
  saveBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
