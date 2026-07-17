import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "StockShield Operations",
  description: "Policy-enforced autonomous procurement operations",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
