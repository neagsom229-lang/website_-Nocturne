import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import {
  createComment,
  deleteComment,
  getComments,
  updateComment,
  type SocialComment,
} from '../lib/socialApi';

function relativeTime(value: string) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}

export function CommentThread({ mediaLibraryId }: { mediaLibraryId: string }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<SocialComment[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState('');
  const [offset, setOffset] = useState(0);
  const pageSize = 20;

  const load = useCallback(async (start = 0, append = false) => {
    setLoading(true);
    setError('');
    try {
      const result = await getComments(mediaLibraryId, { limit: pageSize, offset: start });
      setComments((current) => append ? [...current, ...result.comments] : result.comments);
      setHasMore(result.hasMore);
      setOffset(start + result.comments.length);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load comments.');
    } finally {
      setLoading(false);
    }
  }, [mediaLibraryId]);

  useEffect(() => { void load(); }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || trimmed.length > 1000 || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const comment = await createComment(mediaLibraryId, trimmed);
      setComments((current) => [comment, ...current]);
      setBody('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not post your comment.');
    } finally {
      setSubmitting(false);
    }
  }

  async function saveEdit(comment: SocialComment) {
    const trimmed = editBody.trim();
    if (!trimmed || trimmed.length > 1000) return;
    try {
      const updated = await updateComment(comment.id, trimmed);
      setComments((current) => current.map((entry) => entry.id === comment.id ? updated : entry));
      setEditingId(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not update your comment.');
    }
  }

  async function remove(comment: SocialComment) {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await deleteComment(comment.id);
      setComments((current) => current.filter((entry) => entry.id !== comment.id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete your comment.');
    }
  }

  return (
    <section className="comment-thread" aria-label="Comments">
      <header className="comment-thread__heading">
        <div>
          <p className="social-eyebrow">THE LISTENING ROOM</p>
          <h2>Notes from the room</h2>
        </div>
        <span>{comments.length}{hasMore ? '+' : ''}</span>
      </header>
      {user ? (
        <form className="comment-composer" onSubmit={(event) => void submit(event)}>
          <label className="sr-only" htmlFor={`comment-${mediaLibraryId}`}>Write a comment</label>
          <textarea
            id={`comment-${mediaLibraryId}`}
            value={body}
            maxLength={1001}
            rows={3}
            placeholder="Leave a thoughtful note…"
            onChange={(event) => setBody(event.target.value)}
          />
          <div className="comment-composer__footer">
            <span>{body.length}/1000</span>
            <button className="social-button" type="submit" disabled={!body.trim() || body.trim().length > 1000 || submitting}>
              {submitting ? 'Posting…' : 'Post note'}
            </button>
          </div>
        </form>
      ) : (
        <p className="comment-thread__signin"><Link to="/auth/login">Sign in to comment</Link> and join the conversation.</p>
      )}
      {error ? <p className="social-inline-error" role="alert">{error}</p> : null}
      {loading && !comments.length ? (
        <div className="comment-skeletons" role="status" aria-label="Loading comments">
          {Array.from({ length: 3 }, (_, index) => <span key={index} />)}
        </div>
      ) : comments.length ? (
        <div className="comment-list">
          {comments.map((comment) => (
            <article className="comment-card" key={comment.id}>
              <Avatar name={comment.displayName} src={comment.avatarUrl} size="small" />
              <div className="comment-card__content">
                <div className="comment-card__byline">
                  <Link to={`/u/${encodeURIComponent(comment.userId)}`}>{comment.displayName}</Link>
                  <time dateTime={comment.createdAt}>{relativeTime(comment.createdAt)}</time>
                </div>
                {editingId === comment.id ? (
                  <div className="comment-edit">
                    <textarea value={editBody} maxLength={1000} onChange={(event) => setEditBody(event.target.value)} />
                    <button type="button" onClick={() => void saveEdit(comment)} disabled={!editBody.trim()}>Save</button>
                    <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                ) : <p>{comment.body}</p>}
              </div>
              {user?.id === comment.userId && editingId !== comment.id ? (
                <div className="comment-card__actions">
                  <button type="button" aria-label="Edit comment" onClick={() => {
                    setEditingId(comment.id);
                    setEditBody(comment.body);
                  }}><Icon name="edit" size={14} /></button>
                  <button type="button" aria-label="Delete comment" onClick={() => void remove(comment)}>
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : !loading ? <p className="comment-thread__empty">No notes yet. You could leave the first one.</p> : null}
      {hasMore ? (
        <button type="button" className="comment-load-more" disabled={loading} onClick={() => void load(offset, true)}>
          {loading ? 'Loading…' : 'Load more'}
        </button>
      ) : null}
    </section>
  );
}
