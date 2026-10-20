import React, { useCallback, useEffect, useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { LogBox, View } from "react-native";
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

SplashScreen.preventAutoHideAsync().catch(() => {});
LogBox.ignoreLogs(["SherpaOnnxModelList: Unsupported model espeak-ng-data"]);

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
  const entitlement = FREE_ENTITLEMENT;
  const [preferences, setPreferences] = useState<ReadingPreferences>(DEFAULT_PREFERENCES);
  const progressWriteRef = useRef<Promise<void>>(Promise.resolve());
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

  const updatePreferences = useCallback((next: ReadingPreferences) => {
    setPreferences(next);
    savePreferences(next).catch(() => {});
  }, []);

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
            onBack={() => {
              setDoc(null);
              setItem(null);
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
