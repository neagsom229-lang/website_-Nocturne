import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';

type PageBarProps = {
  /** Where the back chevron goes. Omit for a root tab screen. */
  backTo?: string;
  title?: string;
  eyebrow?: string;
  actions?: ReactNode;
  lined?: boolean;
};

export function PageBar({ backTo, title, eyebrow, actions, lined = false }: PageBarProps) {
  return (
    <header className={`app__bar${lined ? ' app__bar--lined' : ''}`}>
      {backTo ? (
        <Link to={backTo} className="iconbtn" aria-label="Back">
          <Icon name="chevron-left" size={20} />
        </Link>
      ) : null}
      <div style={{ minWidth: 0, flex: 1 }}>
        {eyebrow ? <p className="t-eyebrow">{eyebrow}</p> : null}
        {title ? <p className="t-h3 t-clamp-1">{title}</p> : null}
      </div>
      {actions}
    </header>
  );
}
