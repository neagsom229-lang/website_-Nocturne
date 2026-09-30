import { NavLink } from 'react-router-dom';
import { Icon, type IconName } from './Icon';

export type TabItem = {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
};

type TabBarProps = {
  items: TabItem[];
  /** Raised centre action, for the fab nav variant. */
  fab?: { to: string; label: string; icon: IconName };
};

function Tab({ item }: { item: TabItem }) {
  return (
    <NavLink to={item.to} end={item.end} className="tabbar__item">
      <Icon name={item.icon} size={20} />
      <span>{item.label}</span>
      <span className="tabbar__dot" aria-hidden="true" />
    </NavLink>
  );
}

/** Floating capsule nav — the pack's `pill` nav archetype. */
export function TabBar({ items, fab }: TabBarProps) {
  if (!fab) {
    return (
      <nav className="tabbar" aria-label="Primary">
        {items.map((item) => (
          <Tab key={item.to} item={item} />
        ))}
      </nav>
    );
  }

  const pivot = Math.ceil(items.length / 2);
  const leading = items.slice(0, pivot);
  const trailing = items.slice(pivot);

  return (
    <nav className="tabbar tabbar--fab" aria-label="Primary">
      {leading.map((item) => (
        <Tab key={item.to} item={item} />
      ))}
      <NavLink to={fab.to} className="tabbar__fab" aria-label={fab.label}>
        <Icon name={fab.icon} size={22} />
      </NavLink>
      {trailing.map((item) => (
        <Tab key={item.to} item={item} />
      ))}
    </nav>
  );
}
