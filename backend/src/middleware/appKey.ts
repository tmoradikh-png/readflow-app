import { Request, Response, NextFunction } from "express";

/**
 * Optional shared app-key gate for the cost-bearing endpoints.
 *
 * If APP_KEY is set in the environment, every protected request must send the
 * same value in the `x-app-key` header. This keeps a public backend from being
 * an open wallet for our OpenAI credit. If APP_KEY is unset (local dev), the
 * gate is a no-op so the LAN dev flow keeps working.
 */
const APP_KEY = (process.env.APP_KEY || "").trim();

export function requireAppKey(req: Request, res: Response, next: NextFunction) {
  if (!APP_KEY) return next(); // not configured -> allow (dev)
  const provided = String(req.header("x-app-key") || "").trim();
  if (provided && provided === APP_KEY) return next();
  return res.status(401).json({ error: "Unauthorized." });
}
