import crypto from "crypto";

const ACCESS_CODE = process.env.REVIEWER_ACCESS_CODE || "";
const TOKEN_SECRET = process.env.REVIEWER_TOKEN_SECRET || "";
const TOKEN_TTL_MS = Number(process.env.REVIEWER_TOKEN_TTL_DAYS || 90) * 24 * 60 * 60 * 1000;

interface ReviewerTokenPayload {
  appUserId: string;
  expiresAt: number;
}

export function reviewerAccessConfigured(): boolean {
  return Boolean(ACCESS_CODE && TOKEN_SECRET.length >= 32);
}

export function reviewerCodeMatches(candidate: unknown): boolean {
  if (!reviewerAccessConfigured() || typeof candidate !== "string") return false;
  return safeEqual(candidate.trim(), ACCESS_CODE);
}

export function createReviewerToken(appUserId: string): string {
  const payload: ReviewerTokenPayload = {
    appUserId,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function validatesReviewerToken(token: string | undefined, appUserId: string): boolean {
  if (!reviewerAccessConfigured() || !token || token.length > 1024) return false;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra || !safeEqual(signature, sign(body))) return false;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as ReviewerTokenPayload;
    return payload.appUserId === appUserId && payload.expiresAt > Date.now();
  } catch {
    return false;
  }
}

function sign(body: string): string {
  return crypto.createHmac("sha256", TOKEN_SECRET).update(body).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
