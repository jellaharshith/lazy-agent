"use client";

import type { ReactNode } from "react";

/** Auth disabled — always render children. */
export function AuthGuard({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
