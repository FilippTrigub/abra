import type { Metadata } from "next";

import { Navbar } from "./components/navbar";

export const metadata: Metadata = {
  title: "Abra - Turn conversations into posts",
  description:
    "Turn calls, notes, and workshops into reviewable drafts. Run Abra yourself or use managed hosting.",
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
