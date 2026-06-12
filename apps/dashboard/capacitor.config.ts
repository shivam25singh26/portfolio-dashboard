import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.growthengines.alpha',
  appName: 'Growth Engines',
  webDir: 'public', // Unused for Live Wrapper, but required by Capacitor
  server: {
    url: 'https://portfolio-dashboard-sigma-ruby.vercel.app',
    cleartext: true
  }
};

export default config;
