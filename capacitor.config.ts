import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.mywaypins',
  appName: 'MyWayPins',
  webDir: 'dist',
  server: {
    // 개발 중 hot-reload: Lovable preview URL을 그대로 모바일에서 띄울 때 사용
    // 프로덕션 빌드(스토어 출시) 시에는 server 블록 전체를 주석 처리하세요.
    url: 'https://25c73009-03a8-4d60-8c1b-1d59ee95d455.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
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
  },
};

export default config;
