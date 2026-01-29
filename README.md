# 정책자금 스마트 매칭 시스템 (가칭)

정책자금 컨설팅 사업자를 위한 **앱/웹**입니다.  
신청 기업의 **회사명, 매출, 직군**을 입력하면, **예상 지원금**, **지원금 받을 확률**, **어디서 지원받는 게 유리한지**를 매칭해서 보여줍니다.  
Open API로 외부에서도 매칭 결과를 조회할 수 있도록 구성했습니다.

## 기술 스택

- **Frontend**: Next.js 14 (React), Tailwind CSS
- **Backend**: Next.js API Routes, (선택) Supabase
- **Mobile**: 추후 Capacitor로 iOS/Android 하이브리드 배포 가능

## 주요 기능

- **기업 정보 입력**: 회사명, 매출, 직군(업종), 설립일, 지역, 보유 인증
- **매칭 결과**: 예상 지원금, 당선 확률(%), 최적 창구(금리·거치기간 우선)
- **Open API**: `POST /api/match` 로 동일 로직 호출 가능

## 데이터 소스 (API KEY 연동 대상)

기업마당, 보조금24, 중진공, 소진공, 신용보증기금, 신용보증재단, 기술보증기금, K-Startup, NTIS(R&D), 고용노동부, 코트라, 한국무역협회 등 정책자금 관련 공고를 Open API로 수집·정제해 사용할 수 있습니다.  
현재는 **샘플 공고**로 매칭이 동작하며, 실제 연동 시 `lib/data/grants.ts` 및 Supabase `grant_announcements` 테이블을 각 기관 API로 채우면 됩니다.

## 실행 방법

```bash
# 의존성 설치
npm install

# .env.local 생성 (선택, .env.example 참고)
# NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY 등

# 개발 서버
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속 후, 왼쪽 폼에 기업 정보를 입력하고 **매칭 결과 보기**를 누르면 예상 지원금·당선 확률·최적 창구를 확인할 수 있습니다.

## 문서

- **총 작업 내역**: [docs/PROJECT_WORK_SUMMARY.md](docs/PROJECT_WORK_SUMMARY.md) — 지금까지 요청·반영된 개발 작업 전부 정리
- **개발 문서 (신규 개발자용)**: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — 현재까지 구현된 코드, 타입, API, UI, DB 스키마, 확장 가이드
- **공공 API 연동**: [docs/API_INTEGRATION.md](docs/API_INTEGRATION.md)

## 프로젝트 구조

- `app/` – Next.js App Router (페이지, 레이아웃, `/api/match`)
- `components/` – CompanyForm, MatchingCard, Dashboard
- `lib/` – 타입, 매칭 알고리즘, Supabase 클라이언트, 공고 데이터
- `supabase/schema.sql` – user_profiles, grant_announcements 테이블
- `docs/API_INTEGRATION.md` – 공공 API 연동 및 본 서비스 Open API 사용법

## Open API (매칭)

- **엔드포인트**: `POST /api/match`
- **Body**: `{ "companyName": "회사명", "revenue": 매출원, "industryName": "직군" }` 등
- **응답**: `totalExpectedAmount`, `matchCount`, `matches`, `bestMatch` 등

자세한 요청/응답 필드와 공공 API 연동 방법은 `docs/API_INTEGRATION.md`를 참고하세요.

## 로드맵

- **Phase 1**: 기업마당 등 1차 API 연동 + 기업 프로필 수동 입력 (현재 구조)
- **Phase 2**: 홈택스/기업정보 API로 매출·업종 자동 연동
- **Phase 3**: 매칭 알고리즘 고도화 + Capacitor iOS/Android 앱 배포
