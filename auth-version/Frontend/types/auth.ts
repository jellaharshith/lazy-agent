export type UserRole = "seeker" | "provider";

export type Profile = {
  id: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
};
