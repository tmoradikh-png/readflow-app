/**
 * Entitlement middleware + small helpers used by the cost-bearing routes.
 *
 * `attachEntitlement` runs early in the chain and puts the resolved tier on
 * `req.entitlement`. Route handlers then call `ensureFeature` / quota checks.
 * The backend is the source of truth; the mobile app's UI checks are advisory.
 */
import type { NextFunction, Request, Response } from "express";
import { resolveEntitlement, Entitlement } from "../services/entitlements";
import type { PlanFeatures } from "../config/plans";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      entitlement?: Entitlement;
    }
  }
}

/** Resolve the caller's plan and attach it to the request. */
export async function attachEntitlement(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    req.entitlement = await resolveEntitlement(req);
    // Surface the resolved tier so the client can reconcile its UI.
    res.setHeader("x-readflow-tier", req.entitlement.tier.key);
  } catch {
    // resolveEntitlement is already fail-safe, but never block the request.
  }
  next();
}

/**
 * Guard a route by feature flag. Responds 402 (Payment Required) with an
 * upgrade hint and returns false if the caller's tier lacks the feature.
 */
export function ensureFeature(
  req: Request,
  res: Response,
  feature: keyof PlanFeatures
): boolean {
  const tier = req.entitlement?.tier;
  if (tier && tier.features[feature]) return true;
  res.status(402).json({
    error: "upgrade_required",
    feature,
    currentTier: tier?.key ?? "free",
    message: upgradeMessage(feature),
  });
  return false;
}

function upgradeMessage(feature: keyof PlanFeatures): string {
  switch (feature) {
    case "ai":
      return "AI features are part of AI Pro. Upgrade to summarize, explain and ask about your PDFs.";
    case "ocr":
      return "Scanned-PDF OCR is part of AI Pro and Power. Upgrade to read scanned documents.";
    case "export":
      return "Export is part of Power. Upgrade to export your notes and summaries.";
    case "cloudVoice":
      return "Cloud AI voice is included in AI Pro and Power with a monthly allowance. Use device voice for unlimited free listening.";
    default:
      return "This feature requires a subscription.";
  }
}
