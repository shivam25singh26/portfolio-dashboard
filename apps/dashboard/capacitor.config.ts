import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.growthengines.alpha',
  appName: 'Growth Engines',
  webDir: 'public', // Unused for Live Wrapper, but required by Capacitor
  server: {
    url: 'http://192.168.0.251:3000',
    cleartext: true
  }
};

export default config;
