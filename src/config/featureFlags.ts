export interface FeatureFlags {
  pwaInstallPrompt: boolean;
  healthCheckRoute: boolean;
  e2eSmokeRouteLabel: boolean;
}

export const featureFlags: FeatureFlags = {
  pwaInstallPrompt: true,
  healthCheckRoute: true,
  e2eSmokeRouteLabel: true
};
