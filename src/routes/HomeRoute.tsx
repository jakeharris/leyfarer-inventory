import { featureFlags } from '../config/featureFlags';

export const HomeRoute = () => (
  <section className="panel">
    <h2>App Shell Ready</h2>
    <p>Phase 01 foundation is active: routing, PWA shell, and storage infrastructure.</p>
    {featureFlags.e2eSmokeRouteLabel ? (
      <p>
        <strong data-testid="shell-status">Shell healthy</strong>
      </p>
    ) : null}
  </section>
);
