import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";

export interface ThemedNoticeAction {
  label: string;
  onPress?: () => void;
  tone?: "primary" | "danger" | "secondary";
}

interface Props {
  visible: boolean;
  title: string;
  body: string;
  primary?: ThemedNoticeAction;
  secondary?: ThemedNoticeAction;
  onClose: () => void;
}

export function ThemedNotice({
  visible,
  title,
  body,
  primary,
  secondary,
  onClose,
}: Props) {
  const main = primary ?? { label: "OK" };

  function press(action?: ThemedNoticeAction) {
    onClose();
    if (action?.onPress) setTimeout(action.onPress, 0);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.brandRow}>
            <View style={styles.mark}>
              <View style={styles.markSpine} />
              <Text style={styles.markText}>
                r<Text style={styles.markTextItalic}>F</Text>
              </Text>
            </View>
            <Text style={styles.eyebrow}>readFlow</Text>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>

          <View style={styles.actions}>
            {secondary ? (
              <Pressable
                style={[styles.button, styles.buttonSecondary]}
                onPress={() => press(secondary)}
              >
                <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
                  {secondary.label}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[
                styles.button,
                main.tone === "danger" ? styles.buttonDanger : styles.buttonPrimary,
              ]}
              onPress={() => press(main)}
            >
              <Text style={styles.buttonText}>{main.label}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(20,17,11,0.54)",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(3),
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing(2.25),
    shadowColor: "#281E0F",
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1.25),
  },
  mark: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: theme.colors.ink,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  markSpine: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 7,
    backgroundColor: theme.colors.accent,
  },
  markText: {
    color: "#F5EED8",
    fontFamily: theme.fonts.serifSemiBold,
    fontSize: 17,
    lineHeight: 22,
  },
  markTextItalic: {
    fontFamily: theme.fonts.serifItalic,
  },
  eyebrow: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.fonts.serifSemiBold,
    fontSize: 24,
    lineHeight: 30,
  },
  body: {
    color: theme.colors.textMute,
    fontFamily: theme.fonts.sans,
    fontSize: 15,
    lineHeight: 21,
    marginTop: theme.spacing(1),
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: theme.spacing(1),
    marginTop: theme.spacing(2),
  },
  button: {
    minWidth: 92,
    borderRadius: 8,
    paddingHorizontal: theme.spacing(1.5),
    paddingVertical: theme.spacing(1.25),
    alignItems: "center",
  },
  buttonPrimary: {
    backgroundColor: theme.colors.accent,
  },
  buttonDanger: {
    backgroundColor: theme.colors.danger,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  buttonText: {
    color: theme.colors.onAccent,
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: 14,
  },
  buttonTextSecondary: {
    color: theme.colors.text,
  },
});
