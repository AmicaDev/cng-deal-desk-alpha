export function createLogoutButton(onLogout) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "auth-logout";
  button.textContent = "Log out";
  button.setAttribute("aria-label", "Log out");
  button.addEventListener("click", onLogout);
  return button;
}
