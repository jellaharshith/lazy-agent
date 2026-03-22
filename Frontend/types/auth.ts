export type UserRole = "seeker" | "provider";

export type Profile = {
  id: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  /** E.164 recommended — used for Twilio provider alerts on reservations */
  phone_number?: string | null;
};
