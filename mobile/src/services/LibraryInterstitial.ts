import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { AdEventType, InterstitialAd, TestIds } from "react-native-google-mobile-ads";
import { AdHistory, canShowBookCloseAd, recordBookCloseAd } from "./InterstitialPolicy";

const HISTORY_KEY = "readflow.libraryInterstitial.v1";
class LibraryInterstitial {
  private freeUser = false;
  private consent = false;
  private ad: InterstitialAd | null = null;
  private loadedAt = 0;
  private dispose: (() => void)[] = [];
  private history: AdHistory | null = null;
  private historyRead: Promise<void> | null = null;
  private showing = false;
  pauseRequests() { this.freeUser = false; }
  setFreeUser(value: boolean) {
    this.freeUser = value;
    if (!value && !this.showing) this.clear();
  }
  setConsent(value: boolean) {
    this.consent = value;
    if (!value && !this.showing) this.clear();
  }
  private clear() {
    this.dispose.forEach(remove => remove()); this.dispose = [];
    this.ad = null; this.loadedAt = 0;
  }
  // Called only in the visible library after UMP permits requests and the SDK is muted.
  prepare() {
    if (Platform.OS !== "android" || !this.freeUser || !this.consent || this.ad || this.showing
      || AppState.currentState !== "active") return;
    if (!this.historyRead) this.historyRead = AsyncStorage.getItem(HISTORY_KEY).then(raw => {
      const value = raw ? JSON.parse(raw) : { day: "", count: 0, lastShown: 0 };
      this.history = value && typeof value.day === "string" && Number.isInteger(value.count)
        && value.count >= 0 && Number.isFinite(value.lastShown) ? value : null;
    }).catch(() => { this.history = null; }); // Storage uncertainty disables full-screen ads.
    const extra = Constants.expoConfig?.extra;
    const unit = __DEV__ || extra?.adsTestMode !== false ? TestIds.INTERSTITIAL : extra?.admobInterstitialId;
    if (!unit) return;
    const ad = InterstitialAd.createForAdRequest(String(unit));
    this.ad = ad;
    this.dispose = [
      ad.addAdEventListener(AdEventType.LOADED, () => { if (this.ad === ad) this.loadedAt = Date.now(); }),
      ad.addAdEventListener(AdEventType.ERROR, () => { this.showing = false; this.clear(); }),
      ad.addAdEventListener(AdEventType.CLOSED, () => { this.showing = false; this.clear(); }),
    ];
    ad.load();
  }
  showAfterBookClose(readingMs: number, safe: () => boolean): boolean {
    const now = Date.now();
    if (!this.freeUser || !this.consent || this.showing || !this.ad || !this.loadedAt || !this.history
      || now - this.loadedAt > 55 * 60 * 1000 || AppState.currentState !== "active" || !safe()
      || !canShowBookCloseAd(this.history, now, readingMs)) return false;
    // Reserve the cap before presentation; errors never cause a delayed retry.
    const ad = this.ad;
    this.history = recordBookCloseAd(this.history, now);
    void AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(this.history)).catch(() => { this.history = null; });
    this.loadedAt = 0; this.showing = true;
    void ad.show().catch(() => { this.showing = false; this.clear(); });
    return true;
  }
}
export const libraryInterstitial = new LibraryInterstitial();
