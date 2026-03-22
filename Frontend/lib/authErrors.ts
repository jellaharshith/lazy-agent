/** Human-readable Supabase auth error strings for forms. */
export function formatAuthErrorMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Invalid email or password.";
  if (m.includes("email not confirmed")) return "Please confirm your email, then try again.";
  if (m.includes("user already registered")) return "An account with this email already exists.";
  return message;
}
