import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Monis Workspace Builder",
  description: "Design a measured workspace for your Bali stay.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark h-full overflow-hidden">
      <body className="h-full overflow-hidden bg-[#202126] font-sans text-[#f7f7f6]">
        {children}
      </body>
    </html>
  );
}
