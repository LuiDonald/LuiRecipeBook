import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Tiny per-device key/value storage: localStorage on web, AsyncStorage on
 * native. Failures (private browsing, quota, unavailable storage) are swallowed
 * so callers can treat storage as best-effort.
 */

export async function loadRaw(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  }
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export function saveRaw(key: string, value: string): void {
  if (Platform.OS === "web") {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore quota / unavailable */
    }
    return;
  }
  void AsyncStorage.setItem(key, value).catch(() => {});
}
