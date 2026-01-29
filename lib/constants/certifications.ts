/**
 * 정책자금에 유리한 인증/자격 체크박스 목록 (내부 상담용)
 * KSIC 미사용. 체크된 값은 매칭 점수·reason에 반영 (진위 검증/원문 업로드는 별도 단계)
 */

export interface CertificationItem {
  key: string;
  label: string;
}

export interface CertificationGroup {
  group: string;
  items: CertificationItem[];
}

export const CERTIFICATION_GROUPS: CertificationGroup[] = [
  {
    group: "기업 인증",
    items: [
      { key: "venture", label: "벤처기업 확인" },
      { key: "innobiz", label: "이노비즈(Inno-Biz)" },
      { key: "mainbiz", label: "메인비즈(Main-Biz)" },
      { key: "research_lab", label: "기업부설연구소 / 연구개발전담부서" },
      { key: "social_enterprise", label: "사회적기업(인증/예비)" },
      { key: "women_owned", label: "여성기업" },
      { key: "disabled_owned", label: "장애인기업" },
      { key: "startup_company", label: "창업기업(업력 기준 해당)" },
    ],
  },
  {
    group: "기술·지식재산",
    items: [
      { key: "patent", label: "특허 보유(등록)" },
      { key: "utility_model", label: "실용신안/디자인권 보유" },
      { key: "trademark", label: "상표 등록" },
      { key: "net", label: "NET(신기술)" },
      { key: "nep", label: "NEP(신제품)" },
    ],
  },
  {
    group: "품질·경영·보안",
    items: [
      { key: "iso9001", label: "ISO 9001(품질경영)" },
      { key: "iso14001", label: "ISO 14001(환경)" },
      { key: "iso45001", label: "ISO 45001(안전보건)" },
      { key: "iso27001", label: "ISO 27001(정보보안)" },
      { key: "isms", label: "ISMS / ISMS-P" },
      { key: "haccp", label: "HACCP" },
      { key: "gmp", label: "GMP" },
    ],
  },
  {
    group: "수출·글로벌",
    items: [
      { key: "export_experience", label: "수출실적 보유" },
      { key: "direct_export", label: "직접/간접 수출 경험" },
      { key: "certified_exporter", label: "원산지인증수출자" },
    ],
  },
  {
    group: "증빙 가능 상태(상담 참고용)",
    items: [
      { key: "tax_clearance", label: "국세 납세증명 가능" },
      { key: "local_tax_clearance", label: "지방세 납세증명 가능" },
      { key: "insurance_clearance", label: "4대보험 완납증명 가능" },
    ],
  },
];

/** 인증 키 → 라벨 맵 (reason 문구용) */
export const CERT_LABEL_MAP: Record<string, string> = {};
CERTIFICATION_GROUPS.forEach((g) => {
  g.items.forEach((i) => {
    CERT_LABEL_MAP[i.key] = i.label;
  });
});
