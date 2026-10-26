// Capture deployment mode once: request data cannot enable live access.
export const demoEnabled = process.env.APP_DEMO_MODE === 'true';
export function assertLiveAccess() {
  if (demoEnabled || process.env.APP_DEMO_MODE === 'true') {
    throw new Error('Live database, Auth, and Storage access is disabled in demo mode.');
  }
}
