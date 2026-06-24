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

## 8. 🔑 Google 로그인 설정 (테스터 배포 전 필수)

MyWayPins는 **Lovable Cloud 관리형 Google OAuth(웹 플로우)** 를 사용하므로:

✅ **SHA-1 등록 불필요**
✅ **Google Cloud Console에서 OAuth Client 만들 필요 없음**
✅ **Web Client ID / Android Client ID 둘 다 불필요**

→ Lovable이 OAuth 자격증명을 자동 관리합니다.

대신 Capacitor 앱이 OAuth 콜백을 받을 수 있도록 **딥링크(App Link)** 만 설정하면 됩니다.

### `AndroidManifest.xml` 수정 (1회)

`android/app/src/main/AndroidManifest.xml`의 `<activity android:name=".MainActivity" ...>` 안에 추가:

```xml
<!-- Google OAuth 콜백을 앱으로 라우팅 -->
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="https"
        android:host="mywaypins.lovable.app" />
</intent-filter>
```

### (선택) App Links 정식 검증

위에서 `autoVerify="true"`로 설정하면, Chrome이 콜백 URL을 자동으로 앱에 전달합니다(중간 다이얼로그 없음). 정식 검증을 받으려면:

1. SHA-256 지문 추출 (Play App Signing 키):
   - Play Console → 앱 → 테스트 및 출시 → 앱 서명 → **앱 서명 키 인증서 → SHA-256**
2. 다음 JSON을 `https://mywaypins.lovable.app/.well-known/assetlinks.json`로 서빙:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "app.lovable.mywaypins",
    "sha256_cert_fingerprints": ["AA:BB:CC:...(Play App Signing SHA-256)..."]
  }
}]
```

> 정식 검증 없이도 "이 링크를 어떤 앱으로 열까요?" 다이얼로그로 동작하므로, 테스터 단계에서는 검증 생략 가능합니다.

### 테스트 절차

1. 앱에서 "Continue with Google" 탭
2. Chrome Custom Tab이 열리며 Google 계정 선택 화면 표시
3. 계정 선택 → `https://mywaypins.lovable.app/#access_token=...`로 리다이렉트
4. 안드로이드가 해당 URL을 MyWayPins 앱으로 전달
5. `__root.tsx`의 `appUrlOpen` 리스너가 세션 복원 → 홈으로 이동

---

## 9. 알아두면 좋은 것

- **로그인 (Lovable Cloud)**: 사용자 기록은 Lovable Cloud의 **Users** 탭에서 통합 관리됩니다.
- **푸시 알림 (FCM)**: 네이티브 푸시는 별도로 `@capacitor/push-notifications` + Firebase 설정이 필요합니다.
- **Mapbox**: 토큰 화이트리스트에 `capacitor://localhost`, `https://localhost`, `https://mywaypins.lovable.app` 추가.
- **딥링크**: `__root.tsx`에 이미 구현됨 — OAuth 콜백 + 일반 path 라우팅 모두 처리.

문제가 생기면 단계별 로그와 함께 다시 알려주세요!

