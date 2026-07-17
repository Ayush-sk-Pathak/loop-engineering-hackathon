import type { Metadata } from "next";
import { ContinuumProvider } from "@/lib/store";
import "./globals.css";

export const metadata: Metadata = {
  title: "Continuum — Autonomous Continuity",
  description:
    "When a critical system boundary fails, Continuum discovers, verifies, pays, and procures backup resources without human intervention.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ContinuumProvider>{children}</ContinuumProvider>
      </body>
    </html>
  );
}
