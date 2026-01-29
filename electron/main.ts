/**
 * Electron 메인 프로세스
 * - 개발: http://localhost:3000
 * - 프로덕션: NEXT_PUBLIC_APP_URL (빌드 시 config에 주입) 로드
 * - 외부 링크(공고 바로가기 등)는 기본 브라우저로 열기
 */

import { app, BrowserWindow, shell } from "electron";
import * as path from "path";
import * as fs from "fs";

const isDev = process.env.NODE_ENV !== "production";

/** Electron 패키지 시 resources 경로 (process.resourcesPath) */
const resourcesPath =
  typeof (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath === "string"
    ? (process as NodeJS.Process & { resourcesPath: string }).resourcesPath
    : path.join(__dirname, "..");

/** 로드할 앱 URL 반환 (개발: localhost, 프로덕션: config 또는 env) */
function getAppUrl(): string {
  if (isDev) {
    return process.env.ELECTRON_APP_URL || "http://localhost:3000";
  }
  try {
    const configPath = path.join(resourcesPath, "electron-app-url.json");
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (data.appUrl) return data.appUrl;
    }
  } catch {
    // ignore
  }
  return process.env.NEXT_PUBLIC_APP_URL || "https://your-project.vercel.app";
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  const appUrl = getAppUrl();
  mainWindow.loadURL(appUrl);

  // 새 창 요청 시 외부 링크는 기본 브라우저로 열기
  mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    const u = new URL(url);
    const appOrigin = new URL(appUrl).origin;
    if (u.origin !== appOrigin) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  // 링크 클릭 시 target=_blank 또는 외부 도메인은 기본 브라우저로
  mainWindow.webContents.on("will-navigate", (event: { preventDefault: () => void }, url: string) => {
    const u = new URL(url);
    const appOrigin = new URL(appUrl).origin;
    if (u.origin !== appOrigin) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
