import React, { useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform, Pressable, Text, View, useWindowDimensions } from "react-native";
import Constants from "expo-constants";
import mobileAds, {
  AdsConsent, AdsConsentPrivacyOptionsRequirementStatus,
  BannerAd, BannerAdSize, MaxAdContentRating, TestIds,
} from "react-native-google-mobile-ads";
import { useAppTheme } from "../theme";

let initialized: Promise<unknown> | null = null;
let consentUpdated = false;

async function initializeAds() {
  if (!initialized) {
    initialized = (async () => {
      await mobileAds().setRequestConfiguration({ maxAdContentRating: MaxAdContentRating.PG });
      mobileAds().setAppMuted(true);
      return mobileAds().initialize();
    })().catch(error => { initialized = null; throw error; });
  }
  return initialized;
}

// Only this library component can request ads. No document metadata is passed to the SDK.
export function LibraryAds({ available }: { available: boolean }) {
  const { colors, fonts } = useAppTheme();
  const { width } = useWindowDimensions();
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const [ready, setReady] = useState(false);
  const [privacyRequired, setPrivacyRequired] = useState(false);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  const mounted = useRef(true);
  const extra = Constants.expoConfig?.extra;
  const testAds = __DEV__ || extra?.adsTestMode !== false;
  const unitId = testAds ? TestIds.BANNER : extra?.admobBannerId;

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener("change", state => setForeground(state === "active"));
    return () => { mounted.current = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    let active = true;
    setReady(false);
    if (!available || !foreground || privacyBusy || Platform.OS !== "android" || !unitId) return;
    (async () => {
      if (!consentUpdated) {
        await AdsConsent.requestInfoUpdate();
        if (!active) return;
        await AdsConsent.loadAndShowConsentFormIfRequired();
        consentUpdated = true;
      }
      const info = await AdsConsent.getConsentInfo();
      if (!active) return;
      setPrivacyRequired(info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED);
      if (!info.canRequestAds) return;
      await initializeAds();
      if (active) setReady(true);
    })().catch(() => {}); // Offline/consent/ad errors never block access to books.
    return () => { active = false; };
  }, [available, foreground, privacyBusy, revision, unitId]);

  async function privacy() {
    if (privacyBusy) return;
    setReady(false);
    setPrivacyBusy(true);
    setMessage("");
    try {
      const info = await AdsConsent.requestInfoUpdate();
      if (!mounted.current) return;
      if (info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED) {
        await AdsConsent.showPrivacyOptionsForm();
      } else {
        await Linking.openURL(String(extra?.privacyPolicy || "https://urmiaworks.com/readflow/privacy"));
      }
    } catch {
      if (mounted.current) setMessage("Privacy options are unavailable. Please try again when online.");
    } finally {
      if (mounted.current) {
        setPrivacyBusy(false);
        setRevision(value => value + 1);
      }
    }
  }

  if (Platform.OS !== "android" || !available) return null;
  return (
    <View style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 12, alignItems: "center", gap: 8 }}>
      {ready && foreground && !privacyBusy && (
        <View style={{ width: Math.floor(width), minHeight: 50, alignItems: "center" }}>
          <Text style={{ color: colors.textMute, fontFamily: fonts.sans, fontSize: 11 }}>Advertisement</Text>
          <BannerAd key={`${Math.floor(width)}-${revision}`} unitId={unitId} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            onAdFailedToLoad={() => setReady(false)} />
        </View>
      )}
      <Pressable accessibilityRole="button" disabled={privacyBusy} onPress={privacy} style={{ padding: 10 }}>
        <Text style={{ color: colors.text, fontFamily: fonts.sans, fontSize: 12 }}>
          {privacyRequired ? "Ad privacy choices" : "Privacy"}
        </Text>
      </Pressable>
      {!!message && <Text style={{ color: colors.text, fontFamily: fonts.sans, paddingHorizontal: 20, fontSize: 12 }}>{message}</Text>}
    </View>
  );
}
