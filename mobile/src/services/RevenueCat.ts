import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type PurchasesError,
  type PurchasesOffering,
  type PurchasesPackage,
} from "react-native-purchases";
import { REVENUECAT_ANDROID_API_KEY, REVENUECAT_IOS_API_KEY } from "../config";
import { loadAppUserId } from "./AppIdentity";

export type PurchaseTierKey = "reader_plus" | "ai_pro" | "power";
export type PurchaseBilling = "monthly" | "annual";

export interface RevenueCatStatus {
  configured: boolean;
  available: boolean;
  message?: string;
  missingProductIds: string[];
}

const PRODUCT_IDS: Record<PurchaseTierKey, Record<PurchaseBilling, string>> = {
  reader_plus: {
    monthly: "readflow_reader_plus_monthly",
    annual: "readflow_reader_plus_yearly",
  },
  ai_pro: {
    monthly: "readflow_ai_pro_monthly",
    annual: "readflow_ai_pro_yearly",
  },
  power: {
    monthly: "readflow_power_monthly",
    annual: "readflow_power_yearly",
  },
};

type PackageKey = `${PurchaseTierKey}:${PurchaseBilling}`;
type PackageMap = Partial<Record<PackageKey, PurchasesPackage>>;

let configurePromise: Promise<boolean> | null = null;
let cachedPackages: PackageMap = {};

function publicApiKey(): string {
  if (Platform.OS === "android") return REVENUECAT_ANDROID_API_KEY.trim();
  if (Platform.OS === "ios") return REVENUECAT_IOS_API_KEY.trim();
  return "";
}

function packageKey(tier: PurchaseTierKey, billing: PurchaseBilling): PackageKey {
  return `${tier}:${billing}`;
}

function allProductIds(): string[] {
  return Object.values(PRODUCT_IDS).flatMap((byBilling) => Object.values(byBilling));
}

function productIdentifierMatches(expectedProductId: string, actualIdentifier: string): boolean {
  return (
    actualIdentifier === expectedProductId ||
    actualIdentifier.startsWith(`${expectedProductId}:`)
  );
}

function selectOffering(offerings: { current: PurchasesOffering | null; all: Record<string, PurchasesOffering> }) {
  return offerings.current || offerings.all.default || Object.values(offerings.all)[0] || null;
}

function indexPackages(offering: PurchasesOffering | null): PackageMap {
  const indexed: PackageMap = {};
  if (!offering) return indexed;
  for (const pack of offering.availablePackages) {
    const productId = pack.product.identifier;
    for (const tier of Object.keys(PRODUCT_IDS) as PurchaseTierKey[]) {
      for (const billing of Object.keys(PRODUCT_IDS[tier]) as PurchaseBilling[]) {
        if (productIdentifierMatches(PRODUCT_IDS[tier][billing], productId)) {
          indexed[packageKey(tier, billing)] = pack;
        }
      }
    }
  }
  return indexed;
}

async function configureRevenueCat(): Promise<boolean> {
  if (configurePromise) return configurePromise;

  configurePromise = (async () => {
    const apiKey = publicApiKey();
    if (!apiKey) return false;

    const appUserID = await loadAppUserId();
    await Purchases.setLogLevel(
      process.env.NODE_ENV === "production" ? LOG_LEVEL.WARN : LOG_LEVEL.INFO
    ).catch(() => {});
    Purchases.configure({ apiKey, appUserID });
    return true;
  })();

  return configurePromise;
}

export async function refreshRevenueCatOfferings(): Promise<RevenueCatStatus> {
  const configured = await configureRevenueCat();
  if (!configured) {
    cachedPackages = {};
    return {
      configured: false,
      available: false,
      missingProductIds: allProductIds(),
      message: "RevenueCat public SDK key is not set for this build.",
    };
  }

  const offerings = await Purchases.getOfferings();
  const offering = selectOffering(offerings);
  cachedPackages = indexPackages(offering);
  const missingProductIds = allProductIds().filter(
    (id) =>
      !Object.values(cachedPackages).some((pack) =>
        pack ? productIdentifierMatches(id, pack.product.identifier) : false
      )
  );

  return {
    configured: true,
    available: Object.keys(cachedPackages).length > 0,
    missingProductIds,
    message: offering
      ? undefined
      : "RevenueCat has no current offering for this app yet.",
  };
}

async function packageFor(
  tier: PurchaseTierKey,
  billing: PurchaseBilling
): Promise<PurchasesPackage> {
  if (!cachedPackages[packageKey(tier, billing)]) {
    await refreshRevenueCatOfferings();
  }
  const pack = cachedPackages[packageKey(tier, billing)];
  if (!pack) {
    throw new Error(
      `This subscription is not available yet. Missing product ${PRODUCT_IDS[tier][billing]} in the RevenueCat offering.`
    );
  }
  return pack;
}

export async function purchaseRevenueCatPlan(
  tier: PurchaseTierKey,
  billing: PurchaseBilling
) {
  const pack = await packageFor(tier, billing);
  return Purchases.purchasePackage(pack);
}

export async function restoreRevenueCatPurchases() {
  const configured = await configureRevenueCat();
  if (!configured) {
    throw new Error("Purchases are not configured in this build yet.");
  }
  return Purchases.restorePurchases();
}

export function isRevenueCatCancellation(error: unknown): boolean {
  const err = error as Partial<PurchasesError> | undefined;
  return (
    err?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR ||
    err?.userCancelled === true
  );
}

export function revenueCatErrorMessage(error: unknown): string {
  const err = error as Partial<PurchasesError> | undefined;
  if (isRevenueCatCancellation(error)) return "Purchase cancelled.";
  if (err?.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
    return "Google Play is still processing this purchase. Your plan will update when payment is approved.";
  }
  if (err?.code === PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR) {
    return "This subscription is not active in Google Play yet.";
  }
  if (err?.code === PURCHASES_ERROR_CODE.NETWORK_ERROR) {
    return "Google Play could not be reached. Check the connection and try again.";
  }
  if (err?.message) return err.message;
  if (error instanceof Error) return error.message;
  return "Purchase failed. Please try again.";
}
