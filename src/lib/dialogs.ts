import { Alert, Platform } from "react-native";

/**
 * Cross-platform confirmation dialog.
 *
 * React Native's `Alert.alert` is a no-op on react-native-web, so on web we
 * fall back to the browser's native `confirm()`. Resolves true if the user
 * confirms, false otherwise.
 */
export function confirmDialog(
  title: string,
  message?: string,
  opts?: { confirmText?: string; cancelText?: string; destructive?: boolean }
): Promise<boolean> {
  if (Platform.OS === "web") {
    const text = message ? `${title}\n\n${message}` : title;
    const ok =
      typeof window !== "undefined" && typeof window.confirm === "function"
        ? window.confirm(text)
        : false;
    return Promise.resolve(ok);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      {
        text: opts?.cancelText ?? "Cancel",
        style: "cancel",
        onPress: () => resolve(false),
      },
      {
        text: opts?.confirmText ?? "OK",
        style: opts?.destructive ? "destructive" : "default",
        onPress: () => resolve(true),
      },
    ]);
  });
}

/** Cross-platform message dialog (works on web, where Alert.alert is a no-op). */
export function alertDialog(title: string, message?: string): void {
  if (Platform.OS === "web") {
    const text = message ? `${title}\n\n${message}` : title;
    if (typeof window !== "undefined" && typeof window.alert === "function") {
      window.alert(text);
    }
    return;
  }
  Alert.alert(title, message);
}
