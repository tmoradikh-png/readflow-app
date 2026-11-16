import React, { useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform, Pressable, Text, View } from "react-native";
import Constants from "expo-constants";
import mobileAds, {
  AdsConsent, AdsConsentPrivacyOptionsRequirementStatus,
  BannerAd, BannerAdSize, MaxAdContentRating, TestIds,
} from "react-native-google-mobile-ads";
import { useAppTheme } from "../theme";
import { libraryInterstitial } from "../services/LibraryInterstitial";
import { useAdFree } from "../services/AdFree";

let initialized: Promise<unknown> | null = null;
let consentUpdated = false;

export async function initializeAds() {
  if (!initialized) {
    initialized = (async () => {
      await mobileAds().setRequestConfiguration({ maxAdContentRating: MaxAdContentRating.PG });
      // Android's mute setter throws natively until SDK initialization completes.
      const status = await mobileAds().initialize();
      await mobileAds().setAppMuted(true);
      await mobileAds().setAppVolume(0);
      return status;
    })().catch(error => { initialized = null; throw error; });
  }
  return initialized;
}

// Ad loading starts only here, outside books. No document metadata is sent to the SDK.
export function LibraryAds({ available }: { available: boolean }) {
  const { canShowAds } = useAdFree();
  const { colors, fonts } = useAppTheme();
  const [bannerWidth, setBannerWidth] = useState(0);
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
    if (!available || !canShowAds || !foreground || privacyBusy || Platform.OS !== "android" || !unitId) return;
    (async () => {
      if (!consentUpdated) {
        try {
          await AdsConsent.requestInfoUpdate();
          if (!active) return;
          await AdsConsent.loadAndShowConsentFormIfRequired();
          consentUpdated = true;
        } catch {
          // UMP may still permit ads using consent from the previous session.
          // Never infer permission locally; getConsentInfo below remains the gate.
        }
      }
      if (!active) return;
      const info = await AdsConsent.getConsentInfo();
      if (!active) return;
      setPrivacyRequired(info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED);
      libraryInterstitial.setConsent(info.canRequestAds);
      if (!info.canRequestAds) return;
      await initializeAds();
      if (active) { setReady(true); libraryInterstitial.prepare(); }
    })().catch(() => {}); // Offline/consent/ad errors never block access to books.
    return () => { active = false; };
  }, [available, canShowAds, foreground, privacyBusy, revision, unitId]);

  async function privacy() {
    if (privacyBusy) return;
    libraryInterstitial.setConsent(false);
    setReady(false);
    setPrivacyBusy(true);
    setMessage("");
    try {
      // UMP preloads this form after the launch-time update; do not restart it here.
      const info = await AdsConsent.getConsentInfo();
      if (!mounted.current) return;
      if (info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED) {
        await AdsConsent.showPrivacyOptionsForm();
      } else {
        await Linking.openURL(String(extra?.privacyPolicy || "https://urmiaworks.com/readflow/privacy"));
      }
    } catch {
      if (mounted.current) setMessage("Privacy options are unavailable. Please try again in a moment.");
    } finally {
      if (mounted.current) {
        setPrivacyBusy(false);
        setRevision(value => value + 1);
      }
    }
  }

  if (Platform.OS !== "android" || !available) return null;
  return (
    <View onLayout={event => setBannerWidth(Math.max(0, Math.floor(event.nativeEvent.layout.width)))}
      style={{ width: "100%", borderTopWidth: 1, borderColor: colors.border, paddingTop: 12, alignItems: "center", gap: 8 }}>
      {canShowAds && ready && foreground && !privacyBusy && bannerWidth > 0 && (
        <View style={{ width: bannerWidth, minHeight: 50, alignItems: "center" }}>
          <Text style={{ color: colors.textMute, fontFamily: fonts.sans, fontSize: 11 }}>Advertisement</Text>
          {/* Keep mounted after no-fill/network errors so the SDK can refresh. */}
          <BannerAd key={`${bannerWidth}-${revision}`} unitId={unitId}
            width={bannerWidth} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
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
