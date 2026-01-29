"use client";

import { useState } from "react";
import { CERTIFICATION_GROUPS } from "@/lib/constants/certifications";
import { formatRevenueDisplay, parseRevenueNumber, toKoreanWon } from "@/lib/utils/koreanNumber";

export interface CompanyFormData {
  bizNo: string;
  companyName: string;
  /** 매출액 표시용 (쉼표 포맷, 예: "1,000,000") */
  revenue: string;
  /** 업태 복수 선택 */
  bizTypes: string[];
  items: string[];
  industryKeywords: string[];
  estDate: string;
  region: string;
  /** 인증/자격 키 배열 (내부 상담용) */
  certifications: string[];
}

export type BizVerifyStatus = "idle" | "loading" | "success" | "fail";

const DEFAULT: CompanyFormData = {
  bizNo: "",
  companyName: "",
  revenue: "",
  bizTypes: [],
  items: [],
  industryKeywords: [],
  estDate: "",
  region: "",
  certifications: [],
};

/** 한글 월 라벨 (설립일 선택용) */
const MONTH_LABELS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

/** 업태 드롭다운 하드코딩 (엑셀/업종마스터 미사용) */
const BIZ_TYPES = ["제조", "도소매", "서비스", "건설", "운수", "숙박음식", "정보통신", "농축수산", "기타"];

export default function CompanyForm({
  onSubmit,
  loading,
}: {
  onSubmit: (data: CompanyFormData) => void;
  loading?: boolean;
}) {
  const [form, setForm] = useState<CompanyFormData>(DEFAULT);
  const [verifyStatus, setVerifyStatus] = useState<BizVerifyStatus>("idle");
  const [verifyMessage, setVerifyMessage] = useState<string>("");
  const [itemInput, setItemInput] = useState("");
  const [keywordInput, setKeywordInput] = useState("");

  const handleVerify = async () => {
    const raw = form.bizNo.trim();
    if (!raw) {
      setVerifyMessage("사업자번호를 입력한 뒤 검증해 주세요.");
      setVerifyStatus("fail");
      return;
    }
    setVerifyStatus("loading");
    setVerifyMessage("");
    try {
      const res = await fetch("/api/verify-biz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bizNo: raw }),
      });
      const data = (await res.json()) as { status?: string; message?: string; error?: string };
      const message = data.message ?? data.error ?? (res.ok ? "검증 완료" : "검증 요청 실패");
      setVerifyMessage(message);
      setVerifyStatus(res.ok && data.status === "active" ? "success" : "fail");
    } catch {
      setVerifyMessage("검증 요청 중 오류가 발생했습니다.");
      setVerifyStatus("fail");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.bizTypes.length === 0) return;
    if (!form.items.length) return;
    onSubmit(form);
  };

  const handleRevenueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    const formatted = raw === "" ? "" : formatRevenueDisplay(raw);
    setForm((p) => ({ ...p, revenue: formatted }));
  };

  const toggleBizType = (b: string) => {
    setForm((p) =>
      p.bizTypes.includes(b) ? { ...p, bizTypes: p.bizTypes.filter((x) => x !== b) } : { ...p, bizTypes: [...p.bizTypes, b] }
    );
  };

  // 설립일 파싱 (YYYY-MM-DD → 연/월/일)
  const estDateParts = (() => {
    if (!form.estDate || !/^\d{4}-\d{2}-\d{2}$/.test(form.estDate)) return { year: "", month: "", day: "" };
    const [y, m, d] = form.estDate.split("-").map(Number);
    return { year: String(y), month: String(m), day: String(d) };
  })();

  const getDaysInMonth = (year: number, month: number) => {
    if (!year || !month) return 31;
    const d = new Date(year, month, 0);
    return d.getDate();
  };

  const handleEstDateChange = (part: "year" | "month" | "day", value: string) => {
    const y = part === "year" ? value : estDateParts.year || String(new Date().getFullYear());
    const m = part === "month" ? value : estDateParts.month || "1";
    const d = part === "day" ? value : estDateParts.day || "1";
    const year = Number(y) || 0;
    const month = Math.min(12, Math.max(1, Number(m) || 1));
    const dayNum = Number(d) || 1;
    if (!year) {
      setForm((p) => ({ ...p, estDate: "" }));
      return;
    }
    const maxDay = getDaysInMonth(year, month);
    const dayClamped = Math.min(Math.max(1, dayNum), maxDay);
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(dayClamped).padStart(2, "0")}`;
    setForm((p) => ({ ...p, estDate: dateStr }));
  };


  const addItem = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || form.items.includes(trimmed)) return;
    setForm((p) => ({
      ...p,
      items: [...p.items, trimmed],
      industryKeywords: [...new Set([...p.industryKeywords, trimmed])],
    }));
    setItemInput("");
  };

  const removeItem = (index: number) => {
    setForm((p) => ({ ...p, items: p.items.filter((_, i) => i !== index) }));
  };

  const addKeyword = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || form.industryKeywords.includes(trimmed)) return;
    setForm((p) => ({ ...p, industryKeywords: [...p.industryKeywords, trimmed] }));
    setKeywordInput("");
  };

  const removeKeyword = (index: number) => {
    setForm((p) => ({ ...p, industryKeywords: p.industryKeywords.filter((_, i) => i !== index) }));
  };

  const handleItemKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addItem(itemInput);
    }
  };

  const handleKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addKeyword(keywordInput);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-slate-100 bg-white/90 p-6 shadow-lg shadow-slate-200/60 backdrop-blur"
    >
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">기업 정보 입력</h2>

      <div>
        <label className="block text-sm font-medium text-slate-600">사업자번호</label>
        <div className="mt-1 flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={form.bizNo}
            onChange={(e) => {
              setForm((p) => ({ ...p, bizNo: e.target.value }));
              if (verifyStatus !== "idle") setVerifyStatus("idle");
            }}
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-300 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            placeholder="000-00-00000 또는 10자리"
          />
          <button
            type="button"
            onClick={handleVerify}
            disabled={loading || verifyStatus === "loading"}
            className="shrink-0 rounded-xl bg-slate-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
          >
            {verifyStatus === "loading" ? "검증 중..." : "검증"}
          </button>
        </div>
        {verifyMessage && (
          <p
            className={`mt-1.5 text-sm ${
              verifyStatus === "success" ? "text-green-600" : verifyStatus === "fail" ? "text-amber-700" : "text-slate-600"
            }`}
          >
            {verifyMessage}
            {verifyStatus === "fail" && (
              <span className="ml-1 block text-slate-500">수동 입력으로 계속 진행할 수 있습니다.</span>
            )}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-600">회사명 *</label>
        <input
          type="text"
          value={form.companyName}
          onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-300 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          placeholder="(주)예시기업"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-600">매출액 (원) *</label>
        <input
          type="text"
          inputMode="numeric"
          value={form.revenue}
          onChange={handleRevenueChange}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-300 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          placeholder="1,000,000"
          required
        />
        {form.revenue && parseRevenueNumber(form.revenue) > 0 && (
          <p className="mt-1 text-sm text-slate-600">
            <span className="font-medium text-primary-600">{toKoreanWon(parseRevenueNumber(form.revenue))}</span>
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-600">업태 * (복수 선택 가능)</label>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
          {BIZ_TYPES.map((b) => (
            <label key={b} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.bizTypes.includes(b)}
                onChange={() => toggleBizType(b)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span>{b}</span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-500">최소 1개 이상 선택</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-600">종목 * (엔터·쉼표로 추가)</label>
        <input
          type="text"
          value={itemInput}
          onChange={(e) => setItemInput(e.target.value)}
          onKeyDown={handleItemKeyDown}
          onBlur={() => itemInput.trim() && addItem(itemInput)}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-300 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          placeholder="종목 입력 후 Enter 또는 쉼표"
        />
        {form.items.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {form.items.map((item, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-lg bg-primary-100 px-2.5 py-0.5 text-sm text-primary-800"
              >
                {item}
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  className="ml-1.5 text-primary-600 hover:text-primary-800"
                  aria-label="제거"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <p className="mt-1 text-xs text-slate-500">최소 1개 이상 입력</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-600">매칭 키워드 (종목에서 자동 반영, 추가 입력 가능)</label>
        <input
          type="text"
          value={keywordInput}
          onChange={(e) => setKeywordInput(e.target.value)}
          onKeyDown={handleKeywordKeyDown}
          onBlur={() => keywordInput.trim() && addKeyword(keywordInput)}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-300 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          placeholder="키워드 입력 후 Enter 또는 쉼표"
        />
        {form.industryKeywords.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {form.industryKeywords.map((kw, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-0.5 text-sm text-slate-700"
              >
                {kw}
                <button
                  type="button"
                  onClick={() => removeKeyword(i)}
                  className="ml-1.5 text-slate-500 hover:text-slate-800"
                  aria-label="제거"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-600">설립일</label>
          <div className="mt-1 flex gap-2">
            <select
              value={estDateParts.year}
              onChange={(e) => handleEstDateChange("year", e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 px-2 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              aria-label="연도"
            >
              <option value="">연도</option>
              {Array.from({ length: new Date().getFullYear() - 1989 }, (_, i) => new Date().getFullYear() - i).map(
                (y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                )
              )}
            </select>
            <select
              value={estDateParts.month}
              onChange={(e) => handleEstDateChange("month", e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 px-2 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              aria-label="월"
            >
              <option value="">월</option>
              {MONTH_LABELS.map((label, i) => (
                <option key={i} value={i + 1}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={estDateParts.day}
              onChange={(e) => handleEstDateChange("day", e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 px-2 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              aria-label="일"
            >
              <option value="">일</option>
              {Array.from(
                {
                  length: getDaysInMonth(
                    Number(estDateParts.year) || new Date().getFullYear(),
                    Number(estDateParts.month) || 1
                  ),
                },
                (_, i) => i + 1
              ).map((d) => (
                <option key={d} value={d}>
                  {d}일
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600">지역</label>
          <input
            type="text"
            value={form.region}
            onChange={(e) => setForm((p) => ({ ...p, region: e.target.value }))}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-300 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            placeholder="서울, 경기 등"
          />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-slate-600">인증/자격 보유 여부 (내부 상담용)</p>
        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
          {CERTIFICATION_GROUPS.map((grp) => (
            <div key={grp.group}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {grp.group}
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
                {grp.items.map((item) => (
                  <label
                    key={item.key}
                    className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={form.certifications.includes(item.key)}
                      onChange={(e) => {
                        setForm((p) => ({
                          ...p,
                          certifications: e.target.checked
                            ? [...p.certifications, item.key]
                            : p.certifications.filter((k) => k !== item.key),
                        }));
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <button
        type="submit"
        disabled={loading || form.bizTypes.length === 0 || form.items.length === 0}
        className="w-full rounded-xl bg-primary-500 py-3.5 text-sm font-semibold text-white shadow-md shadow-primary-200 transition hover:bg-primary-400 hover:shadow-lg disabled:opacity-50"
      >
        {loading ? "매칭 중..." : "매칭 결과 보기"}
      </button>
    </form>
  );
}
