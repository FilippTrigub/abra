import type { Metadata } from "next";

import { Navbar } from "./components/navbar";

export const metadata: Metadata = {
  title: "Abra - Turn raw expertise into ready-to-post content",
  description:
    "Finish a useful call, note, or recording. Abra turns the useful parts into ready-to-post content you can review, edit, and schedule.",
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
