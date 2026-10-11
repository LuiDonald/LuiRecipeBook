import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth, sendMagicLink, signOut } from "../../src/lib/auth";
import { colors, maxContentWidth, radius, spacing } from "../../src/lib/theme";

export default function AccountScreen() {
  const { isSignedIn, isEditor, email } = useAuth();
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSend = async () => {
    const addr = value.trim();
    if (!addr || !addr.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setError(null);
    setSending(true);
    try {
      await sendMagicLink(addr);
      setSent(true);
    } catch (e: any) {
      setError(e?.message ?? "Could not send the link.");
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.body}>
        {isSignedIn ? (
          <>
            <Text style={styles.title}>You're signed in</Text>
            <Text style={styles.muted}>{email}</Text>
            <Text style={[styles.muted, { marginTop: spacing.sm }]}>
              {isEditor
                ? "You can add, edit, and delete recipes."
                : "This account is read-only. Only the owner can make changes."}
            </Text>
            <Pressable
              style={[styles.primaryBtn, { marginTop: spacing.xl }]}
              onPress={async () => {
                await signOut();
              }}
            >
              <Text style={styles.primaryBtnText}>Log out</Text>
            </Pressable>
          </>
        ) : sent ? (
          <>
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.muted}>
              We sent a sign-in link to {value.trim()}. Open it on this device
              to finish logging in.
            </Text>
            <Pressable
              style={[styles.secondaryBtn, { marginTop: spacing.xl }]}
              onPress={() => setSent(false)}
            >
              <Text style={styles.secondaryBtnText}>Use a different email</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.title}>Log in to edit</Text>
            <Text style={styles.muted}>
              Browsing is open to everyone — no login needed. Sign-in is
              restricted to the owner's account for editing; other emails
              won't receive a link.
            </Text>
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={setValue}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              inputMode="email"
              returnKeyType="send"
              onSubmitEditing={onSend}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <Pressable
              style={[styles.primaryBtn, sending && { opacity: 0.6 }]}
              onPress={onSend}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Send magic link</Text>
              )}
            </Pressable>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  body: {
    width: "100%",
    maxWidth: maxContentWidth,
    alignSelf: "center",
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { fontSize: 22, fontWeight: "700", color: colors.text },
  muted: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  input: {
    marginTop: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  error: { color: colors.danger, fontSize: 13 },
  primaryBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondaryBtn: {
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
  },
  secondaryBtnText: { color: colors.primary, fontWeight: "600" },
});
