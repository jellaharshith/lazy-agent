"use client";

import type { ReactNode } from "react";
import type { UserRole } from "@/types/auth";

type RoleGuardProps = {
  allowedRoles: UserRole[];
  children: ReactNode;
};

/** Auth disabled — role checks removed; always render children. */
export function RoleGuard({ children }: RoleGuardProps) {
  return <>{children}</>;
}
