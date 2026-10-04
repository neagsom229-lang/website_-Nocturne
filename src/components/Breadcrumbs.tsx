import { Link } from 'react-router-dom';

export type BreadcrumbItem = {
  label: string;
  to?: string;
};

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (!items || items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs">
      <ol className="breadcrumbs__list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="breadcrumbs__item" aria-current={isLast ? 'page' : undefined}>
              {index > 0 && <span className="breadcrumbs__separator" aria-hidden="true">/</span>}
              {isLast || !item.to ? (
                <span className="breadcrumbs__current">{item.label}</span>
              ) : (
                <Link to={item.to} className="breadcrumbs__link">{item.label}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
