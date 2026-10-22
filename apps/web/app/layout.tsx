import "./globals.css";
import "./design.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Stageflow — Festival Operations",
  description: "Sahne arkasındaki her şey, aynı ritimde.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
