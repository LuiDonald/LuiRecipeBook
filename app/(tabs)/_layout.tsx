import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/lib/auth";
import { colors } from "../../src/lib/theme";

/** Simple emoji tab icon (no icon library needed). */
function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 24, opacity: focused ? 1 : 0.55 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  const { isSignedIn } = useAuth();
  const insets = useSafeAreaInsets();
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
        // Icon-only tab bar — avoids RN's clipped fixed-height label box and
        // reads cleanly above the iPhone home indicator.
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 48 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 8,
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
