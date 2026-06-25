import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.mywaypins',
  appName: 'MyWayPins',
  webDir: 'dist',
  // 🔴 프로덕션(.aab) 빌드 시에는 server 블록을 주석 처리하세요.
  // 개발 중 hot-reload가 필요할 때만 활성화:
  // server: {
  //   url: 'https://25c73009-03a8-4d60-8c1b-1d59ee95d455.lovableproject.com?forceHideBadge=true',
  //   cleartext: true,
  // },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#1a1f2c',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1a1f2c',
    },
    GoogleAuth: {
      // ⚠️ serverClientId 는 반드시 "웹 애플리케이션" 유형의 OAuth 클라이언트 ID여야 합니다.
      // (Supabase Auth → Google Provider 에 등록된 Client ID 와 동일한 값)
      // 안드로이드 클라이언트 ID(628775940516-vblak...)는 SHA-1 지문으로 자동 매칭되므로
      // 여기 넣지 않습니다. 아직 웹 클라이언트 ID가 없다면 Google Cloud Console에서
      // "웹 애플리케이션" 유형으로 하나 더 만들어서 그 값을 아래에 넣어주세요.
      serverClientId: '628775940516-nqk7vblak5ql52dtrfhm77ba0a05f83l.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
      scopes: ['profile', 'email'],
    },
  },
};

export default config;
