import { useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRecipes, recipeStore } from "../../src/data/recipeStore";
import { useFolders, folderStore } from "../../src/data/folders";
import { iconForCategory } from "../../src/data/categories";
import { isSupabaseConfigured } from "../../src/lib/supabase";
import { useAuth } from "../../src/lib/auth";
import { confirmDialog, alertDialog } from "../../src/lib/dialogs";
import { colors, maxContentWidth, radius, spacing } from "../../src/lib/theme";
import { Recipe } from "../../src/types/recipe";

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { recipes } = useRecipes();
  const { folders: activeFolders, managedNames } = useFolders();
  const { isEditor } = useAuth();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("");
  const [creating, setCreating] = useState(false);

  const counts = useMemo(() => recipeStore.countsByCategory(), [recipes]);

  // Active managed folders, plus any categories present in recipe data that
  // aren't managed yet (brand-new / unforeseen folders). Soft-deleted folders
  // stay hidden because their name is still in `managedNames`.
  const folders = useMemo(() => {
    const managed = activeFolders.map((f) => ({ name: f.name, icon: f.icon }));
    const extras = Object.keys(counts)
      .filter((name) => name && !managedNames.has(name))
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ name, icon: iconForCategory(name) }));
    return [...managed, ...extras];
  }, [activeFolders, managedNames, counts]);

  const onCreateFolder = async () => {
    const name = newName.trim();
    if (!name) return;
    if (folders.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      alertDialog("Folder exists", `There's already a “${name}” folder.`);
      return;
    }
    setCreating(true);
    try {
      await folderStore.create(name, newIcon);
      setShowCreate(false);
      setNewName("");
      setNewIcon("");
    } catch (e: any) {
      alertDialog("Couldn't create folder", e?.message ?? "Unknown error");
    } finally {
      setCreating(false);
    }
  };

  const onDeleteFolder = async (name: string, count: number) => {
    const warn =
      count > 0
        ? `\n\n${count} recipe${count === 1 ? "" : "s"} in this folder will be hidden from the folder list. Nothing is permanently deleted — the folder can be recovered.`
        : "";
    const ok = await confirmDialog(
      `Delete “${name}” folder?`,
      `This soft-deletes the folder.${warn}`,
      { confirmText: "Delete", destructive: true }
    );
    if (!ok) return;
    try {
      await folderStore.remove(name);
    } catch (e: any) {
      alertDialog("Couldn't delete folder", e?.message ?? "Unknown error");
    }
  };

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
          ListHeaderComponent={
            isEditor ? (
              <View style={styles.folderTools}>
                <Pressable
                  style={styles.toolBtn}
                  onPress={() => setShowCreate(true)}
                >
                  <Text style={styles.toolBtnText}>＋ New folder</Text>
                </Pressable>
                <Pressable
                  style={styles.toolBtn}
                  onPress={() => setEditing((e) => !e)}
                >
                  <Text style={styles.toolBtnText}>
                    {editing ? "Done" : "Edit"}
                  </Text>
                </Pressable>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <FolderRow
              icon={item.icon}
              name={item.name}
              count={counts[item.name] ?? 0}
              editing={editing && isEditor}
              onPress={() =>
                router.push(`/category/${encodeURIComponent(item.name)}`)
              }
              onDelete={() => onDeleteFolder(item.name, counts[item.name] ?? 0)}
            />
          )}
        />
      )}

      <Modal
        visible={showCreate}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreate(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setShowCreate(false)}
        >
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>New folder</Text>
            <Text style={styles.modalLabel}>Name</Text>
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Breakfast"
              placeholderTextColor={colors.textMuted}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={onCreateFolder}
            />
            <Text style={styles.modalLabel}>Icon (emoji, optional)</Text>
            <TextInput
              style={styles.modalInput}
              value={newIcon}
              onChangeText={setNewIcon}
              placeholder="📁"
              placeholderTextColor={colors.textMuted}
              maxLength={4}
            />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancel}
                onPress={() => setShowCreate(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalCreate,
                  (creating || !newName.trim()) && { opacity: 0.6 },
                ]}
                onPress={onCreateFolder}
                disabled={creating || !newName.trim()}
              >
                <Text style={styles.modalCreateText}>
                  {creating ? "Creating…" : "Create"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
  editing,
  onPress,
  onDelete,
}: {
  icon: string;
  name: string;
  count: number;
  editing: boolean;
  onPress: () => void;
  onDelete: () => void;
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
      {editing ? (
        <Pressable style={styles.deleteBtn} onPress={onDelete} hitSlop={8}>
          <Text style={styles.deleteBtnText}>Delete</Text>
        </Pressable>
      ) : (
        <Text style={styles.chevron}>›</Text>
      )}
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
  folderTools: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  toolBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  toolBtnText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  deleteBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.danger,
  },
  deleteBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  modalLabel: { fontSize: 13, fontWeight: "700", color: colors.text },
  modalInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  modalCancel: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  modalCancelText: { color: colors.textMuted, fontWeight: "600", fontSize: 15 },
  modalCreate: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  modalCreateText: { color: "#fff", fontWeight: "700", fontSize: 15 },
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
