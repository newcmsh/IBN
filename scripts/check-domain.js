/**
 * 배포 도메인 연결·상태 확인
 * 사용: node scripts/check-domain.js [도메인]
 * 예: node scripts/check-domain.js https://ibn-98k9.vercel.app
 */

const base = process.argv[2] || "https://ibn-98k9.vercel.app";
const baseUrl = base.replace(/\/$/, "");

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // ignore
  }
  return { ok: res.ok, status: res.status, json, text: text.slice(0, 300) };
}

async function main() {
  console.log("도메인:", baseUrl);
  console.log("");

  // 1) 메인 페이지
  console.log("[1] 메인 페이지 GET", baseUrl + "/");
  try {
    const r = await fetch(baseUrl + "/", { redirect: "manual" });
    console.log("    상태:", r.status, r.statusText, r.redirected ? "(리다이렉트: " + r.url + ")" : "");
  } catch (e) {
    console.log("    오류:", e.message);
  }
  console.log("");

  // 2) 공고 상태 API (매칭이 DB/샘플 중 뭘 쓰는지)
  console.log("[2] 공고 상태 GET", baseUrl + "/api/grants/status");
  try {
    const { ok, status, json, text } = await fetchJson(baseUrl + "/api/grants/status");
    console.log("    상태:", status, ok ? "OK" : "");
    if (json) {
      console.log("    supabaseConfigured:", json.supabaseConfigured);
      console.log("    source:", json.source);
      console.log("    count:", json.count);
      if (json.reason) console.log("    reason:", json.reason);
      if (json.error) console.log("    error:", json.error);
    } else {
      console.log("    응답(일부):", text);
    }
  } catch (e) {
    console.log("    오류:", e.message);
  }
  console.log("");

  // 3) 매칭 API (POST) - 간단히 동작만 확인
  console.log("[3] 매칭 API POST", baseUrl + "/api/match");
  try {
    const r = await fetch(baseUrl + "/api/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: "테스트",
        revenue: 100000000,
        bizType: ["제조"],
        items: ["제조"],
      }),
    });
    const out = await r.json().catch(() => ({}));
    console.log("    상태:", r.status);
    if (out._meta) {
      console.log("    _meta.source:", out._meta.announcementsSource);
      console.log("    _meta.count:", out._meta.announcementsCount);
    }
    if (out.error) console.log("    error:", out.error);
  } catch (e) {
    console.log("    오류:", e.message);
  }

  console.log("");
  console.log("체크 완료.");
}

main();
