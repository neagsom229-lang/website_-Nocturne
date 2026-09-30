import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type EmptyStateProps = {
  icon?: IconName;
  title: string;
  body?: string;
  action?: ReactNode;
};

export function EmptyState({ icon = 'wifi-off', title, body, action }: EmptyStateProps) {
  return (
    <div className="empty">
      <span className="empty__mark">
        <Icon name={icon} size={26} />
      </span>
      <h3 className="empty__title">{title}</h3>
      {body ? <p className="t-small t-mute">{body}</p> : null}
      {action ? <div className="stack--sm">{action}</div> : null}
    </div>
  );
}
