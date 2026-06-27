# 안드로이드 Google 로그인 네이티브 연동 가이드

`"GoogleAuth" plugin is not implemented on android` 에러는 JS 코드가
아니라 **안드로이드 네이티브 프로젝트(`android/` 폴더)에 플러그인이
등록되지 않아서** 발생합니다. `android/` 폴더는 본인의 로컬 PC에서
생성/관리되므로(Lovable 클라우드에는 존재하지 않음) 아래 작업을
**로컬 PC에서 한 번** 적용해 주세요.

> JS 측 코드(`capacitor.config.ts`, `src/routes/__root.tsx`의 `GoogleAuth.initialize`,
> `src/routes/auth.tsx`의 `GoogleAuth.signIn`)는 이미 올바르게 구성되어
> 있으므로 **건드릴 필요 없습니다**.

---

## 1) 플러그인 설치 확인 & 네이티브 동기화

```bash
# 프로젝트 루트에서
bun install                  # 또는 npm install
npx cap sync android         # ← 이 단계가 핵심. 플러그인을 android/에 복사+등록
```

`@codetrix-studio/capacitor-google-auth` 는 이미 `package.json` 에
선언되어 있으며, Capacitor 5+ 부터는 `cap sync` 시 **자동으로 플러그인이
등록**됩니다. 따라서 일반적으로 `MainActivity.java` 를 직접 수정할
필요가 없습니다. (아래 3번에 만약을 위한 수동 등록 코드도 첨부)

---

## 2) `android/app/src/main/res/values/strings.xml` 에 웹 클라이언트 ID 선언

플러그인은 빌드 시 `server_client_id` 리소스를 읽어 Google Sign-In SDK
를 초기화합니다. 이 값이 없으면 네이티브 측 초기화가 실패해
`plugin is not implemented` 형태로 보일 수 있습니다.

`android/app/src/main/res/values/strings.xml` 파일을 열어
`<resources>` 블록 안에 아래 줄을 추가하세요. (다른 줄은 그대로 유지)

```xml
<resources>
    <string name="app_name">MyWayPins</string>
    <string name="title_activity_main">MyWayPins</string>
    <string name="package_name">app.lovable.mywaypins</string>
    <string name="custom_url_scheme">app.lovable.mywaypins</string>

    <!-- 🔽 추가: Google Sign-In 웹 클라이언트 ID (Supabase Google Provider 와 동일) -->
    <string name="server_client_id">628775940516-nqk72u5q2tl5qi127f9r8uh24nb0c8t9.apps.googleusercontent.com</string>
</resources>
```

---

## 3) (선택) `MainActivity.java` 수동 플러그인 등록

`npx cap sync android` 후에도 여전히 `not implemented` 에러가 난다면,
`android/app/src/main/java/app/lovable/mywaypins/MainActivity.java` 를
열어 아래처럼 명시적으로 등록합니다.

```java
package app.lovable.mywaypins;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.codetrixstudio.capacitor.GoogleAuth.GoogleAuth;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // ⚠️ super.onCreate 전에 플러그인 등록
        registerPlugin(GoogleAuth.class);
        super.onCreate(savedInstanceState);
    }
}
```

---

## 4) Google Cloud Console 체크리스트

- **웹 애플리케이션** 유형 OAuth 클라이언트 ID
  `628775940516-nqk72u5q2tl5qi127f9r8uh24nb0c8t9.apps.googleusercontent.com`
  가 Supabase(Lovable Cloud) Google Provider 에 등록되어 있어야 합니다.
- **안드로이드** 유형 OAuth 클라이언트 ID
  (`628775940516-vblak5ql52dtrfhm77ba0a05f83ln891....`) 에는
  - 패키지명: `app.lovable.mywaypins`
  - SHA-1 지문: 디버그 키 + (출시할 거라면) 업로드 키 / Play App Signing 키
  가 모두 등록되어 있어야 합니다.

디버그 SHA-1 확인:
```bash
keytool -list -v -alias androiddebugkey \
  -keystore ~/.android/debug.keystore -storepass android -keypass android
```

---

## 5) 다시 빌드 & 실행

```bash
bun run build           # 웹 번들 생성 (dist/client)
npx cap sync android    # 네이티브 프로젝트에 반영
npx cap open android    # Android Studio 에서 Run ▶
```

이제 실기기에서 **Continue with Google** 을 누르면 외부 브라우저로
튕기지 않고, 네이티브 Google 계정 선택 시트가 떠야 합니다.
