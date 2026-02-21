/**
 * RssFeedWidget — displays headlines from a configured RSS/Atom feed.
 * Updated in real-time via WebSocket; falls back to REST polling every 15 min.
 */

import React, { useState, useCallback } from 'react';
import { useModuleData } from '../hooks/useModuleData';
import { useModuleEvents } from '../hooks/useModuleEvents';
import styles from './RssFeedWidget.module.css';

interface FeedItem {
  guid: string;
  title: string;
  link?: string;
  description?: string;
  pubDate?: string;
}

interface FeedData {
  feedTitle: string;
  items: FeedItem[];
  fetchedAt: number;
}

// REST endpoint returns { instanceId, data: FeedData, message? }
interface FeedResponse {
  instanceId: string;
  data: FeedData;
  message?: string;
}

interface RssFeedWidgetProps {
  instanceId: string;
  isEditMode: boolean;
  config: {
    showDescription?: boolean;
  };
}

function formatPubDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 60) return diffMin <= 1 ? 'Just now' : `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const RssFeedWidget: React.FC<RssFeedWidgetProps> = ({ instanceId, config }) => {
  const showDescription = config.showDescription ?? true;

  const { data: restData, isLoading, error } = useModuleData<FeedResponse>(
    'rss',
    instanceId,
    900_000 // poll every 15 min as fallback
  );

  const [realtimeData, setRealtimeData] = useState<FeedData | null>(null);

  const handleEvent = useCallback((data: FeedData) => {
    setRealtimeData(data);
  }, []);

  useModuleEvents<FeedData>('rss', instanceId, handleEvent, 'data');

  // REST gives { instanceId, data: FeedData }; WebSocket gives FeedData directly
  const feed = realtimeData ?? restData?.data ?? null;
  const noFeedConfigured = restData?.message != null && !feed?.items.length;

  if (isLoading && !feed) {
    return (
      <div className={styles.feed}>
        <span className={styles.loading}>Loading feed…</span>
      </div>
    );
  }

  if (error && !feed) {
    return (
      <div className={styles.feed}>
        <span className={styles.error}>Feed unavailable</span>
      </div>
    );
  }

  if (noFeedConfigured || !feed) {
    return (
      <div className={styles.feed}>
        <span className={styles.empty}>
          {restData?.message ?? 'No feed URL configured'}
        </span>
      </div>
    );
  }

  if (feed.items.length === 0) {
    return (
      <div className={styles.feed}>
        <span className={styles.empty}>No articles found</span>
      </div>
    );
  }

  return (
    <div className={styles.feed}>
      <div className={styles.feedTitle}>{feed.feedTitle}</div>
      <ul className={styles.itemList}>
        {feed.items.map((item) => (
          <li key={item.guid} className={styles.item}>
            <div className={styles.itemHeader}>
              <span className={styles.itemTitle}>{item.title}</span>
              {item.pubDate && (
                <span className={styles.itemDate}>{formatPubDate(item.pubDate)}</span>
              )}
            </div>
            {showDescription && item.description && (
              <p className={styles.itemDescription}>{item.description}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RssFeedWidget;
