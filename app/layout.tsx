import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IBN 정책자금 스마트 매칭 | 지원금 매칭 시스템",
  description: "기업 정보 기반 정책자금·보조금 매칭, 예상 지원금·확률 산출",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
