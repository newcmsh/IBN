/**
 * 공고 원문 파싱 모듈
 * - 원문(또는 상세 본문) → LLM → 표준 스키마(업력/업종/지역/한도/금리/거치/상환) + target_criteria
 * - LLM 키(OPENAI_API_KEY 등)는 서버에서만 process.env로 읽음
 */

export type { ParsedAnnouncement } from "./types";
export { buildParsingPrompt, PARSING_SYSTEM_PROMPT, PARSING_USER_PROMPT_PREFIX } from "./prompt";
export {
  parseWithLLM,
  extractJsonFromLLMResponse,
  normalizeParsed,
  type LLMParser,
} from "./parseWithLLM";
export {
  batchParseAndUpsert,
  batchParseAndUpsertFromSource,
  extractTextFromRawPayload,
  PARSE_LIMIT_DEFAULT,
  PARSE_LIMIT_MAX,
  type BatchParseFromSourceOptions,
  type BatchParseFromSourceResult,
  type ParseBatchEntry,
  type ParseBatchResult,
} from "./batch";
