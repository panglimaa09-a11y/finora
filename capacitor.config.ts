import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.finora.wallet',
  appName: 'FINORA',
  webDir: 'dist',
  server: {
    url: 'https://finora-green-iota.vercel.app',
    cleartext: false
  }
};

export default config;
