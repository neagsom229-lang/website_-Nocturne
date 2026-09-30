import { Icon } from './Icon';

type RatingProps = {
  value: number;
  count?: number;
  size?: number;
};

const STAR_TOTAL = 5;

export function Rating({ value, count, size = 15 }: RatingProps) {
  const filled = Math.round(value);
  return (
    <span className="rating">
      <span className="stars" role="img" aria-label={`${value.toFixed(1)} out of 5`}>
        {Array.from({ length: STAR_TOTAL }, (_, index) => (
          <Icon
            key={index}
            name={index < filled ? 'star-filled' : 'star'}
            size={size}
            strokeWidth={1.4}
          />
        ))}
      </span>
      <span>
        {value.toFixed(1)}
        {typeof count === 'number' ? ` · ${count.toLocaleString()} ratings` : ''}
      </span>
    </span>
  );
}
