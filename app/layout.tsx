import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Miraflores — Tax Workpaper",
  description: "An evidence-led workspace for tax preparation, review, and a defensible record.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
