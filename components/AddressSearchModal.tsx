"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Script from "next/script";

declare global {
  interface Window {
    daum?: any;
  }
}

type AddressTypeLabel = "도로명" | "지번";

export type AddressSelection = {
  zipcode: string;
  address1: string;
  addressType: AddressTypeLabel;
};

function parseRegionFromAddress1(address1: string): { regionSido?: string; regionSigungu?: string } {
  const tokens = (address1 ?? "").trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return {};

  const rawSido = tokens[0];
  const normalizeSido = (s: string) => {
    // 예: 서울특별시 -> 서울, 경기도 -> 경기, 세종특별자치시 -> 세종
    const stripped = s
      .replace(/특별자치시$/g, "")
      .replace(/특별자치도$/g, "")
      .replace(/특별시$/g, "")
      .replace(/광역시$/g, "")
      .replace(/자치도$/g, "")
      .replace(/도$/g, "");
    return stripped || s;
  };

  const regionSido = normalizeSido(rawSido);
  const regionSigungu = tokens.length >= 2 ? tokens[1] : undefined;
  return {
    regionSido: regionSido || undefined,
    regionSigungu: regionSigungu || undefined,
  };
}

export default function AddressSearchModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (sel: AddressSelection & { regionSido?: string; regionSigungu?: string }) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  const scriptSrc = useMemo(
    () => "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js",
    []
  );

  useEffect(() => {
    if (!open) return;
    if (!scriptReady) return;
    if (!containerRef.current) return;
    if (!window.daum?.Postcode) return;

    // 처음 열릴 때 레이아웃이 끝난 뒤 임베드하도록 한 프레임 대기 (잘림 방지)
    const frameId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!containerRef.current) return;
        const el = containerRef.current;
        el.innerHTML = "";

        const postcode = new window.daum.Postcode({
          oncomplete: (data: any) => {
            const zipcode = String(data?.zonecode ?? "").trim();
            const userSelectedType = String(data?.userSelectedType ?? "").toUpperCase(); // R | J
            const addressType: AddressTypeLabel = userSelectedType === "R" ? "도로명" : "지번";
            const address1Raw =
              userSelectedType === "R"
                ? String(data?.roadAddress ?? "")
                : String(data?.jibunAddress ?? "");
            const address1 = (address1Raw || String(data?.address ?? "") || "").trim();

            const { regionSido, regionSigungu } = parseRegionFromAddress1(address1);
            onSelect({ zipcode, address1, addressType, regionSido, regionSigungu });
            onClose();
          },
          width: "100%",
          height: "100%",
        });

        postcode.embed(el);

        // Daum iframe이 컨테이너 크기를 올바르게 쓰도록 resize 한 번 발생
        setTimeout(() => {
          window.dispatchEvent(new Event("resize"));
        }, 50);
      });
    });

    return () => cancelAnimationFrame(frameId);
  }, [open, scriptReady, onClose, onSelect]);

  if (!open) {
    // Script는 화면 전환 없이도 1회 로드되게 항상 렌더링
    return (
      <Script
        src={scriptSrc}
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
    );
  }

  const modalContent = (
    <>
      <Script
        src={scriptSrc}
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />

      <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-auto p-4">
        <button
          type="button"
          className="absolute inset-0 bg-black/50"
          onClick={onClose}
          aria-label="주소 검색 닫기"
        />
        {/* Daum 우편번호 UI 최소 500px 필요; 좁은 화면에서는 스크롤로 전체 노출 */}
        <div
          className="relative z-10 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          style={{
            width: "min(600px, 95vw)",
            minWidth: "500px",
            height: "min(90vh, 600px)",
            maxHeight: "600px",
          }}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">우편번호 검색</p>
              <p className="mt-0.5 text-xs text-slate-500">주소를 선택하면 자동으로 입력됩니다.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              닫기
            </button>
          </div>

          <div className="min-h-0 flex-1">
            {!scriptReady && (
              <div className="flex h-full min-h-[400px] items-center justify-center text-sm text-slate-500">
                주소 검색 모듈을 불러오는 중...
              </div>
            )}
            <div
              ref={containerRef}
              className={`h-full w-full ${scriptReady ? "" : "hidden"}`}
              style={{ minHeight: "450px" }}
            />
          </div>
        </div>
      </div>
    </>
  );

  // 폼/사이드바 overflow에 잘리지 않도록 body에 직접 렌더
  if (typeof document !== "undefined") {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}

