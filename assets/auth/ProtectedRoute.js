import { fetchCurrentSessionUser, getCurrentUser } from "./authContext.js";

export async function requireAuthenticatedUser() {
  let user = getCurrentUser();
  if (!user) {
    user = await fetchCurrentSessionUser();
  }
  if (!user) {
    if (window.location.pathname !== "/login" && window.location.pathname !== "/register") {
      sessionStorage.setItem("cng_return_to", window.location.pathname);
      window.location.replace("/login");
    }
    return null;
  }
  return user;
}
