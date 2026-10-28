import * as ImagePicker from "expo-image-picker";

/**
 * Pick an existing photo from the device library.
 * Returns a local URI, or null if cancelled.
 *
 * NOTE: For now this returns the *local* URI. When Supabase Storage is wired
 * up (Phase 2/3), this URI will be uploaded and replaced with a public URL.
 */
export async function pickImageFromLibrary(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8,
  });

  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0].uri;
}

/**
 * Pick one or more photos from the device library.
 * Returns an array of local URIs (empty if cancelled).
 */
export async function pickImagesFromLibrary(): Promise<string[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return [];

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    quality: 0.7,
  });

  if (result.canceled || !result.assets?.length) return [];
  return result.assets.map((a) => a.uri);
}

/**
 * Open the camera to take a new photo. Returns a local URI, or null.
 * This is the entry point for the future "snap food -> AI recipe" feature.
 */
export async function takePhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8,
  });

  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0].uri;
}
