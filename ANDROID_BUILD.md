# MyWayPins 안드로이드 앱 빌드 가이드 (Capacitor)

이 문서는 MyWayPins 웹 프로젝트를 안드로이드 네이티브 앱으로 빌드해서
**Google Play Store**에 출시하기 위한 단계별 가이드입니다.

> ⚠️ 안드로이드 네이티브 빌드(`npx cap`, Android Studio, Gradle)는
> **Lovable 클라우드 환경 밖, 본인의 로컬 PC**에서 진행해야 합니다.

---

## 1. 사전 준비 (로컬 PC)

- **Node.js 20+**, **Bun 또는 npm**
- **Android Studio** (최신 안정 버전) — https://developer.android.com/studio
- **JDK 17** (Android Studio가 함께 설치합니다)
- **Git** + 본 프로젝트를 GitHub로 Export

Lovable 우상단 **GitHub → Export to GitHub**로 리포지토리를 만든 뒤,
로컬에서 클론합니다.

```bash
git clone <your-repo-url> mywaypins
cd mywaypins
bun install        # 또는 npm install
```

---

## 2. Capacitor 설정 (이미 적용됨)

이 프로젝트에는 다음이 이미 구성되어 있습니다.

- `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`
- `@capacitor/app`, `@capacitor/splash-screen`, `@capacitor/status-bar`
- `capacitor.config.ts`
  - `appId`: **`app.lovable.mywaypins`** ← Play Console 출시 시 영구 고정되는 패키지명
  - `appName`: **`MyWayPins`**
  - `webDir`: **`dist`** (Vite 빌드 산출물)
  - `server.url`: Lovable 프리뷰 URL (개발용 hot-reload)

### 출시 빌드 시 반드시 할 일
`capacitor.config.ts`에서 **`server` 블록 전체를 주석 처리**하세요.
그래야 앱이 Lovable 서버가 아닌, 앱 내부에 번들된 정적 파일을 로드합니다.

```ts
// server: {
//   url: '...',
//   cleartext: true,
// },
```

---

## 3. 안드로이드 플랫폼 추가 (한 번만)

```bash
bun run build              # dist/ 생성
npx cap add android        # android/ 폴더 생성
npx cap sync android       # 웹 자산 + 플러그인 동기화
```

이후 웹 코드가 바뀔 때마다:

```bash
bun run build && npx cap sync android
```

---

## 4. 앱 아이콘 & 스플래시 이미지

1. **마스터 아이콘 1장 준비**: `1024×1024 PNG` (투명 배경 없이 풀블리드)
2. **마스터 스플래시 1장 준비**: `2732×2732 PNG` (중앙 로고 + 단색 배경 `#1a1f2c`)
3. `resources/` 폴더에 다음 이름으로 저장:
   - `resources/icon.png`
   - `resources/splash.png`
4. 자동 생성:
   ```bash
   bun add -D @capacitor/assets
   npx capacitor-assets generate --android
   ```
   → `android/app/src/main/res/` 아래 모든 해상도가 자동 생성됩니다.

수동으로 만들고 싶다면 안드로이드 표준 mipmap 해상도:
`mdpi 48`, `hdpi 72`, `xhdpi 96`, `xxhdpi 144`, `xxxhdpi 192`.

---

## 5. Android Studio에서 열기 & 실기 테스트

```bash
npx cap open android
```

Android Studio에서:
- 상단 디바이스 선택 → 실기(USB 디버깅) 또는 에뮬레이터 → ▶ Run
- 처음에는 `server.url`이 살아있어서 Lovable 프리뷰가 그대로 뜹니다 (빠른 개발용)

---

## 6. Google Play 출시용 릴리스 APK/AAB 빌드

1. `capacitor.config.ts`의 `server` 블록 주석 처리 → `bun run build && npx cap sync android`
2. Android Studio → **Build → Generate Signed Bundle / APK**
3. **Android App Bundle (.aab)** 선택 (Play Store 필수 포맷)
4. **새 키스토어 생성** (반드시 안전한 곳에 백업 — 분실 시 앱 업데이트 영구 불가)
5. **release** 빌드 변형 선택 → AAB 생성
6. 결과물: `android/app/release/app-release.aab`

---

## 7. Google Play Console 등록

1. https://play.google.com/console (개발자 등록비 USD 25, 1회)
2. **앱 만들기** → 패키지명 `app.lovable.mywaypins` 입력 (한 번 정하면 변경 불가)
3. 스토어 등록정보:
   - 앱 이름, 설명, 카테고리
   - 스크린샷 (폰 최소 2장), 512×512 아이콘, 1024×500 피처 그래픽
   - 개인정보처리방침 URL (현재 `/privacy` 라우트 사용 가능)
4. **앱 콘텐츠**: 광고 포함 여부, 데이터 보안, 콘텐츠 등급 설문
5. **프로덕션 트랙**에 AAB 업로드 → 검토 제출 (보통 1~7일)

---

## 8. 알아두면 좋은 것

- **로그인 (Lovable Cloud)**: 웹뷰 안에서 그대로 작동합니다. 사용자 기록은
  계속 Lovable Cloud의 **Users** 탭에서 통합 관리됩니다.
- **푸시 알림 (FCM)**: 현재 웹 푸시용 `firebase-messaging-sw.js`가 있지만,
  네이티브 푸시는 별도로 `@capacitor/push-notifications` + Firebase 설정이
  필요합니다. 출시 후 단계에서 진행하세요.
- **Mapbox**: 웹뷰에서 정상 작동합니다. Mapbox 토큰의 URL 화이트리스트에
  `capacitor://localhost`, `https://localhost`를 추가해 두세요.
- **딥링크/공유**: 필요해지면 `@capacitor/app`의 `appUrlOpen` 이벤트로 처리.

문제가 생기면 단계별 로그와 함께 다시 알려주세요!
