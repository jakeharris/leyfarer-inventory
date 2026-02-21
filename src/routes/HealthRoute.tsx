import { APP_VERSION } from '../config/constants';
import { useStorageHealth } from '../hooks/useStorageHealth';

export const HealthRoute = () => {
  const storage = useStorageHealth();

  return (
    <section className="panel">
      <h2>Health Check</h2>
      <dl className="kv-list">
        <div>
          <dt>App version</dt>
          <dd>{APP_VERSION}</dd>
        </div>
        <div>
          <dt>Storage status</dt>
          <dd>
            {storage.status === 'loading' ? 'Initializing...' : null}
            {storage.status === 'ready' ? 'Ready' : null}
            {storage.status === 'error' ? `Error: ${storage.message}` : null}
          </dd>
        </div>
        <div>
          <dt>Schema version</dt>
          <dd>{storage.status === 'ready' ? storage.schemaVersion ?? 'unset' : '-'}</dd>
        </div>
      </dl>
    </section>
  );
};
