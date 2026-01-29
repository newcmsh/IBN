/**
 * Electron 빌드 시 앱 URL 주입
 * NEXT_PUBLIC_APP_URL을 electron-app-url.json에 써서 exe 패키지에 포함
 */
const fs = require("fs");
const path = require("path");

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://your-project.vercel.app";
const outPath = path.join(__dirname, "..", "electron-app-url.json");
fs.writeFileSync(outPath, JSON.stringify({ appUrl }, null, 0), "utf-8");
console.log("Wrote electron-app-url.json with appUrl:", appUrl);
