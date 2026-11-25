import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'jp.poicho.app',
  appName: 'ポイ帳',
  webDir: 'dist',
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    SystemBars: {
      insetsHandling: 'native',
      style: 'LIGHT',
      hidden: false,
    },
  },
};

export default config;
