import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import '../styles/page-state.css';

export default function NotFound() {
  return (
    <main className="page-state" aria-labelledby="not-found-title">
      <span className="page-state__icon"><Icon name="moon" size={40} /></span>
      <h1 id="not-found-title">This room is empty.</h1>
      <p>We couldn't find that page. It might have moved or been a wrong turn.</p>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
        <Link to="/tapes" className="btn btn--primary" style={{ textDecoration: 'none' }}>
          <Icon name="home" size={16} /> Back to home
        </Link>
        <Link to="/search" className="btn btn--ghost" style={{ textDecoration: 'none', border: '1px solid var(--tp-line)', padding: '10px 20px', borderRadius: '12px', color: 'var(--tp-ink)' }}>
          <Icon name="search" size={16} /> Search
        </Link>
      </div>
    </main>
  );
}
