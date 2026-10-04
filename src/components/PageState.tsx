import { Icon, type IconName } from './Icon';
import '../styles/page-state.css';

export type PageStateVariant = 'loading' | 'empty' | 'error';

export function PageState({
  variant = 'loading',
  title,
  body,
  action,
  onRetry,
  icon = 'sparkle',
}: {
  variant?: PageStateVariant;
  title?: string;
  body?: string;
  action?: React.ReactNode;
  onRetry?: () => void;
  icon?: IconName;
}) {
  if (variant === 'loading') {
    return (
      <div className="page-state" role="status" aria-label="Loading">
        <div className="page-state__loading-dot" aria-hidden="true" />
        <h1>Making a little room…</h1>
        <p>Please hold on while we gather the details.</p>
      </div>
    );
  }

  if (variant === 'error') {
    return (
      <div className="page-state" role="alert">
        <span className="page-state__icon"><Icon name={icon} size={32} /></span>
        <h1>{title || 'Something went wrong.'}</h1>
        <p>{body || 'We encountered an error loading this content.'}</p>
        {onRetry && (
          <button type="button" className="btn btn--primary" onClick={onRetry}>
            <Icon name="refresh" size={16} /> Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="page-state">
      <span className="page-state__icon"><Icon name={icon} size={32} /></span>
      <h1>{title || 'Nothing here yet.'}</h1>
      <p>{body || 'This space is waiting for something wonderful.'}</p>
      {action}
    </div>
  );
}
