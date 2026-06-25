import type { Metadata } from "next";

import { Navbar } from "./components/navbar";

export const metadata: Metadata = {
  title: "Abra - Self-hostable brand workflow with managed convenience",
  description:
    "Run Abra yourself or use the managed path to turn calls, notes, and expertise into reviewable content without making operations another job.",
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col bg-[#05070b] text-white">
      <Navbar />
      <main className="flex-1">{children}</main>
    </div>
  );
}
