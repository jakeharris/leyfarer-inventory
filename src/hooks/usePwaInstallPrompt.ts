import { useEffect, useState } from 'react';

interface DeferredPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isiOS = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

const isStandaloneMode = () => {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
};

export const usePwaInstallPrompt = () => {
  const [promptEvent, setPromptEvent] = useState<DeferredPrompt | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as DeferredPrompt);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const isStandalone = isStandaloneMode();

  return {
    canPrompt: !dismissed && !isStandalone && promptEvent !== null,
    showIosHint: !dismissed && !isStandalone && promptEvent === null && isiOS(),
    dismiss: () => setDismissed(true),
    trigger: async () => {
      if (!promptEvent) {
        return false;
      }

      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      setPromptEvent(null);
      return choice.outcome === 'accepted';
    }
  };
};
