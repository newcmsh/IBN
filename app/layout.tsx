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
      <head>
        {/* 
          Fallback: 일부 환경(Electron 캐시/네트워크 등)에서 /_next/static/css 로드가 실패하면
          Tailwind 유틸이 적용되지 않아 UI가 기본 HTML처럼 보일 수 있습니다.
          그 경우에만(no-tw) 최소한의 “이전 톤(부드러운 폼)”을 유지하도록 방어합니다.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var e=document.documentElement;var v=getComputedStyle(e).getPropertyValue('--tw-border-spacing-x');if(!v){e.classList.add('no-tw');}}catch(_){}})();`,
          }}
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `
html.no-tw, html.no-tw body{height:100%}
html.no-tw body{
  margin:0;
  font-family: system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif;
  color:#0f172a;
  background: radial-gradient(circle at top left, #eef2ff 0, #fdf2f8 30%, #f9fafb 70%);
}
html.no-tw main{min-height:100vh}
html.no-tw input, html.no-tw select, html.no-tw button, html.no-tw textarea{
  font: inherit;
  font-size: 14px;
}
html.no-tw label{font-size:14px;color:#475569;font-weight:600}
html.no-tw input[type="text"], html.no-tw input[type="password"], html.no-tw input[type="email"], html.no-tw select, html.no-tw textarea{
  width:100%;
  box-sizing:border-box;
  border:1px solid #e2e8f0;
  border-radius: 12px;
  padding: 10px 12px;
  background: #fff;
}
html.no-tw input[readonly]{
  background:#f8fafc;
  color:#334155;
}
html.no-tw button{
  border:1px solid #e2e8f0;
  border-radius: 12px;
  padding: 10px 12px;
  background:#fff;
  cursor:pointer;
}
html.no-tw button:hover{background:#f8fafc}
html.no-tw button:disabled{opacity:.5;cursor:not-allowed}
html.no-tw form{
  background: rgba(255,255,255,.9);
  border: 1px solid #f1f5f9;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 12px 30px rgba(15,23,42,.10);
  backdrop-filter: blur(10px);
}
            `,
          }}
        />
      </head>
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
