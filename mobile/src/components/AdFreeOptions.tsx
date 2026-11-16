import React, { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { AdFreePlan, useAdFree } from "../services/AdFree";
import { useAppTheme } from "../theme";

export function AdFreeOptions({ onVisibilityChange }: { onVisibilityChange(value: boolean): void }) {
  const { colors, fonts } = useAppTheme();
  const billing = useAdFree();
  const [visible, setVisible] = useState(false);
  const [plans, setPlans] = useState<AdFreePlan[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => () => onVisibilityChange(false), [onVisibilityChange]);
  if (Platform.OS !== "android") return null;
  function close() { if (!busy) { setVisible(false); onVisibilityChange(false); } }
  async function open() {
    setVisible(true); onVisibilityChange(true); setBusy(true); setMessage(""); setPlans([]);
    try {
      const products = await billing.products();
      setPlans(products);
      if (!products.length) setMessage("Subscription prices are unavailable. You can still read and listen for free.");
    } catch { setMessage("Google Play is unavailable. Please try again later."); }
    finally { setBusy(false); }
  }
  async function buy(plan: AdFreePlan["id"]) {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const result = await billing.purchase(plan);
      setMessage(result === "active" ? "Your ad-free subscription is active. Thank you!"
        : result === "pending" ? "Payment is pending. Ad-free access starts when Google Play confirms it." : "Purchase cancelled.");
    } catch { setMessage("Payment could not be confirmed. Restore purchases or check Google Play before trying again."); }
    finally { setBusy(false); }
  }
  async function restore() {
    if (busy) return;
    setBusy(true);
    const result = await billing.refresh();
    setMessage(result?.active ? "Your ad-free subscription has been restored."
      : result?.pending ? "Google Play reports a pending payment."
      : result ? "No active ad-free subscription was found for this Google Play account."
      : "Google Play could not be checked. Ads remain paused; please try again later.");
    setBusy(false);
  }
  const text = { color: colors.text, fontFamily: fonts.sans, fontSize: 15 };
  const button = { padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginTop: 10 };
  return <>
    <Pressable accessibilityRole="button" onPress={() => void open()} style={{ padding: 12 }}>
      <Text style={{ ...text, textAlign: "center" }}>{billing.status === "active" ? "Ad-free subscription" : "Remove ads"}</Text>
    </Pressable>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", padding: 24, justifyContent: "center" }}>
        <ScrollView style={{ maxHeight: "90%", backgroundColor: colors.bg, borderRadius: 8 }} contentContainerStyle={{ padding: 20 }}>
          <Text accessibilityRole="header" style={{ ...text, fontSize: 22 }}>readFlow Ad-Free</Text>
          <Text style={{ ...text, marginVertical: 12 }}>Remove all ads while your subscription is active. Reading and listening remain free.</Text>
          {billing.status === "active" ? <Text style={text}>Ad-free is active.</Text> : <>
            {plans.map(plan => <Pressable key={plan.id} accessibilityRole="button"
              disabled={busy || billing.pending || billing.status !== "free"} onPress={() => void buy(plan.id)}
              style={[button, { opacity: busy || billing.pending || billing.status !== "free" ? 0.5 : 1 }]}>
              <Text style={text}>{plan.price} / {plan.id === "monthly" ? "month" : "year"}</Text>
            </Pressable>)}
            <Text style={{ ...text, fontSize: 13, marginTop: 12 }}>Auto-renews at the price shown for the selected period until cancelled. Payment is charged to your Google Play account. Cancel anytime in Google Play to stop the next renewal.</Text>
            {billing.pending && <Text style={text}>A payment is pending. No new purchase is needed.</Text>}
            {billing.status === "unavailable" && <Text style={text}>Connect to Google Play and restore purchases to check your subscription. Ads are paused until this check succeeds.</Text>}
          </>}
          {busy && <ActivityIndicator style={{ margin: 12 }} color={colors.text} />}
          {!!message && <Text accessibilityLiveRegion="polite" style={{ ...text, marginTop: 12 }}>{message}</Text>}
          <Pressable disabled={busy} onPress={() => void restore()} style={button}><Text style={text}>Restore purchases</Text></Pressable>
          <Pressable disabled={busy} onPress={() => {
            void Linking.openURL("https://play.google.com/store/account/subscriptions?sku=readflow_ad_free&package=com.urmiaworks.readflow")
              .catch(() => setMessage("Open Google Play, then Payments & subscriptions to manage your subscription."));
          }} style={button}><Text style={text}>Manage subscription</Text></Pressable>
          <Pressable onPress={() => { void Linking.openURL("https://urmiaworks.com/readflow/privacy").catch(() => setMessage("Privacy policy: https://urmiaworks.com/readflow/privacy")); }} style={button}>
            <Text style={text}>Privacy policy</Text>
          </Pressable>
          <Pressable disabled={busy} onPress={close} style={button}><Text style={text}>Close</Text></Pressable>
        </ScrollView>
      </View>
    </Modal>
  </>;
}
