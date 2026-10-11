import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/lib/auth";
import { usePendingRecipes } from "../../src/data/recipeStore";
import { colors } from "../../src/lib/theme";

/** Simple emoji tab icon (no icon library needed). */
function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.6 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  const { isEditor, isSignedIn } = useAuth();
  const { pending } = usePendingRecipes();
  const insets = useSafeAreaInsets();
  const showReview = isEditor && pending.length > 0;
  // Use the real safe-area inset (iPhone home indicator) when available,
  // with a sensible floor for browsers/devices that report 0.
  const bottomPad = Math.max(insets.bottom, 16);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "700" },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        // Reserve room for the iPhone home indicator so labels aren't clipped.
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 56 + bottomPad,
          paddingBottom: bottomPad + 8,
          paddingTop: 8,
        },
        // Center icon+label as a group; the extra paddingBottom lifts the
        // labels clear of the bar's bottom edge so descenders aren't clipped.
        tabBarItemStyle: { paddingVertical: 2 },
        tabBarLabelStyle: { fontSize: 11, lineHeight: 14, marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "My Recipes",
          tabBarLabel: "Recipes",
          tabBarIcon: ({ focused }) => <TabIcon emoji="🍳" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="shopping"
        options={{
          title: "Shopping list",
          tabBarLabel: "Shopping",
          tabBarIcon: ({ focused }) => <TabIcon emoji="🛒" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="review"
        options={{
          title: "Review queue",
          tabBarLabel: "Review",
          tabBarIcon: ({ focused }) => <TabIcon emoji="📥" focused={focused} />,
          tabBarBadge: pending.length > 0 ? pending.length : undefined,
          // Hide the tab unless the owner has something to review.
          href: showReview ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: isSignedIn ? "Account" : "Log in",
          tabBarLabel: "Account",
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
