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
  },
};

export default config;
