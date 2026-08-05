import React, { useCallback, useEffect, useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { AppState, LogBox, View, StyleSheet } from "react-native";
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
  entitlementForRevenueCatTier,
  fetchEntitlement,
  fetchUsage,
  UsageSnapshot,
} from "./src/services/Entitlements";
import {
  activeRevenueCatTier,
  isRevenueCatCancellation,
  purchaseRevenueCatPlan,
  refreshRevenueCatCustomerInfo,
  refreshRevenueCatOfferings,
  restoreRevenueCatPurchases,
  revenueCatErrorMessage,
  subscribeRevenueCatCustomerInfoUpdates,
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
import { AppTheme, ThemeProvider, useAppTheme, useThemedStyles } from "./src/theme";
import { ReadingPosition } from "./src/services/ReadingPosition";

SplashScreen.preventAutoHideAsync().catch(() => {});
LogBox.ignoreLogs(["SherpaOnnxModelList: Unsupported model espeak-ng-data"]);

const ENTITLEMENT_RANK: Record<string, number> = {
  free: 0,
  reader_plus: 1,
  reviewer: 2,
  ai_pro: 3,
  power: 4,
};

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export default function App() {
  return (
    <ThemeProvider>
      <ReadFlowApp />
    </ThemeProvider>
  );
}

function ReadFlowApp() {
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [doc, setDoc] = useState<ParsedPdf | null>(null);
  const [item, setItem] = useState<LibraryItem | null>(null);
  const [entitlement, setEntitlement] = useState<EntitlementSnapshot>(FREE_ENTITLEMENT);
  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const [preferences, setPreferences] = useState<ReadingPreferences>(DEFAULT_PREFERENCES);
  const [purchaseSetupLoading, setPurchaseSetupLoading] = useState(true);
  const [purchasingAvailable, setPurchasingAvailable] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const progressWriteRef = useRef<Promise<void>>(Promise.resolve());
  const entitlementRefreshIdRef = useRef(0);
  const entitlementSyncRef = useRef<Promise<EntitlementSnapshot | null> | null>(null);
  const entitlementSyncTargetRankRef = useRef(0);
  const revenueCatTierRef = useRef<PurchaseTierKey | null>(null);
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

  const refreshEntitlementAndUsage = useCallback(async (forceRefresh = false) => {
    const refreshId = ++entitlementRefreshIdRef.current;
    const nextEntitlement = forceRefresh
      ? await fetchEntitlement(true)
      : await fetchEntitlement();
    const nextUsage = await fetchUsage();
    if (refreshId === entitlementRefreshIdRef.current) {
      const revenueCatTier = revenueCatTierRef.current;
      const effectiveEntitlement =
        revenueCatTier &&
        (ENTITLEMENT_RANK[nextEntitlement.tier] || 0) < ENTITLEMENT_RANK[revenueCatTier]
          ? entitlementForRevenueCatTier(revenueCatTier)
          : nextEntitlement;
      setEntitlement(effectiveEntitlement);
      setUsage(nextUsage);
      return effectiveEntitlement;
    }
    return nextEntitlement;
  }, []);

  const syncRevenueCatEntitlement = useCallback(
    (customerInfo: Parameters<typeof activeRevenueCatTier>[0]) => {
      const purchasedTier = activeRevenueCatTier(customerInfo);
      if (!purchasedTier) return Promise.resolve(null);
      revenueCatTierRef.current = purchasedTier;
      setEntitlement((current) =>
        (ENTITLEMENT_RANK[current.tier] || 0) >= (ENTITLEMENT_RANK[purchasedTier] || 0)
          ? current
          : entitlementForRevenueCatTier(purchasedTier)
      );
      entitlementSyncTargetRankRef.current = Math.max(
        entitlementSyncTargetRankRef.current,
        ENTITLEMENT_RANK[purchasedTier] || 0
      );
      if (entitlementSyncRef.current) return entitlementSyncRef.current;

      const sync = (async () => {
        for (const delay of [0, 500, 1200, 2500]) {
          if (delay) await wait(delay);
          const next = await refreshEntitlementAndUsage(true);
          if (
            (ENTITLEMENT_RANK[next.tier] || 0) >= entitlementSyncTargetRankRef.current
          ) {
            setPurchaseError(null);
            return next;
          }
        }
        setPurchaseError(
          "Google Play confirmed your purchase, but readFlow is still syncing it. Tap Restore purchases in a moment."
        );
        return null;
      })().finally(() => {
        entitlementSyncRef.current = null;
        entitlementSyncTargetRankRef.current = 0;
      });
      entitlementSyncRef.current = sync;
      return sync;
    },
    [refreshEntitlementAndUsage]
  );

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

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    const handleCustomerInfo = (customerInfo: Parameters<typeof activeRevenueCatTier>[0]) => {
      if (!active || !activeRevenueCatTier(customerInfo)) return;
      syncRevenueCatEntitlement(customerInfo).catch(() => {});
    };

    subscribeRevenueCatCustomerInfoUpdates(handleCustomerInfo)
      .then((remove) => {
        if (active) unsubscribe = remove;
        else remove();
      })
      .catch(() => {});
    refreshRevenueCatCustomerInfo().then((info) => info && handleCustomerInfo(info)).catch(() => {});

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      refreshRevenueCatCustomerInfo()
        .then((info) => info && handleCustomerInfo(info))
        .catch(() => {});
    });

    return () => {
      active = false;
      unsubscribe();
      appStateSubscription.remove();
    };
  }, [syncRevenueCatEntitlement]);

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
        const result = await purchaseRevenueCatPlan(planKey, billing);
        await syncRevenueCatEntitlement(result.customerInfo);
        await refreshPurchaseSetup();
      } catch (err) {
        if (!isRevenueCatCancellation(err)) {
          setPurchaseError(revenueCatErrorMessage(err));
        }
      } finally {
        setPurchasing(false);
      }
    },
    [refreshPurchaseSetup, syncRevenueCatEntitlement]
  );

  const handleRestorePurchases = useCallback(async () => {
    setPurchasing(true);
    setPurchaseError(null);
    try {
      const customerInfo = await restoreRevenueCatPurchases();
      const restoredTier = activeRevenueCatTier(customerInfo);
      if (!restoredTier) {
        setPurchaseError("No active Google Play subscription was found for this account.");
      } else {
        await syncRevenueCatEntitlement(customerInfo);
      }
      await refreshPurchaseSetup();
    } catch (err) {
      if (!isRevenueCatCancellation(err)) {
        setPurchaseError(revenueCatErrorMessage(err));
      }
    } finally {
      setPurchasing(false);
    }
  }, [refreshPurchaseSetup, syncRevenueCatEntitlement]);

  const openDoc = useCallback((d: ParsedPdf, it: LibraryItem) => {
    setItem(it);
    setDoc(d);
  }, []);

  const handleProgress = useCallback(
    (position: ReadingPosition, totalPages: number) => {
      if (!doc) return Promise.resolve();
      const docId = doc.docId;
      const write = progressWriteRef.current.then(() =>
        Library.updateProgress(docId, {
          lastPage: position.page,
          lastSentenceId: position.sentenceId,
          lastPageSentenceIndex: position.pageSentenceIndex,
          lastPreview: position.preview,
          totalPages,
        })
      );
      progressWriteRef.current = write.catch(() => {});
      return progressWriteRef.current;
    },
    [doc]
  );

  if (!fontsLoaded) return null; // native splash stays up until fonts are ready

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style={theme.colors.bg === "#171A18" ? "light" : "dark"} />
        {doc ? (
          <Reader
            doc={doc}
            entitlement={entitlement}
            preferences={preferences}
            onPreferencesChange={updatePreferences}
            language={readingLanguage.voiceLanguage}
            freePageLimit={entitlement.limits.perDocPageCap ?? 100}
            startPosition={{
              page: item?.lastPage ?? 1,
              pageSentenceIndex: item?.lastPageSentenceIndex ?? 0,
              sentenceId: item?.lastSentenceId ?? 0,
              preview: item?.lastPreview ?? "",
            }}
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
            onRefreshEntitlement={() => refreshEntitlementAndUsage().then(() => {})}
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

const createStyles = (theme: AppTheme) => ({
  root: { flex: 1, backgroundColor: theme.colors.bg },
});
