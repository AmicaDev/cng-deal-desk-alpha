import { fetchCurrentSessionUser, getCurrentUser } from "./authContext.js";

export async function requireAuthenticatedUser() {
  let user = getCurrentUser();
  if (!user) {
    user = await fetchCurrentSessionUser();
  }
  if (!user) {
    window.location.replace("/login");
    return null;
  }
  return user;
}
