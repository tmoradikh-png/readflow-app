import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, NativeModules, Pressable, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppTheme } from "../theme";
import { DAY_MS, dismissSupport, shouldOfferSupport, SupportState, visitSupport } from "../services/SupportPolicy";

const KEY = "readflow.support.v1";
type Product = { id: string; price: string };
const billing = NativeModules.ReadFlowSupport as undefined | {
  product(): Promise<Product | null>;
  purchase(): Promise<"purchased" | "cancelled" | "pending">;
  lastSupport(): Promise<number>;
  recover(): Promise<void>;
};

export function SupportPrompt({ hasBooks }: { hasBooks: boolean }) {
  const { colors, fonts } = useAppTheme();
  const [visible, setVisible] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const state = useRef<SupportState | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    (async () => {
      const raw = await AsyncStorage.getItem(KEY);
      const saved = raw ? JSON.parse(raw) as SupportState : null;
      const next = visitSupport(saved, Date.now());
      state.current = next;
      await AsyncStorage.setItem(KEY, JSON.stringify(next));
      if (!billing || !hasBooks) return;
      const lastSupport = await billing.lastSupport();
      if (!shouldOfferSupport(next, Date.now(), lastSupport)) return;
      const offer = await billing.product();
      if (!active || !offer) return;
      next.nextPrompt = Date.now() + 30 * DAY_MS;
      await AsyncStorage.setItem(KEY, JSON.stringify(next));
      if (!active) return;
      setProduct(offer);
      setVisible(true);
    })().catch(() => {}); // Storage/payment failure never blocks reading or shows an automatic prompt.
    return () => { active = false; mounted.current = false; };
  }, [hasBooks]);

  async function open() {
    setVisible(true);
    setBusy(true);
    setMessage("");
    try {
      const offer = await billing?.product();
      if (!mounted.current) return;
      setProduct(offer || null);
      if (!offer) setMessage("Support payments are unavailable right now. Reading stays free.");
    } catch {
      if (mounted.current) setMessage("Google Play is unavailable. Reading stays free.");
    } finally { if (mounted.current) setBusy(false); }
  }
  async function dismiss(neverAsk = false) {
    setVisible(false);
    const next = dismissSupport(state.current, Date.now(), neverAsk);
    state.current = next;
    await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }
  async function support() {
    if (busy || !billing || !product) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await billing.purchase();
      if (!mounted.current) return;
      if (result === "cancelled") { await dismiss(); return; }
      setProduct(null);
      setMessage(result === "pending" ? "Payment is pending with Google Play. Please do not pay again." : "Thank you for supporting readFlow.");
      const next = { ...(state.current || visitSupport(null, Date.now())), nextPrompt: Date.now() + 180 * DAY_MS };
      state.current = next;
      await AsyncStorage.setItem(KEY, JSON.stringify(next));
    } catch (error: any) {
      if (mounted.current) setMessage(error?.message || "Payment could not be confirmed. Check Google Play before trying again.");
    } finally { if (mounted.current) setBusy(false); }
  }
  const text = { color: colors.text, fontFamily: fonts.sans, fontSize: 14 };
  if (!visible) return (
    <Pressable onPress={open} accessibilityRole="button" style={{ alignSelf: "flex-end", paddingHorizontal: 20, paddingVertical: 8 }}>
      <Text style={{ ...text, color: colors.accent }}>Support readFlow</Text>
    </Pressable>
  );
  return (
    <View style={{ paddingHorizontal: 20, paddingVertical: 12, gap: 8, borderBottomWidth: 1, borderColor: colors.border }}>
      <Text style={{ ...text, fontFamily: fonts.sansSemiBold }}>Support readFlow</Text>
      <Text style={text}>{message || "Enjoying readFlow? An optional one-time contribution helps support the app. No subscription or extra features."}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
        {busy ? <ActivityIndicator color={colors.accent} /> : product ? (
          <Pressable onPress={support} accessibilityRole="button" style={{ paddingVertical: 8 }}>
            <Text style={{ ...text, color: colors.accent }}>Contribute {product.price}</Text>
          </Pressable>
        ) : null}
        <Pressable disabled={busy} onPress={() => void dismiss()} accessibilityRole="button" style={{ paddingVertical: 8 }}>
          <Text style={text}>Not now</Text>
        </Pressable>
        <Pressable disabled={busy} onPress={() => void dismiss(true)} accessibilityRole="button" style={{ paddingVertical: 8 }}>
          <Text style={text}>Don't ask again</Text>
        </Pressable>
      </View>
    </View>
  );
}
