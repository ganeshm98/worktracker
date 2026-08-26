// Thin wrapper around chrome.identity for Google OAuth. The extension never
// stores an API key or client secret in code — chrome.identity.getAuthToken
// negotiates the token using the OAuth client_id declared in manifest.json
// (a public identifier, not a secret) and Chrome's signed-in profile.

export function getAuthToken(interactive) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: !!interactive }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(new Error(chrome.runtime.lastError?.message || "Could not get auth token"));
        return;
      }
      resolve(token);
    });
  });
}

export function removeCachedToken(token) {
  return new Promise((resolve) => {
    if (!token) return resolve();
    chrome.identity.removeCachedAuthToken({ token }, () => resolve());
  });
}

export async function isSignedIn() {
  try {
    const token = await getAuthToken(false);
    return !!token;
  } catch {
    return false;
  }
}

export async function signOut() {
  try {
    const token = await getAuthToken(false);
    if (token) {
      await removeCachedToken(token);
      await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`);
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
