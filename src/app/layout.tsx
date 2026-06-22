import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PSView — Autonomous Recruiting Agent",
  description: "Configure an agent from company context and watch it reason.",
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
