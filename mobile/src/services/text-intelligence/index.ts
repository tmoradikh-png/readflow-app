import { CompactMultilingualModel } from "./CompactMultilingualModel";
import { HybridTextIntelligence } from "./HybridTextIntelligence";

/**
 * Offline default. Supply BackendTextIntelligenceFallback (or another adapter)
 * to HybridTextIntelligence only when the user explicitly enables paid online
 * fallback.
 */
export const textIntelligence = new HybridTextIntelligence(
  new CompactMultilingualModel()
);

export { BackendTextIntelligenceFallback } from "./BackendTextIntelligenceFallback";
export { CompactMultilingualModel } from "./CompactMultilingualModel";
export { HybridTextIntelligence } from "./HybridTextIntelligence";
export * from "./types";
