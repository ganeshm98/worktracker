// Cross-browser Google OAuth. chrome.identity.getAuthToken (used previously)
// has no Firefox equivalent and doesn't work reliably in Edge, since both
// rely on Chrome's own "signed in to the browser" integration. launchWebAuthFlow
// is the one identity API all three browsers implement the same way, so every
// browser goes through it here. Unlike getAuthToken, it has no built-in token
// cache — we keep one ourselves in chrome.storage.local (STORAGE_KEYS.authToken).

import { OAUTH_CLIENT_ID, SCOPES, STORAGE_KEYS } from "./constants.js";
import { cacheGet, cacheSet, cacheRemove } from "./storage.js";

const hasBrowserApi = typeof browser !== "undefined" && !!browser.identity;
const identityApi = hasBrowserApi ? browser.identity : chrome.identity;

function getRedirectURL() {
  return identityApi.getRedirectURL();
}

function launchWebAuthFlow(options) {
  if (hasBrowserApi) return browser.identity.launchWebAuthFlow(options);
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(options, (redirectUrl) => {
      if (chrome.runtime.lastError || !redirectUrl) {
        reject(new Error(chrome.runtime.lastError?.message || "Authorization was cancelled."));
        return;
      }
      resolve(redirectUrl);
    });
  });
}

function buildAuthUrl(interactive) {
  const params = new URLSearchParams({
    client_id: OAUTH_CLIENT_ID,
    response_type: "token",
    redirect_uri: getRedirectURL(),
    scope: SCOPES.join(" ")
  });
  // Silent check only — fail instead of prompting if the user hasn't already granted access.
  if (!interactive) params.set("prompt", "none");
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function parseTokenFromRedirect(redirectUrl) {
  const url = new URL(redirectUrl);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const error = fragment.get("error") || url.searchParams.get("error");
  if (error) throw new Error(error === "access_denied" ? "You didn't grant access." : "Sign-in required.");

  const accessToken = fragment.get("access_token");
  const expiresIn = Number(fragment.get("expires_in") || 3600);
  if (!accessToken) throw new Error("Could not get auth token");
  return { accessToken, expiresAt: Date.now() + expiresIn * 1000 };
}

async function readCachedToken() {
  const cached = await cacheGet(STORAGE_KEYS.authToken);
  if (!cached?.accessToken || Date.now() > cached.expiresAt - 60_000) return null;
  return cached.accessToken;
}

export async function getAuthToken(interactive) {
  const cached = await readCachedToken();
  if (cached) return cached;

  const redirectUrl = await launchWebAuthFlow({
    url: buildAuthUrl(interactive),
    interactive: !!interactive
  });
  const { accessToken, expiresAt } = parseTokenFromRedirect(redirectUrl);
  await cacheSet(STORAGE_KEYS.authToken, { accessToken, expiresAt });
  return accessToken;
}

export async function removeCachedToken() {
  await cacheRemove(STORAGE_KEYS.authToken);
}

// Cheap, local-only check: is there any remembered session at all (regardless
// of whether its access token has since expired)? Explicit sign-out clears
// this, so callers can use it to skip an automatic silent-reauth attempt
// right after the user disconnects, while still allowing one for a session
// that's merely past its hourly token TTL.
export async function hasStoredSession() {
  const cached = await cacheGet(STORAGE_KEYS.authToken);
  return !!cached?.accessToken;
}

export async function isSignedIn() {
  if (!(await hasStoredSession())) return false;
  try {
    const token = await getAuthToken(false);
    return !!token;
  } catch {
    return false;
  }
}

export async function signOut() {
  try {
    const cached = await cacheGet(STORAGE_KEYS.authToken);
    await cacheRemove(STORAGE_KEYS.authToken);
    if (cached?.accessToken) {
      await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${cached.accessToken}`);
    }
  } catch {
    // no cached token — nothing to revoke
  }
}

/** Returns { email, name, picture } for the connected Google account, or null if unavailable. */
export async function getUserProfile(interactive = false) {
  const token = await getAuthToken(interactive);
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Could not load your Google profile.");
  const data = await res.json();
  return { email: data.email || "", name: data.name || "", picture: data.picture || "" };
}
