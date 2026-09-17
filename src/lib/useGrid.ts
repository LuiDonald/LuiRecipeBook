import { useWindowDimensions } from "react-native";
import { maxContentWidth, spacing } from "./theme";

/**
 * Computes a responsive grid layout that keeps recipe cards a friendly,
 * consistent size regardless of screen width:
 *  - narrow phones -> 2 columns
 *  - wide desktop browsers -> more columns (content capped at maxContentWidth)
 */
export function useGrid(targetCardWidth = 200) {
  const { width } = useWindowDimensions();
  const gap = spacing.lg;
  const padding = spacing.lg;

  const containerWidth = Math.min(width, maxContentWidth);
  const available = containerWidth - padding * 2;

  const columns = Math.max(
    2,
    Math.floor((available + gap) / (targetCardWidth + gap))
  );
  const cardWidth = Math.floor((available - gap * (columns - 1)) / columns);

  return { columns, cardWidth, containerWidth, gap, padding };
}
