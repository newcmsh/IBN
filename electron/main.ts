/**
 * Electron 메인 프로세스
 * - 개발: http://localhost:3000
 * - 프로덕션: NEXT_PUBLIC_APP_URL (빌드 시 config에 주입) 로드
 * - 외부 링크(공고 바로가기 등)는 기본 브라우저로 열기
 */

import { app, BrowserWindow, shell, Menu } from "electron";
import * as path from "path";
import * as fs from "fs";

const isDev = process.env.NODE_ENV !== "production";

// Windows 작업표시줄/창 타이틀에 앱 이름 반영
app.setName("IBN 정책자금 스마트 매칭");
if (process.platform === "win32") {
  app.setAppUserModelId("com.ibn.policy-fund-matching");
}

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
    backgroundColor: "#0b1220",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  mainWindow.setTitle("IBN 정책자금 스마트 매칭");

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  const appUrl = getAppUrl();

  const safeLoadAppUrl = async () => {
    try {
      await mainWindow.loadURL(appUrl);
    } catch {
      // did-fail-load에서 에러 화면으로 대체됩니다.
    }
  };

  // 첫 실행 흰 화면 방지: 스플래시(로딩) → 앱 URL 로드
  const splashHtml = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>IBN 정책자금 스마트 매칭</title>
      <style>
        html,body{height:100%;margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,"Noto Sans KR",sans-serif;background:#0b1220;color:#e5e7eb}
        .wrap{height:100%;display:flex;align-items:center;justify-content:center}
        .card{width:min(560px,92vw);border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);backdrop-filter:blur(10px);border-radius:20px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.35)}
        .title{font-size:18px;font-weight:700;margin:0}
        .sub{margin:8px 0 0 0;color:rgba(229,231,235,.78);font-size:13px;line-height:1.55}
        .bar{margin-top:14px;height:10px;border-radius:999px;background:rgba(255,255,255,.10);overflow:hidden}
        .bar>div{height:100%;width:35%;background:rgba(255,255,255,.55);border-radius:999px;animation:move 1.1s ease-in-out infinite}
        @keyframes move{0%{transform:translateX(-110%)}100%{transform:translateX(320%)}}
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="card">
          <p class="title">IBN 정책자금 스마트 매칭</p>
          <p class="sub">서버에 연결하는 중입니다. 잠시만 기다려 주세요…</p>
          <div class="bar"><div></div></div>
        </div>
      </div>
    </body>
  </html>`;
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);
  setTimeout(() => void safeLoadAppUrl(), 150);

  // EXE에는 주소창이 없으므로, 메뉴로 관리자 페이지 접근 제공
  const appOrigin = new URL(appUrl).origin;
  const template = [
    {
      label: "파일",
      submenu: [{ role: "quit", label: "종료" }],
    },
    {
      label: "관리자",
      submenu: [
        {
          label: "회원가입 승인관리 열기",
          accelerator: "Ctrl+Shift+A",
          click: () => {
            mainWindow.loadURL(`${appOrigin}/admin/approvals`);
          },
        },
      ],
    },
    {
      label: "보기",
      submenu: [
        {
          label: "서버 다시 연결",
          accelerator: "Ctrl+R",
          click: () => void safeLoadAppUrl(),
        },
        { role: "reload", label: "현재 화면 새로고침" },
        { role: "toggledevtools", label: "개발자 도구" },
        { type: "separator" },
        { role: "resetzoom", label: "확대 초기화" },
        { role: "zoomin", label: "확대" },
        { role: "zoomout", label: "축소" },
        { type: "separator" },
        { role: "togglefullscreen", label: "전체화면" },
      ],
    },
  ] as const;

  const menu = Menu.buildFromTemplate(template as any);
  Menu.setApplicationMenu(menu);

  // 로드 실패 시: 흰 화면 대신 안내 화면 노출
  mainWindow.webContents.on("did-fail-load", (_e, _code, desc, validatedURL) => {
    // data: 로딩 화면 자체 실패/내부 네비게이션 실패는 무시
    if (validatedURL?.startsWith("data:")) return;

    const errHtml = `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>연결 실패</title>
        <style>
          html,body{height:100%;margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,"Noto Sans KR",sans-serif;background:#0b1220;color:#e5e7eb}
          .wrap{height:100%;display:flex;align-items:center;justify-content:center}
          .card{width:min(720px,92vw);border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);backdrop-filter:blur(10px);border-radius:20px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.35)}
          .title{font-size:18px;font-weight:800;margin:0}
          .sub{margin:10px 0 0 0;color:rgba(229,231,235,.78);font-size:13px;line-height:1.6}
          .code{margin-top:12px;border-radius:14px;background:rgba(0,0,0,.25);padding:12px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;white-space:pre-wrap;word-break:break-word}
          .btns{margin-top:14px;display:flex;gap:10px;flex-wrap:wrap}
          .btn{cursor:pointer;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.10);color:#fff;padding:10px 12px;border-radius:12px;font-weight:700;font-size:13px}
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="card">
            <p class="title">서버 연결에 실패했습니다</p>
            <p class="sub">네트워크/보안 프로그램/사내 프록시 등으로 인해 접속이 차단될 수 있습니다.</p>
            <div class="code">URL: ${appUrl}\n오류: ${String(desc || "unknown")}</div>
            <div class="btns">
              <button class="btn" onclick="location.href='${appUrl}'">다시 시도</button>
              <button class="btn" onclick="location.href='${appUrl.replace(/'/g, "%27")}'">새로고침</button>
            </div>
            <p class="sub" style="margin-top:12px">메뉴에서 <b>보기 → 서버 다시 연결</b>을 선택해도 됩니다.</p>
          </div>
        </div>
      </body>
    </html>`;
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errHtml)}`);
  });

  // 새 창 요청 시 외부 링크는 기본 브라우저로 열기
  mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    try {
      const u = new URL(url);
      if (u.origin !== appOrigin) {
        shell.openExternal(url);
        return { action: "deny" };
      }
      return { action: "allow" };
    } catch {
      return { action: "deny" };
    }
  });

  // 링크 클릭 시 target=_blank 또는 외부 도메인은 기본 브라우저로
  mainWindow.webContents.on("will-navigate", (event: { preventDefault: () => void }, url: string) => {
    try {
      const u = new URL(url);
      if (u.origin !== appOrigin) {
        event.preventDefault();
        shell.openExternal(url);
      }
    } catch {
      // ignore
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
