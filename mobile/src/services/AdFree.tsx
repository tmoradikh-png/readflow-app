import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, NativeEventEmitter, NativeModules, Platform } from "react-native";
import { libraryInterstitial } from "./LibraryInterstitial";

export type AdFreeStatus = "checking" | "active" | "free" | "unavailable";
export type AdFreePlan = { id: "monthly" | "yearly"; price: string };
type Snapshot = { active: boolean; pending: boolean };
const billing = NativeModules.ReadFlowAdFree as undefined | {
  status(): Promise<Snapshot>;
  products(): Promise<AdFreePlan[]>;
  purchase(plan: string): Promise<"active" | "pending" | "cancelled">;
  addListener(name: string): void;
  removeListeners(count: number): void;
};
type Value = {
  status: AdFreeStatus; pending: boolean; canShowAds: boolean;
  refresh(): Promise<Snapshot | null>;
  products(): Promise<AdFreePlan[]>;
  purchase(plan: AdFreePlan["id"]): Promise<string>;
};
const Context = createContext<Value | null>(null);

export function AdFreeProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AdFreeStatus>(Platform.OS === "android" ? "checking" : "free");
  const [pending, setPending] = useState(false);
  const generation = useRef(0);
  const current = useRef<Promise<Snapshot | null> | null>(null);
  const alive = useRef(true);
  const refresh = useCallback(() => {
    if (current.current) return current.current;
    const id = ++generation.current;
    libraryInterstitial.pauseRequests();
    setStatus(Platform.OS === "android" ? "checking" : "free");
    let timeout: ReturnType<typeof setTimeout>;
    const task = (async (): Promise<Snapshot | null> => {
      try {
        if (Platform.OS !== "android") return null;
        if (!billing) throw new Error("Billing unavailable");
        const value = await Promise.race([
          billing.status(),
          new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Play timeout")), 25000); }),
        ]);
        if (alive.current && id === generation.current) {
          setStatus(value.active ? "active" : "free");
          setPending(value.pending);
          libraryInterstitial.setFreeUser(!value.active);
        }
        return value;
      } catch {
        if (alive.current && id === generation.current) {
          libraryInterstitial.setFreeUser(false);
          setStatus("unavailable");
        }
        return null;
      } finally { clearTimeout(timeout!); }
    })();
    current.current = task;
    void task.finally(() => { if (current.current === task) current.current = null; });
    return task;
  }, []);
  useEffect(() => {
    alive.current = true;
    void refresh();
    const foreground = AppState.addEventListener("change", state => {
      if (state === "active") void refresh();
    });
    const events = billing ? new NativeEventEmitter(billing).addListener("readflowAdFreeChanged", () => {
      // Invalidate an older query so a pre-purchase result cannot restore ads.
      generation.current++;
      current.current = null;
      void refresh();
    }) : null;
    const timer = setInterval(() => { if (AppState.currentState === "active") void refresh(); }, 15 * 60 * 1000);
    return () => {
      alive.current = false; generation.current++; libraryInterstitial.setFreeUser(false);
      foreground.remove(); events?.remove(); clearInterval(timer);
    };
  }, [refresh]);
  const purchase = useCallback(async (plan: AdFreePlan["id"]) => {
    if (!billing) throw new Error("Subscriptions are unavailable.");
    generation.current++;
    current.current = null;
    libraryInterstitial.setFreeUser(false);
    setStatus("checking");
    try { return await billing.purchase(plan); }
    finally { current.current = null; generation.current++; await refresh(); }
  }, [refresh]);
  return <Context.Provider value={{ status, pending, canShowAds: status === "free", refresh,
    products: () => billing?.products() ?? Promise.resolve([]), purchase }}>{children}</Context.Provider>;
}
export function useAdFree() {
  const value = useContext(Context);
  if (!value) throw new Error("AdFreeProvider missing");
  return value;
}
