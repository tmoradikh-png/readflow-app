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
  DEFAULT_PREFERENCES,
  loadPreferences,
  ReadingPreferences,
  savePreferences,
} from "./src/services/Preferences";
import { theme } from "./src/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});
LogBox.ignoreLogs(["SherpaOnnxModelList: Unsupported model espeak-ng-data"]);

export default function App() {
  const [doc, setDoc] = useState<ParsedPdf | null>(null);
  const [item, setItem] = useState<LibraryItem | null>(null);
  const [entitlement, setEntitlement] = useState<EntitlementSnapshot>(FREE_ENTITLEMENT);
  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const [preferences, setPreferences] = useState<ReadingPreferences>(DEFAULT_PREFERENCES);

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

  useEffect(() => {
    fetchEntitlement().then(setEntitlement).catch(() => {});
    fetchUsage().then(setUsage).catch(() => {});
    loadPreferences().then(setPreferences).catch(() => {});
  }, []);

  const updatePreferences = useCallback((next: ReadingPreferences) => {
    setPreferences(next);
    savePreferences(next).catch(() => {});
  }, []);

  const refreshUsage = useCallback(() => {
    fetchUsage().then(setUsage).catch(() => {});
  }, []);

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
            language="en-US"
            freePageLimit={10}
            startSentenceId={item?.lastSentenceId ?? 0}
            onProgress={handleProgress}
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
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
});
