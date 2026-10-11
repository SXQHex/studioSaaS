import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Studio SaaS | Dans Okulu Yönetimi",
  description: "Dans okulu yönetim paneli",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="tr"><body>{children}</body></html>;
}
