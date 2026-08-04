import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Study Abroad | Kerala overseas education counselling",
  description: "Kochi and Calicut study-abroad counselling with an AI advisor workspace for course exploration, shortlists, and documents.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
