import { Tabs } from "expo-router";
import { Text } from "react-native";
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
  const showReview = isEditor && pending.length > 0;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "700" },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
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
