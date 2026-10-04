import { Icon } from './Icon';
import '../styles/page-state.css';

export function ServerErrorPage() {
  return (
    <main className="page-state" role="alert">
      <span className="page-state__icon"><Icon name="moon" size={40} /></span>
      <h1>Something went quiet.</h1>
      <p>The room lost its light. Try again in a moment.</p>
      <button type="button" className="btn btn--primary" onClick={() => window.location.reload()} style={{ marginTop: '16px' }}>
        <Icon name="refresh" size={16} /> Reload
      </button>
    </main>
  );
}
