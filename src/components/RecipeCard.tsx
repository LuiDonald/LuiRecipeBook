import { Image } from "react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Recipe } from "../types/recipe";
import { colors, radius, spacing } from "../lib/theme";

interface Props {
  recipe: Recipe;
  onPress: () => void;
  /** Fixed card width. When omitted the card flexes to fill its column. */
  width?: number;
}

export function RecipeCard({ recipe, onPress, width }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        width != null ? { width } : { flex: 1 },
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.imageWrap}>
        {recipe.photoUrl ? (
          <Image source={{ uri: recipe.photoUrl }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Text style={styles.placeholderText}>No photo</Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {recipe.title || "Untitled recipe"}
        </Text>
        {recipe.tags.length > 0 && (
          <Text style={styles.tags} numberOfLines={1}>
            {recipe.tags.join(" · ")}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.85,
  },
  imageWrap: {
    aspectRatio: 1,
    backgroundColor: colors.primarySoft,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  body: {
    padding: spacing.md,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  tags: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
