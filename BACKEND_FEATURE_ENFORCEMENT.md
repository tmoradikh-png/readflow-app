# Backend Feature Enforcement: AI Access Control

## Overview

**AI and TTS features are strictly enforced on the backend** to prevent free users from accessing cost-bearing services. Free users can use local/device reading, but **cannot access any cloud AI, OCR, or TTS features**.

> Cost note: read `COST_MODEL.md` before changing paid tiers or natural voice.
> Unlimited cloud TTS is not economically safe. Natural voice is gated behind
> the explicit `cloudVoice` feature and a monthly character cap, not generic
> `ai`.

---

## Feature Access by Tier

| Feature | Free | Reader Plus | AI Pro | Power |
|---------|------|-------------|--------|-------|
| **Local PDF reading** | ✅ (30 pages/doc) | ✅ (unlimited) | ✅ | ✅ |
| **Server PDF extraction** | ✅ (30 PDFs/mo) | ✅ (100/mo) | ✅ (300/mo) | ✅ (1000/mo) |
| **AI summary/explain/ask** | ❌ 402 Blocked | ❌ 402 Blocked | ✅ (500/mo) | ✅ (2000/mo) |
| **Cloud OCR (scanned PDFs)** | ❌ 402 Blocked | ✅ (300 pages/mo) | ✅ (1000/mo) | ✅ (3000/mo) |
| **Cloud TTS (AI voice)** | ❌ 402 Blocked | ❌ 402 Blocked | ✅ (60k chars/mo) | ✅ (180k chars/mo) |
| **Export** | ❌ 402 Blocked | ❌ 402 Blocked | ❌ 402 Blocked | ✅ |

*TTS is cached in-memory; actual OpenAI usage varies by unique text/voice/speed
combos. Caching does not make cloud voice safe to sell as unlimited.

---

## Enforcement Mechanism

### 1. **Route-Level Gating**

All cost-bearing endpoints call `ensureFeature(req, res, "feature")` at the start:

```typescript
// POST /api/ai
if (!ensureFeature(req, res, "ai")) return;

// POST /api/tts
if (!ensureFeature(req, res, "cloudVoice")) return;

// POST /api/pdf/extract (only checks serverExtract, not ai)
if (!features.serverExtract) {
  return res.status(402).json({ error: "upgrade_required" });
}
```

The TTS route is gated by `cloudVoice` and checks `cloudVoiceChars` before
generating fresh OpenAI audio. Cache hits do not consume cloud voice quota
because they do not create a new OpenAI charge.

**Response for blocked access:**
```json
{
  "error": "upgrade_required",
  "feature": "ai",
  "currentTier": "free",
  "message": "AI features are part of AI Pro. Upgrade to summarize, explain and ask about your PDFs."
}
```

HTTP Status: **402 Payment Required**

### 2. **Tier Configuration**

Free tier definition (from `src/config/plans.ts`):
```typescript
{
  key: "free",
  features: {
    ai: false,           // ← AI is blocked
    ocr: false,          // ← OCR is blocked
    cloudVoice: false,   // ← TTS is blocked
    serverExtract: true, // ✓ PDF extraction allowed
    export: false,       // ← Export blocked
    ads: true,           // Show ads to free users
    unlimitedLibrary: false, // Cap library size
  },
  limits: {
    aiActionsPerMonth: 0,     // ← Cannot make any AI requests
    cloudVoiceCharsPerMonth: 0, // ← Cannot make cloud voice requests
    ocrPagesPerMonth: 0,      // ← Cannot OCR any pages
    pdfsPerMonth: 30,         // ✓ Can extract 30 PDFs
    maxFileSizeMb: 20,        // ✓ Max file size
    maxPages: 2000,           // ✓ Doc page limit
    perDocPageCap: 30,        // ✓ Show first 30 pages, then paywall
  },
}
```

### 3. **Entitlement Resolution (Backend Source of Truth)**

When a request arrives, the backend resolves the user's tier in this order:

1. **Production (with RevenueCat)**: If `RC_SECRET_KEY` is set:
   - Client sends `x-app-user-id` header (RevenueCat $RCAnonymousID)
   - Backend queries RevenueCat REST API with server-only secret
   - Maps active entitlements → highest tier
   - Caches result for 60s
   - ⚠️ **On RevenueCat error: defaults to FREE (never grants paid on failure)**

2. **Dev/Testing**: If `ENTITLEMENTS_DEV_OVERRIDE=true`:
   - Uses `DEV_DEFAULT_TIER` env var (e.g., "ai_pro" for testing)
   - Only works if explicitly enabled
   - Always falls back to free if env var is missing or false

3. **Local/Unauthenticated**: Default fallback
   - No `x-app-user-id` header → FREE tier
   - No RevenueCat key → FREE tier

```typescript
// From src/services/entitlements.ts
export async function resolveEntitlement(req: Request): Promise<Entitlement> {
  const appUserId = appUserIdFromRequest(req);
  
  if (!RC_SECRET_KEY || !appUserId) {
    if (DEV_OVERRIDE) {
      return { appUserId: appUserId || "dev-local", tier: tierByKey(DEV_DEFAULT_TIER), source: "dev-override" };
    }
    return { appUserId: appUserId || "anonymous", tier: FREE_TIER, source: "free" };
  }

  try {
    const active = await fetchActiveEntitlements(appUserId);
    const tier = highestTier(active);
    return { appUserId, tier, source: "revenuecat" };
  } catch {
    // FAIL-SAFE: On error, return free (never grant paid access).
    return { appUserId, tier: FREE_TIER, source: "free" };
  }
}
```

---

## Deployment Configuration for Render

### Required Environment Variables

**Secrets (marked `sync: false` in render.yaml — NOT synced to git):**

```yaml
OPENAI_API_KEY: <your-openai-key>        # Needed for /api/ai, /api/tts
APP_KEY: <random-secret-string>          # Optional app key protection
RC_SECRET_KEY: <revenuecat-secret-key>   # ← Required for prod entitlements
```

**Important**: Only set `RC_SECRET_KEY` in production Render deployment.

### For Internal Testing (Render Free tier)

If using Render Free for internal testing (before paying tier), you can:

1. **Option A: Use dev override** (quick testing)
   ```yaml
   ENTITLEMENTS_DEV_OVERRIDE: "true"
   DEV_DEFAULT_TIER: "ai_pro"           # Everyone tests as AI Pro
   ```
   - Then don't set `RC_SECRET_KEY`
   - All requests resolve to the dev tier
   - ⚠️ **NOT suitable for public v1 release**

2. **Option B: Use local RevenueCat sandbox** (better testing)
   - Sign up for RevenueCat free tier
   - Create sandbox entitlements
   - Set `RC_SECRET_KEY` to your sandbox secret
   - Client sends `x-app-user-id` header from RevenueCat SDK
   - Backend validates via RevenueCat API

3. **Option C: Run locally without entitlements**
   ```
   # No RC_SECRET_KEY set
   # No DEV_OVERRIDE set
   → Everyone is free tier (best for PDF extraction testing)
   ```

### For Public v1 Release (Render Starter/Standard)

**Required setup:**
```yaml
RC_SECRET_KEY: <production-revenuecat-secret-key>  # ← Must be production key
ENTITLEMENTS_DEV_OVERRIDE: "false"                 # ← Explicitly disable dev mode
DEV_DEFAULT_TIER: "free"                           # ← Not used, but default to safe value
```

- RevenueCat production account linked to your App Store/Google Play apps
- Mobile app sends real `x-app-user-id` from RevenueCat SDK
- Backend queries RevenueCat to validate active subscriptions
- Free users cannot access AI/OCR/TTS no matter what

---

## Testing the Enforcement

### Test 1: Free User Cannot Access AI (should get 402)

```bash
curl -X POST https://your-render-url/api/ai \
  -H "Content-Type: application/json" \
  -H "x-app-user-id: free-test-user" \
  -d '{"task":"summary","text":"sample text","language":"en"}'

# Response: 402 Payment Required
# {
#   "error": "upgrade_required",
#   "feature": "ai",
#   "currentTier": "free",
#   "message": "AI features are part of AI Pro..."
# }
```

### Test 2: Free User CAN Extract PDF

```bash
# Create a test PDF or use an existing one
curl -X POST https://your-render-url/api/pdf/extract \
  -H "x-app-user-id: free-test-user" \
  -F "file=@sample.pdf"

# Response: 200 OK (returns extracted text)
```

### Test 3: Paid User (with RevenueCat entitlement) CAN Access AI

```bash
# Requires valid RevenueCat subscription
curl -X POST https://your-render-url/api/ai \
  -H "Content-Type: application/json" \
  -H "x-app-user-id: paid-user-with-active-subscription" \
  -d '{"task":"summary","text":"sample text","language":"en"}'

# Response: 200 OK (returns AI summary)
```

### Test 4: No User ID → Free Tier by Default

```bash
curl -X POST https://your-render-url/api/ai \
  -H "Content-Type: application/json" \
  -d '{"task":"summary","text":"sample text","language":"en"}'

# Response: 402 Payment Required (defaults to free)
```

### Test 5: Check Current Entitlement

```bash
curl https://your-render-url/api/entitlements \
  -H "x-app-user-id: test-user"

# Response:
# {
#   "tier": "free",
#   "name": "Free",
#   "features": { "ai": false, "ocr": false, ... },
#   "limits": { "aiActionsPerMonth": 0, ... },
#   "source": "revenuecat|dev-override|free"
# }
```

---

## Security Model

### What the Mobile App Cannot Do

- ❌ Cannot assert its own tier or claim a paid entitlement
- ❌ Cannot send a fake `x-app-user-id` to get a different tier
- ❌ Cannot bypass feature checks by calling internal APIs
- ❌ Cannot access the `OPENAI_API_KEY` or `RC_SECRET_KEY` (server-only secrets)

### How the Backend Prevents Abuse

1. **No trust of client**: Backend verifies tier independently via RevenueCat
2. **Secrets server-only**: OpenAI API key, RevenueCat secret never leave the backend
3. **Fail-safe defaults**: Errors → free tier, never grant access on uncertainty
4. **Rate limiting**: Each tier has per-minute limits on all endpoints
5. **Quota enforcement**: Monthly quotas are checked per-user before granting work
6. **Immutable plan config**: Plans live on backend; clients fetch for UI only

---

## Quota Tracking

Quotas are tracked per user per calendar month in `.usage/YYYY-MM.json`:

```json
{
  "user-id": {
    "pdfs": 3,
    "ocrPages": 0,
    "aiActions": 0,
    "cloudVoiceChars": 0,
    "failedRequests": 2,
    "cacheHits": 5
  }
}
```

**Important notes:**
- Cache hits don't count toward quota (free bonus for repeated requests)
- Failed requests are logged but don't count against usage
- Quotas reset on the 1st of each month (UTC)
- Per-tier limits are enforced before work starts (prevents overages)

---

## Common Pitfalls to Avoid

### ❌ DO NOT

1. Remove `ensureFeature()` calls from cost-bearing routes
2. Trust `ENTITLEMENTS_DEV_OVERRIDE=true` for public deployments
3. Hard-code free tier to access paid features in the app
4. Expose `OPENAI_API_KEY` or `RC_SECRET_KEY` in client code
5. Run with `DEV_DEFAULT_TIER=ai_pro` on the public backend
6. Disable rate limiters or quota checks
7. Skip tier resolution (always call `attachEntitlement` middleware)

### ✅ DO

1. Always call `ensureFeature()` before cost-bearing work
2. Use RevenueCat production key for public deployments
3. Test with `ENTITLEMENTS_DEV_OVERRIDE=true` locally only
4. Keep all secrets in Render environment variables
5. Set `ENTITLEMENTS_DEV_OVERRIDE=false` for prod
6. Monitor RevenueCat API health (backend logs)
7. Test the enforcement before public release (see Testing section above)

---

## Monitoring & Debugging

### Check Backend Logs

- `[entitlements] RevenueCat lookup failed:` → RevenueCat API issue (falls back to free)
- `AI request failed: ...` → Check `OPENAI_API_KEY` and quota
- `upgrade_required` → User tried to access paid feature; working as designed
- `quota_exceeded` → User exceeded monthly limit; working as designed

### Response Headers

Every response includes the resolved tier:
```
x-readflow-tier: free|reader_plus|ai_pro|power
```

Check this header to verify the backend correctly identified the user's tier.

### Render Dashboard

1. Go to your ReadFlow backend service
2. Logs → Filter for "AI request" or "entitlements" to see audit trail
3. Environment variables → Verify `RC_SECRET_KEY` is set (value hidden)
4. Check service health: `/api/health` should return `ok: true`

---

## Transition Path: Dev → Testing → Production

| Phase | Environment | Config | Users | Notes |
|-------|-------------|--------|-------|-------|
| **Development** | Local | `DEV_OVERRIDE=true, DEV_DEFAULT_TIER=ai_pro` | You | Test paid features freely |
| **Internal Testing** | Render Free | `RC_SECRET_KEY=sandbox-key` | Internal team | Validate with real RevenueCat sandbox |
| **Public v1** | Render Starter/Standard | `RC_SECRET_KEY=prod-key, DEV_OVERRIDE=false` | All users | Real subscription enforcement |

---

## Summary

✅ **AI features are blocked for free users at the backend level.**
- Feature check: `ensureFeature(req, res, "ai")` → 402 if tier lacks `ai: true`
- Tier check: Resolved via RevenueCat (production), dev override, or defaults to free
- Fail-safe: On any error, reverts to free (never grants paid access)
- Enforcement: Before any cost-bearing work starts (PDF extraction, AI, TTS, OCR)

✅ **Free users CAN use:**
- Local PDF reading (native text, device voice)
- Server PDF extraction (30 PDFs/mo, 30 pages/doc max)

✅ **Free users CANNOT use:**
- AI summary/explain/ask
- OCR for scanned PDFs
- Cloud AI voice TTS

✅ **AI Pro / Power cloud AI voice is capped:**
- AI Pro: 60k generated characters/month
- Power: 180k generated characters/month
- Extra voice must be sold through a paid top-up or fall back to device voice

No UI trick or client-side hack can bypass this. The backend is the source of truth.
