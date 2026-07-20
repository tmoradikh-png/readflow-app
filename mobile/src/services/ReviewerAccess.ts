import { API_BASE, apiHeaders } from "../config";
import { loadAppUserId } from "./AppIdentity";
import { saveReviewerToken } from "./ReviewerToken";

export async function activateReviewerAccess(code: string): Promise<void> {
  const normalized = code.trim();
  if (!normalized) throw new Error("Enter the review access code.");
  await loadAppUserId();
  const response = await fetch(`${API_BASE}/api/reviewer/access`, {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ code: normalized }),
  });
  if (!response.ok) {
    if (response.status === 403) throw new Error("That review access code is not valid.");
    if (response.status === 503) throw new Error("Review access is not configured yet.");
    throw new Error("Could not activate review access. Check the connection and try again.");
  }
  const data = (await response.json()) as { token?: string };
  if (!data.token) throw new Error("The server did not return a review token.");
  await saveReviewerToken(data.token);
}
