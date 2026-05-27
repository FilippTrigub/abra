import type { Metadata } from "next";

import { Navbar } from "./components/navbar";

export const metadata: Metadata = {
  title: "Abra - Stay visible without finding time to post",
  description:
    "Drop in a call or note. Abra drafts the post so busy experts can stay visible without making content another job.",
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
