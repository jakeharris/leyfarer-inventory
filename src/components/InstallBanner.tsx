import { featureFlags } from '../config/featureFlags';
import { usePwaInstallPrompt } from '../hooks/usePwaInstallPrompt';

export const InstallBanner = () => {
  const { canPrompt, showIosHint, dismiss, trigger } = usePwaInstallPrompt();

  if (!featureFlags.pwaInstallPrompt) {
    return null;
  }

  if (!canPrompt && !showIosHint) {
    return null;
  }

  return (
    <section className="install-banner" aria-live="polite">
      <p>
        {canPrompt
          ? 'Install for full-screen offline play access.'
          : 'On iPhone/iPad, tap Share and choose Add to Home Screen.'}
      </p>
      <div className="install-banner__actions">
        {canPrompt ? (
          <button type="button" onClick={() => void trigger()}>
            Install app
          </button>
        ) : null}
        <button type="button" className="button-secondary" onClick={dismiss}>
          Dismiss
        </button>
      </div>
    </section>
  );
};
