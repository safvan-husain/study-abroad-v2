import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Study Abroad | Your advisor workspace", description: "A guided workspace for shaping your study-abroad journey." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
