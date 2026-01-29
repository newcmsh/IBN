/**
 * API 응답 파싱: JSON 또는 XML → JSON 객체
 * Bizinfo 등 공공 API가 XML을 반환할 경우 대비.
 */

import { XMLParser } from "fast-xml-parser";

const xmlParser = new XMLParser({
  ignoreDeclaration: true,
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

export function parseApiResponse(body: string, contentType: string | null): unknown {
  const isXml =
    (contentType && contentType.toLowerCase().includes("xml")) ||
    body.trimStart().startsWith("<");
  if (isXml) {
    try {
      return xmlParser.parse(body) as unknown;
    } catch {
      return null;
    }
  }
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}
