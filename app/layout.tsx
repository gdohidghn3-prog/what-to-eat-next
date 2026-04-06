import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import Disclaimer from "@/components/Disclaimer";

const noto = Noto_Sans_KR({ subsets: ["latin"], weight: ["400", "500", "700"] });

export const metadata: Metadata = {
  title: "오늘 뭐 먹지? - 점심 메뉴 랜덤 뽑기",
  description: "점심 고민 끝! 내 주변 음식점을 랜덤으로 골라드립니다.",
  keywords: ["점심 메뉴", "랜덤 뽑기", "오늘 뭐 먹지", "맛집 추천"],
  openGraph: {
    title: "오늘 뭐 먹지? - 점심 메뉴 랜덤 뽑기",
    description: "점심 고민 끝! 내 주변 음식점을 랜덤으로 골라드립니다.",
    type: "website",
    locale: "ko_KR",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${noto.className} h-full antialiased`}>
      <body className="min-h-full bg-[#FAFAFA]">{children}<Disclaimer /></body>
    </html>
  );
}
