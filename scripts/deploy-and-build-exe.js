/**
 * 1) Vercel 프로덕션 배포
 * 2) 배포 URL을 electron-app-url.json에 기록
 * 3) Electron exe 빌드 (exe 실행 시 해당 URL 로드)
 *
 * 사전: npx vercel link 로 프로젝트 연결, vercel login 완료
 * 실행: node scripts/deploy-and-build-exe.js 또는 npm run deploy:exe
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");

function main() {
  console.log("[1/4] Vercel 프로덕션 배포 중...");
  let url;
  try {
    const out = execSync("npx vercel deploy --prod --yes", {
      encoding: "utf-8",
      cwd: rootDir,
    });
    // stdout에서 https://...vercel.app URL 추출 (ANSI 코드 제거 후)
    const clean = out.replace(/\x1b\[[0-9;]*m/g, "").trim();
    const match = clean.match(/https:\/\/[^\s\]\)"'<>]+\.vercel\.app/);
    url = match ? match[0] : null;
    if (!url) {
      const firstLine = clean.split(/\r?\n/)[0]?.trim();
      if (firstLine && firstLine.startsWith("http")) url = firstLine;
    }
    if (!url || !url.startsWith("http")) {
      console.error("배포 URL을 찾을 수 없습니다. 출력:", out.slice(0, 500));
      process.exit(1);
    }
    console.log("배포 URL:", url);
  } catch (e) {
    console.error("Vercel 배포 실패:", e.message || e);
    process.exit(1);
  }

  console.log("[2/4] electron-app-url.json 작성...");
  const configPath = path.join(rootDir, "electron-app-url.json");
  fs.writeFileSync(configPath, JSON.stringify({ appUrl: url }, null, 0), "utf-8");

  console.log("[3/4] Electron 메인 컴파일...");
  execSync("npm run electron:compile", { cwd: rootDir, stdio: "inherit" });

  console.log("[4/4] Electron exe 빌드...");
  execSync("npx electron-builder", { cwd: rootDir, stdio: "inherit" });

  console.log("완료. exe는 dist/ 폴더에 생성되었으며, 실행 시 다음 URL을 로드합니다:", url);
}

main();
