import React, { useCallback, useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { LogBox, View, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import {
  Spectral_400Regular,
  Spectral_400Regular_Italic,
  Spectral_500Medium,
  Spectral_600SemiBold,
} from "@expo-google-fonts/spectral";
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from "@expo-google-fonts/hanken-grotesk";
import { LibraryScreen } from "./src/screens/LibraryScreen";
import { Reader } from "./src/components/Reader";
import { ParsedPdf } from "./src/services/PDFParser";
import { Library, LibraryItem } from "./src/services/Library";
import {
  EntitlementSnapshot,
  FREE_ENTITLEMENT,
  fetchEntitlement,
  fetchUsage,
  UsageSnapshot,
} from "./src/services/Entitlements";
import {
  isRevenueCatCancellation,
  purchaseRevenueCatPlan,
  refreshRevenueCatOfferings,
  restoreRevenueCatPurchases,
  revenueCatErrorMessage,
  type PurchaseBilling,
  type PurchaseTierKey,
} from "./src/services/RevenueCat";
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  ReadingPreferences,
  savePreferences,
} from "./src/services/Preferences";
import { getReadingLanguage } from "./src/services/ReadingLanguages";
import { theme } from "./src/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});
LogBox.ignoreLogs(["SherpaOnnxModelList: Unsupported model espeak-ng-data"]);

export default function App() {
  const [doc, setDoc] = useState<ParsedPdf | null>(null);
  const [item, setItem] = useState<LibraryItem | null>(null);
  const [entitlement, setEntitlement] = useState<EntitlementSnapshot>(FREE_ENTITLEMENT);
  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const [preferences, setPreferences] = useState<ReadingPreferences>(DEFAULT_PREFERENCES);
  const [purchaseSetupLoading, setPurchaseSetupLoading] = useState(true);
  const [purchasingAvailable, setPurchasingAvailable] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const readingLanguage = getReadingLanguage(preferences.bookLanguage);

  const [fontsLoaded] = useFonts({
    Spectral_400Regular,
    Spectral_400Regular_Italic,
    Spectral_500Medium,
    Spectral_600SemiBold,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  const refreshEntitlementAndUsage = useCallback(async () => {
    const [nextEntitlement, nextUsage] = await Promise.all([
      fetchEntitlement(),
      fetchUsage(),
    ]);
    setEntitlement(nextEntitlement);
    setUsage(nextUsage);
  }, []);

  const refreshPurchaseSetup = useCallback(async () => {
    setPurchaseSetupLoading(true);
    try {
      const status = await refreshRevenueCatOfferings();
      setPurchasingAvailable(status.available);
      setPurchaseError(status.configured && status.message ? status.message : null);
    } catch (err) {
      setPurchasingAvailable(false);
      setPurchaseError(revenueCatErrorMessage(err));
    } finally {
      setPurchaseSetupLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshEntitlementAndUsage().catch(() => {});
    refreshPurchaseSetup().catch(() => {});
    loadPreferences().then(setPreferences).catch(() => {});
  }, [refreshEntitlementAndUsage, refreshPurchaseSetup]);

  const updatePreferences = useCallback((next: ReadingPreferences) => {
    setPreferences(next);
    savePreferences(next).catch(() => {});
  }, []);

  const refreshUsage = useCallback(() => {
    fetchUsage().then(setUsage).catch(() => {});
  }, []);

  const handlePurchasePlan = useCallback(
    async (planKey: PurchaseTierKey, billing: PurchaseBilling) => {
      setPurchasing(true);
      setPurchaseError(null);
      try {
        await purchaseRevenueCatPlan(planKey, billing);
        await refreshEntitlementAndUsage();
        await refreshPurchaseSetup();
      } catch (err) {
        if (!isRevenueCatCancellation(err)) {
          setPurchaseError(revenueCatErrorMessage(err));
        }
      } finally {
        setPurchasing(false);
      }
    },
    [refreshEntitlementAndUsage, refreshPurchaseSetup]
  );

  const handleRestorePurchases = useCallback(async () => {
    setPurchasing(true);
    setPurchaseError(null);
    try {
      await restoreRevenueCatPurchases();
      await refreshEntitlementAndUsage();
      await refreshPurchaseSetup();
    } catch (err) {
      if (!isRevenueCatCancellation(err)) {
        setPurchaseError(revenueCatErrorMessage(err));
      }
    } finally {
      setPurchasing(false);
    }
  }, [refreshEntitlementAndUsage, refreshPurchaseSetup]);

  const openDoc = useCallback((d: ParsedPdf, it: LibraryItem) => {
    setItem(it);
    setDoc(d);
  }, []);

  const handleProgress = useCallback(
    (page: number, sentenceId: number, totalPages: number) => {
      if (!doc) return;
      Library.updateProgress(doc.docId, {
        lastPage: page,
        lastSentenceId: sentenceId,
        totalPages,
      }).catch(() => {});
    },
    [doc]
  );

  if (!fontsLoaded) return null; // native splash stays up until fonts are ready

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="dark" />
        {doc ? (
          <Reader
            doc={doc}
            entitlement={entitlement}
            preferences={preferences}
            onPreferencesChange={updatePreferences}
            language={readingLanguage.voiceLanguage}
            freePageLimit={entitlement.limits.perDocPageCap ?? 100}
            startSentenceId={item?.lastSentenceId ?? 0}
            onProgress={handleProgress}
            purchasingAvailable={purchasingAvailable}
            purchaseSetupLoading={purchaseSetupLoading}
            purchasing={purchasing}
            purchaseError={purchaseError}
            onPurchasePlan={handlePurchasePlan}
            onRestorePurchases={handleRestorePurchases}
            onBack={() => {
              setDoc(null);
              setItem(null);
            }}
          />
        ) : (
          <LibraryScreen
            onOpen={openDoc}
            entitlement={entitlement}
            usage={usage}
            preferences={preferences}
            onPreferencesChange={updatePreferences}
            onRefreshUsage={refreshUsage}
            purchasingAvailable={purchasingAvailable}
            purchaseSetupLoading={purchaseSetupLoading}
            purchasing={purchasing}
            purchaseError={purchaseError}
            onPurchasePlan={handlePurchasePlan}
            onRestorePurchases={handleRestorePurchases}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
});
