import React, { useCallback, useEffect, useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { AppState, LogBox, View } from "react-native";
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
import { FREE_ENTITLEMENT } from "./src/services/Entitlements";
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  ReadingPreferences,
  savePreferences,
} from "./src/services/Preferences";
import { getReadingLanguage } from "./src/services/ReadingLanguages";
import { AppTheme, ThemeProvider, useAppTheme, useThemedStyles } from "./src/theme";
import { ReadingPosition } from "./src/services/ReadingPosition";
import { AdFreeProvider } from "./src/services/AdFree";
import { libraryInterstitial } from "./src/services/LibraryInterstitial";

SplashScreen.preventAutoHideAsync().catch(() => {});
LogBox.ignoreLogs(["SherpaOnnxModelList: Unsupported model espeak-ng-data"]);

export default function App() {
  return (
    <ThemeProvider>
      <AdFreeProvider><ReadFlowApp /></AdFreeProvider>
    </ThemeProvider>
  );
}

function ReadFlowApp() {
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [doc, setDoc] = useState<ParsedPdf | null>(null);
  const [item, setItem] = useState<LibraryItem | null>(null);
  const entitlement = FREE_ENTITLEMENT;
  const [preferences, setPreferences] = useState<ReadingPreferences>(DEFAULT_PREFERENCES);
  const progressWriteRef = useRef<Promise<void>>(Promise.resolve());
  const readerOpen = useRef(false);
  const readingStarted = useRef(0);
  const readingMs = useRef(0);
  const closeGeneration = useRef(0);
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

  useEffect(() => {
    loadPreferences().then(setPreferences).catch(() => {});
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => {
      if (!readerOpen.current) return;
      if (readingStarted.current) readingMs.current += Math.max(0, Date.now() - readingStarted.current);
      readingStarted.current = state === "active" ? Date.now() : 0;
    });
    return () => { subscription.remove(); closeGeneration.current++; };
  }, []);

  const updatePreferences = useCallback((next: ReadingPreferences) => {
    setPreferences(next);
    savePreferences(next).catch(() => {});
  }, []);

  const openDoc = useCallback((d: ParsedPdf, it: LibraryItem) => {
    readerOpen.current = true;
    closeGeneration.current++;
    readingMs.current = 0;
    readingStarted.current = AppState.currentState === "active" ? Date.now() : 0;
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
            onBack={(audioStopped) => {
              // Skip ads if the speech engine has not confirmed stopping by the transition.
              const duration = readingMs.current + (readingStarted.current ? Math.max(0, Date.now() - readingStarted.current) : 0);
              readerOpen.current = false; readingStarted.current = 0;
              const generation = ++closeGeneration.current;
              const closedAt = Date.now();
              setDoc(null);
              setItem(null);
              requestAnimationFrame(() => {
                libraryInterstitial.showAfterBookClose(duration, () => audioStopped && !readerOpen.current
                  && generation === closeGeneration.current && Date.now() - closedAt < 250);
              });
            }}
          />
        ) : (
          <LibraryScreen
            onOpen={openDoc}
            entitlement={entitlement}
            usage={null}
            preferences={preferences}
            onPreferencesChange={updatePreferences}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const createStyles = (theme: AppTheme) => ({
  root: { flex: 1, backgroundColor: theme.colors.bg },
});
