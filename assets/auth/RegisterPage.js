export function renderRegisterPage(container, { onRegister, onLogin }) {
  container.innerHTML = `
    <main class="auth-card" aria-labelledby="auth-title">
      <div class="auth-brand">CNG Deal Desk</div>
      <h1 id="auth-title">Create your account</h1>
      <p class="auth-subtitle">Register a secure verified account with Supabase Auth.</p>
      <form id="auth-register-form" novalidate>
        <label>Full name<input name="name" autocomplete="name" required placeholder="e.g. Christine Auma"></label>
        <label>Email<input name="email" type="email" autocomplete="email" required placeholder="name@company.com"></label>
        <label>Username<input name="username" autocomplete="username" required placeholder="e.g. christine"></label>
        <label>Password<input name="password" type="password" autocomplete="new-password" required></label>
        <p class="auth-hint">At least 8 characters with numbers and letters.</p>
        <label>Confirm password<input name="confirmPassword" type="password" autocomplete="new-password" required></label>
        <p class="auth-error" role="alert" aria-live="polite"></p>
        <button class="auth-submit" type="submit">Create account</button>
      </form>
      <p class="auth-switch">Already registered? <a href="/login" data-auth-nav>Sign in</a></p>
    </main>`;

  container.querySelector("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button");
    const error = form.querySelector(".auth-error");
    const data = new FormData(form);
    const password = String(data.get("password") || "");
    const confirmPassword = String(data.get("confirmPassword") || "");

    if (password.length < 8) {
      error.textContent = "Password must be at least 8 characters.";
      return;
    }
    if (password !== confirmPassword) {
      error.textContent = "Passwords do not match.";
      return;
    }

    button.disabled = true;
    button.textContent = "Creating account…";
    error.textContent = "";

    try {
      await onRegister({
        name: data.get("name"),
        email: data.get("email"),
        username: data.get("username"),
        password,
        confirmPassword,
      });
    } catch (reason) {
      error.textContent = reason.message || "Unable to create account.";
      button.disabled = false;
      button.textContent = "Create account";
    }
  });

  container.querySelector("[data-auth-nav]").addEventListener("click", (event) => {
    event.preventDefault();
    onLogin();
  });
}
