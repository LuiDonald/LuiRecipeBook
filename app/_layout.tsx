import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "../src/lib/theme";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: "700" },
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ title: "My Recipes" }} />
          <Stack.Screen name="category/[name]" options={{ title: "Category" }} />
          <Stack.Screen name="recipe/[id]" options={{ title: "Recipe" }} />
          <Stack.Screen
            name="edit/[id]"
            options={{ title: "Edit Recipe", presentation: "modal" }}
          />
          <Stack.Screen
            name="login"
            options={{ title: "Log in", presentation: "modal" }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
