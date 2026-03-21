import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Intent Commons",
  description: "AI connects hidden needs to nearby unused resources.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
