/**
 * Maps Supabase Auth API messages to clearer copy for the UI.
 */
export function formatAuthErrorMessage(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("email rate limit") || lower.includes("rate limit exceeded")) {
    return "Too many confirmation emails were sent recently. Wait a few minutes and try again, or confirm your inbox in case a link was already sent.";
  }
  if (lower.includes("too many requests")) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  return message;
}
