import { useEffect, useState } from 'react';
import { Icon } from '../Icon';
import { SmartImage } from '../SmartImage';
import type { ExternalMedia } from '../../lib/workspaceHooks';

export type RecommendationItem = {
  id: string;
  title: string;
  artist?: string;
  thumbnail_url?: string | null;
  stream_url?: string;
  external_url?: string | null;
  media_type?: string;
  source?: string;
};

export function IdleRecommendations({ isIdle, onPlay }: { isIdle: boolean; onPlay: (item: ExternalMedia) => void }) {
  const [items, setItems] = useState<RecommendationItem[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isIdle) {
      setVisible(false);
      setItems([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/discover/trending');
        const data = await res.json();
        const trending = data.trending || data;
        const list = [...(trending.music || []), ...(trending.podcasts || [])].slice(0, 3);
        if (list.length > 0) {
          setItems(list);
          setVisible(true);
        }
      } catch {
        setVisible(false);
        setItems([]);
      }
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [isIdle]);

  if (!visible || items.length === 0) return null;

  return (
    <div className="idle-recommendations" aria-label="Recommended discovery tracks">
      <span className="idle-recommendations__label">Recommended:</span>
      <div className="idle-recommendations__cards">
        {items.map((item, idx) => (
          <button
            key={`${item.source}-${item.id || idx}`}
            type="button"
            className="idle-recommendation-card"
            onClick={() => onPlay({
              type: 'audio',
              provider: (item.source as any) || 'audius',
              externalId: item.id,
              title: item.title,
              artist: item.artist || null,
              thumbnailUrl: item.thumbnail_url || null,
              streamUrl: item.stream_url || '',
              externalUrl: item.external_url || null,
            })}
            title={`Play ${item.title}`}
          >
            {item.thumbnail_url ? (
              <SmartImage src={item.thumbnail_url} alt="" loading="lazy" />
            ) : (
              <span className="idle-recommendation-card__fallback"><Icon name="headphones" size={14} /></span>
            )}
            <span className="idle-recommendation-card__title">{item.title}</span>
            <span className="idle-recommendation-card__overlay"><Icon name="play" size={12} /></span>
          </button>
        ))}
      </div>
    </div>
  );
}
