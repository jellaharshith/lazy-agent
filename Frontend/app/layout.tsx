import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppLayout } from "@/components/AppLayout";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "SurplusLink — Surplus food rescue",
  description:
    "AI detects urgent need signals and connects people to nearby surplus meals, community fridges, and food support in real time.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <AppLayout>{children}</AppLayout>
        </Providers>
      </body>
    </html>
  );
}
