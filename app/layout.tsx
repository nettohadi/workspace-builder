import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Monis Workspace Builder",
  description: "Design a measured workspace for your Bali stay.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark min-h-full">
      <body className="min-h-full bg-[#202126] font-sans text-[#f7f7f6]">{children}</body>
    </html>
  );
}
