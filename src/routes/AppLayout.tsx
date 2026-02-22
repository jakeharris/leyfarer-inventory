import { useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { APP_NAME } from '../config/constants';
import { InstallBanner } from '../components/InstallBanner';

const DEV_GESTURE_TAPS = 5;
const DEV_GESTURE_WINDOW_MS = 1500;

export const AppLayout = () => {
  const navigate = useNavigate();
  const tapCountRef = useRef(0);
  const lastTapRef = useRef(0);

  const handleTitleTap = () => {
    const now = Date.now();
    tapCountRef.current = now - lastTapRef.current <= DEV_GESTURE_WINDOW_MS ? tapCountRef.current + 1 : 1;
    lastTapRef.current = now;

    if (tapCountRef.current >= DEV_GESTURE_TAPS) {
      tapCountRef.current = 0;
      void navigate('/health');
    }
  };

  return (
    <div className="page-shell">
      <header className="top-bar">
        <h1>
          <button
            type="button"
            className="title-button"
            onClick={handleTitleTap}
            aria-label={`${APP_NAME} developer options`}
          >
            {APP_NAME}
          </button>
        </h1>
        <p>Local-first inventory companion</p>
      </header>

      <main className="content" id="content">
        <InstallBanner />
        <Outlet />
      </main>
    </div>
  );
};
