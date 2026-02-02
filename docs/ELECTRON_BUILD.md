# Electron 빌드 가이드 (Windows exe)

내부 PC용 exe 배포를 위한 Electron 래퍼 사용 방법입니다.  
서버는 기존대로 Vercel/도메인에서 동작하며, exe는 해당 URL만 로드합니다. **exe에는 API KEY를 넣지 않습니다.**

---

## 1. 개발 실행 방법

1. **의존성 설치**
   ```bash
   npm install
   ```

2. **Electron + Next 동시 실행**
   ```bash
   npm run electron:dev
   ```
   - Next.js가 `http://localhost:3000`에서 실행됩니다.
   - Electron 창이 자동으로 열리고 `http://localhost:3000`을 로드합니다.
   - `NEXT_PUBLIC_APP_URL`이 없어도 개발 시에는 localhost로 동작합니다.

3. **공고 바로가기 등 외부 링크**
   - 클릭 시 기본 브라우저에서 열립니다.

---

## 2. Windows exe 빌드 방법

### 2.1 배포 URL 설정

exe가 프로덕션에서 로드할 URL을 **빌드 시점**에 넣습니다.

- **방법 A: 환경 변수**
  ```bash
  set NEXT_PUBLIC_APP_URL=https://your-project.vercel.app
  npm run electron:build
  ```
- **방법 B: .env 파일**
  - 프로젝트 루트에 `.env.production` 또는 `.env`에 다음 한 줄 추가 후 빌드:
  ```env
  NEXT_PUBLIC_APP_URL=https://your-project.vercel.app
  ```
  - 그 다음:
  ```bash
  npm run electron:build
  ```
  (실제로 `electron:build`는 Node에서 실행되므로 터미널에서 `set NEXT_PUBLIC_APP_URL=...` 한 뒤 빌드하거나, `cross-env` 등으로 주입해야 합니다. Windows에서는 `set NEXT_PUBLIC_APP_URL=...` 후 `npm run electron:build` 실행.)

### 2.2 빌드 실행

```bash
npm run electron:build
```

- `scripts/write-app-url.js`가 `NEXT_PUBLIC_APP_URL`을 읽어 `electron-app-url.json`을 생성합니다.
- `electron/main.ts`가 `tsconfig.electron.json` 기준으로 `dist-electron/main.js`로 컴파일됩니다.
- `electron-builder`가 `dist/` 아래에 Windows NSIS 설치 exe를 생성합니다.

### 2.3 빌드 결과

- **출력 디렉터리:** `dist/`
- **설치 exe(권장 배포 파일):** `dist/IBN-PolicyFund-Matching-Setup-x.x.x.exe` (NSIS)
- 설치 시 설치 경로 변경 가능(oneClick: false)

> 참고: Windows 환경에서 한글 파일명/경로가 섞이면 `rcedit` 단계에서 빌드가 실패하는 경우가 있어, 현재 설정은 **EXE 파일명은 영문(ASCII)** 으로 생성되도록 맞춰져 있습니다.

### 2.4 생성 파일 / .gitignore (선택)

- 빌드 시 `electron-app-url.json`, `dist/`, `dist-electron/`이 생성됩니다. 버전 관리 제외 권장:
  ```gitignore
  electron-app-url.json
  dist/
  dist-electron/
  ```

### 2.5 아이콘 (선택)

- `public/icon.ico`를 두고 `package.json`의 `build.win.icon`에 `"public/icon.ico"`를 추가하면 exe/설치 아이콘으로 사용됩니다.

---

## 3. 배포 시 NEXT_PUBLIC_APP_URL 설정 방법

| 환경 | 설정 방법 |
|------|------------|
| **개발** | 설정 안 해도 됨. Electron은 `http://localhost:3000` 사용. |
| **exe 빌드** | 빌드 전에 `NEXT_PUBLIC_APP_URL`을 설정. exe에 이 URL이 포함되어, 실행 시 해당 주소만 로드. |
| **Vercel 등 웹** | 프로젝트의 환경 변수에 `NEXT_PUBLIC_APP_URL` 설정 (웹 리다이렉트 등에 사용할 경우). |

- exe는 **항상** 빌드 시 넣은 `NEXT_PUBLIC_APP_URL`로만 통신합니다.
- API 호출(`/api/match` 등)은 모두 해당 도메인(Vercel 등)으로 갑니다. exe에는 API KEY를 넣지 않습니다.

---

## 4. 확인 사항

- **exe에서 /api/match 동작**
  - exe 실행 → 설정된 URL(예: `https://your-project.vercel.app`) 로드 → 해당 도메인의 Next API(`/api/match`) 호출 → 정상 동작해야 합니다.
- **공고 바로가기 링크**
  - 클릭 시 기본 브라우저에서 열리도록 `electron/main.ts`에서 `setWindowOpenHandler`와 `will-navigate`로 처리되어 있습니다.

---

## 5. 트러블슈팅

- **Electron 창이 흰 화면만 나올 때**
  - 개발: `npm run dev`로 Next가 3000 포트에서 떠 있는지 확인 후 `npm run electron:dev` 실행.
  - 프로덕션: `NEXT_PUBLIC_APP_URL`이 올바른지, 해당 URL이 브라우저에서 정상 열리는지 확인.
- **빌드 시 "electron-app-url.json not found"**
  - `npm run electron:write-url`이 먼저 실행되므로, `NEXT_PUBLIC_APP_URL`을 설정한 뒤 `npm run electron:build`를 한 번에 실행하면 됩니다. (`electron:build`가 `electron:write-url`을 호출함)
- **외부 링크가 Electron 창 안에서 열릴 때**
  - `main.ts`의 `setWindowOpenHandler` / `will-navigate`가 적용된 상태로 다시 빌드했는지 확인.

- **EXE에서 관리자 승인 페이지로 들어가고 싶은데 주소창이 없을 때**
  - 상단 메뉴의 **관리자 → 회원가입 승인관리 열기**를 사용합니다. (단축키: `Ctrl+Shift+A`)
