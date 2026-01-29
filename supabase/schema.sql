-- 정책자금 스마트 매칭 시스템 DB 스키마 (Supabase/PostgreSQL)
-- 공고 표준 스키마: 업력/업종/지역/한도/금리/거치/상환 등 정규화 컬럼

-- =============================================================================
-- 1. 원문 저장: API 수집 Raw 데이터
-- =============================================================================
CREATE TABLE IF NOT EXISTS announcement_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL,
  source_ann_id TEXT NOT NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_name, source_ann_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_sources_source ON announcement_sources(source_name);
CREATE INDEX IF NOT EXISTS idx_announcement_sources_raw ON announcement_sources USING GIN(raw_payload);

COMMENT ON TABLE announcement_sources IS '공고 원문 저장. (source_name, source_ann_id)로 유니크, raw_payload에 API 응답 등 원본 JSON 저장.';

-- =============================================================================
-- 2. 기업(신청 기업) 프로필
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  biz_no TEXT UNIQUE,
  company_name TEXT NOT NULL,
  revenue BIGINT NOT NULL,
  industry_code TEXT,
  industry_name TEXT,
  est_date DATE,
  region TEXT,
  certifications TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 2.5 업종 마스터 (업종코드-표준산업분류 연계표, 드롭다운/자동완성용). KSIC 컬럼은 저장만, 매칭 미사용
-- =============================================================================
CREATE TABLE IF NOT EXISTS industry_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  biz_type TEXT NOT NULL,
  items TEXT[] DEFAULT '{}',
  keywords TEXT[] DEFAULT '{}',
  ksic TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_industry_master_code ON industry_master(code);
CREATE INDEX IF NOT EXISTS idx_industry_master_biz_type ON industry_master(biz_type);
CREATE INDEX IF NOT EXISTS idx_industry_master_name ON industry_master(name);

COMMENT ON TABLE industry_master IS '업종 마스터. 홈택스 업종코드/업종명/업태/종목. KSIC 저장만, 매칭에는 업태/종목/키워드 사용.';

-- =============================================================================
-- 3. 공고 정보 (정규화 컬럼 확장, source_name + source_ann_id 유니크로 upsert)
-- =============================================================================
CREATE TABLE IF NOT EXISTS grant_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL,
  source_ann_id TEXT NOT NULL,
  UNIQUE(source_name, source_ann_id),

  -- 기본 정보
  agency TEXT NOT NULL,
  title TEXT NOT NULL,
  max_amount BIGINT NOT NULL,
  url TEXT,

  -- 업력 (월 단위, 설립일 기준)
  min_age_months INT,
  max_age_months INT,

  -- 지역 (시/도, 시/군/구 – 복수 가능)
  region_sido TEXT[] DEFAULT '{}',
  region_sigungu TEXT[] DEFAULT '{}',

  -- 업종 포함/제외
  industry_includes TEXT[] DEFAULT '{}',
  industry_excludes TEXT[] DEFAULT '{}',

  -- 금리/거치/상환
  interest_rate_min NUMERIC(5,2),
  interest_rate_max NUMERIC(5,2),
  grace_months INT,
  repay_months INT,

  -- 일정
  deadline_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,

  -- 레거시·유연 필드 (기존 target_criteria, 단일 금리/거치 호환)
  target_criteria JSONB DEFAULT '{}',
  interest_rate NUMERIC(5,2),
  grace_period_months INT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 4. RLS 정책 대상 테이블 (user_id 소유 행)
-- =============================================================================
-- matching_results, notifications, company_verifications, company_data_sources:
-- user_id = auth.uid() 인 행만 클라이언트 SELECT 가능. insert/update/delete는 서버(service_role) 전용.
CREATE TABLE IF NOT EXISTS matching_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload JSONB DEFAULT '{}',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_matching_results_user_id ON matching_results(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_company_verifications_user_id ON company_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_company_data_sources_user_id ON company_data_sources(user_id);

-- =============================================================================
-- 5. RLS 활성화 (정책 적용 전에 활성화)
-- =============================================================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE grant_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE matching_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE industry_master ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 6. RLS 정책 (CREATE POLICY) — 적용 순서: ① user_profiles ② user_id 소유 테이블 ③ 읽기 전용 공고
-- insert/update/delete는 서버(service_role)에서만 수행. 클라이언트용 write 정책은 user_profiles만 생성.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ① user_profiles: auth.uid() = id 인 사용자만 select / insert / update 가능
-- -----------------------------------------------------------------------------
CREATE POLICY "user_profiles_select_own"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "user_profiles_insert_own"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "user_profiles_update_own"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- (delete는 클라이언트 정책 없음 — 서버 전용)

-- -----------------------------------------------------------------------------
-- ② matching_results, notifications, company_verifications, company_data_sources:
--    user_id = auth.uid() 인 행만 select 가능. insert/update/delete 정책 없음(서버 전용).
-- -----------------------------------------------------------------------------
CREATE POLICY "matching_results_select_own"
  ON matching_results FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "company_verifications_select_own"
  ON company_verifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "company_data_sources_select_own"
  ON company_data_sources FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- ③ grant_announcements, announcement_sources: 로그인 사용자(authenticated)는 select 가능(읽기 전용)
--    insert/update/delete 정책 없음 — 서버(service_role) 전용.
-- -----------------------------------------------------------------------------
CREATE POLICY "grant_announcements_select_authenticated"
  ON grant_announcements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "announcement_sources_select_authenticated"
  ON announcement_sources FOR SELECT
  TO authenticated
  USING (true);

-- -----------------------------------------------------------------------------
-- industry_master: authenticated SELECT (드롭다운/자동완성용)
-- -----------------------------------------------------------------------------
CREATE POLICY "industry_master_select_authenticated"
  ON industry_master FOR SELECT
  TO authenticated
  USING (true);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_user_profiles_biz_no ON user_profiles(biz_no);
CREATE INDEX IF NOT EXISTS idx_user_profiles_company_name ON user_profiles(company_name);

CREATE INDEX IF NOT EXISTS idx_grant_announcements_source ON grant_announcements(source_name);
CREATE INDEX IF NOT EXISTS idx_grant_announcements_agency ON grant_announcements(agency);
CREATE INDEX IF NOT EXISTS idx_grant_announcements_target_criteria ON grant_announcements USING GIN(target_criteria);
CREATE INDEX IF NOT EXISTS idx_grant_announcements_published ON grant_announcements(published_at);
CREATE INDEX IF NOT EXISTS idx_grant_announcements_deadline ON grant_announcements(deadline_at);
CREATE INDEX IF NOT EXISTS idx_grant_announcements_industry_includes ON grant_announcements USING GIN(industry_includes);
CREATE INDEX IF NOT EXISTS idx_grant_announcements_region_sido ON grant_announcements USING GIN(region_sido);

COMMENT ON TABLE grant_announcements IS '정제된 공고. (source_name, source_ann_id) 유니크로 upsert. 업력/업종/지역/한도/금리/거치/상환 정규화 컬럼.';

-- =============================================================================
-- 7. Upsert 헬퍼 (선택): source_name + source_ann_id 기준 갱신
-- =============================================================================
-- 아래 INSERT ... ON CONFLICT (source_name, source_ann_id) DO UPDATE ... 로 upsert 가능.

-- =============================================================================
-- 8. 샘플 데이터: 기존 샘플 공고를 새 스키마로 변환·적재
-- =============================================================================
-- 실행 조건: 위 1~3번 테이블(announcement_sources, grant_announcements 새 스키마) 적용 후 실행.
-- 기존에 ann_id 단일 PK의 grant_announcements만 있으면, 테이블 재생성 또는 마이그레이션 후 실행.
--
-- (1) 원문 저장: announcement_sources
INSERT INTO announcement_sources (source_name, source_ann_id, raw_payload)
VALUES
  ('kosbi', '2024-001', '{"agency":"중소벤처기업진흥공단","title":"중소기업 기술개발 자금 지원","max_amount":500000000,"interest_rate":1.5,"grace_months":12}'::jsonb),
  ('sbc', '2024-002', '{"agency":"소상공인시장진흥공단","title":"소상공인 경영안정 자금","max_amount":100000000,"interest_rate":2.0,"grace_months":6}'::jsonb),
  ('kibo', '2024-003', '{"agency":"신용보증기금","title":"일반 보증 지원","max_amount":300000000,"interest_rate":2.5,"grace_months":12}'::jsonb),
  ('kstartup', '2024-004', '{"agency":"K-Startup","title":"벤처 성장 자금","max_amount":1000000000,"interest_rate":1.0,"grace_months":24}'::jsonb),
  ('ntis', '2024-005', '{"agency":"NTIS R&D","title":"중소기업 R&D 지원","max_amount":200000000,"interest_rate":0,"grace_months":36}'::jsonb)
ON CONFLICT (source_name, source_ann_id) DO UPDATE SET
  raw_payload = EXCLUDED.raw_payload,
  updated_at = now();

-- (2) 정규화 공고: grant_announcements (업력=월 단위, min_age_months = min_years*12 등)
INSERT INTO grant_announcements (
  source_name,
  source_ann_id,
  agency,
  title,
  max_amount,
  url,
  min_age_months,
  max_age_months,
  region_sido,
  region_sigungu,
  industry_includes,
  industry_excludes,
  interest_rate_min,
  interest_rate_max,
  grace_months,
  repay_months,
  deadline_at,
  published_at,
  target_criteria,
  interest_rate,
  grace_period_months
)
VALUES
  (
    'kosbi', '2024-001',
    '중소벤처기업진흥공단',
    '중소기업 기술개발 자금 지원',
    500000000,
    NULL,
    12, 240,
    '{}', '{}',
    '{}', '{}',
    1.5, 1.5,
    12, NULL,
    NULL, now(),
    '{"minRevenue":100000000,"maxRevenue":50000000000,"minYears":1,"maxYears":20}'::jsonb,
    1.5, 12
  ),
  (
    'sbc', '2024-002',
    '소상공인시장진흥공단',
    '소상공인 경영안정 자금',
    100000000,
    NULL,
    NULL, 84,
    '{}', '{}',
    '{}', '{}',
    2.0, 2.0,
    6, NULL,
    NULL, now(),
    '{"maxRevenue":800000000,"maxYears":7}'::jsonb,
    2.0, 6
  ),
  (
    'kibo', '2024-003',
    '신용보증기금',
    '일반 보증 지원',
    300000000,
    NULL,
    NULL, NULL,
    '{}', '{}',
    '{}', '{}',
    2.5, 2.5,
    12, NULL,
    NULL, now(),
    '{}'::jsonb,
    2.5, 12
  ),
  (
    'kstartup', '2024-004',
    'K-Startup',
    '벤처 성장 자금',
    1000000000,
    NULL,
    0, 84,
    '{}', '{}',
    '{}', '{}',
    1.0, 1.0,
    24, NULL,
    NULL, now(),
    '{"requiredCerts":["벤처"],"minYears":0,"maxYears":7}'::jsonb,
    1.0, 24
  ),
  (
    'ntis', '2024-005',
    'NTIS R&D',
    '중소기업 R&D 지원',
    200000000,
    NULL,
    NULL, NULL,
    '{}', '{}',
    '{}', '{}',
    0, 0,
    36, NULL,
    NULL, now(),
    '{"minRevenue":50000000}'::jsonb,
    0, 36
  )
ON CONFLICT (source_name, source_ann_id) DO UPDATE SET
  agency = EXCLUDED.agency,
  title = EXCLUDED.title,
  max_amount = EXCLUDED.max_amount,
  min_age_months = EXCLUDED.min_age_months,
  max_age_months = EXCLUDED.max_age_months,
  interest_rate_min = EXCLUDED.interest_rate_min,
  interest_rate_max = EXCLUDED.interest_rate_max,
  grace_months = EXCLUDED.grace_months,
  repay_months = EXCLUDED.repay_months,
  target_criteria = EXCLUDED.target_criteria,
  interest_rate = EXCLUDED.interest_rate,
  grace_period_months = EXCLUDED.grace_period_months,
  updated_at = now();
