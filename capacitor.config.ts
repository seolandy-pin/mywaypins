import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.mywaypins",
  appName: "MyWayPins",
  webDir: "dist/client", // 💡 TanStack Start 빌드 경로에 맞게 수정되었습니다.
  // 🔴 프로덕션(.aab) 빌드 시에는 server 블록을 주석 처리하세요.
  // 개발 중 hot-reload가 필요할 때만 활성화:
  server: {
    // 💡 안전한 https 실시간 서버 주소로 연결하고 안드로이드 보안을 통과시킵니다.
    url: "https://mywaypins.lovable.app",
    allowNavigation: ["mywaypins.lovable.app"],
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#1a1f2c",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#1a1f2c",
    },
  },
};

export default config;
