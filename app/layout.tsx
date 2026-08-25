import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LIDIA AI — AI-маркетолог для бизнеса",
  description:
    "LIDIA AI анализирует бизнес, находит точки роста и помогает принимать маркетинговые решения.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
