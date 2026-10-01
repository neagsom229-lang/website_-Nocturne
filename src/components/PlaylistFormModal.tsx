import { useEffect, useState, type FormEvent } from 'react';
import type { Playlist } from '../types';
import { Icon } from './Icon';

type PlaylistFormValues = {
  name: string;
  description: string;
  isPublic: boolean;
};

export function PlaylistFormModal({
  open,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  initial?: Playlist;
  onClose: () => void;
  onSubmit: (values: PlaylistFormValues) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setDescription(initial?.description ?? '');
    setIsPublic(initial?.isPublic ?? false);
    setError('');
  }, [open, initial]);

  if (!open) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await onSubmit({ name: name.trim(), description: description.trim(), isPublic });
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save this playlist.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="playlist-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !submitting) onClose();
    }}>
      <section className="playlist-modal" role="dialog" aria-modal="true" aria-labelledby="playlist-modal-title">
        <button className="iconbtn playlist-modal__close" type="button" onClick={onClose} aria-label="Close dialog">
          <Icon name="close" size={18} />
        </button>
        <p className="t-eyebrow">{initial ? 'A SMALL EDIT' : 'MAKE A LITTLE COLLECTION'}</p>
        <h2 id="playlist-modal-title" className="t-h2">{initial ? 'Shape this playlist.' : 'Start a playlist.'}</h2>
        <form className="playlist-form" onSubmit={(event) => void submit(event)}>
          <label>
            <span>Name</span>
            <input
              autoFocus
              required
              minLength={1}
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Songs for the last train"
            />
          </label>
          <label>
            <span>Description <small>Optional</small></span>
            <textarea
              maxLength={500}
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="A few words about what belongs here…"
            />
          </label>
          <label className="playlist-form__toggle">
            <input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} />
            <span><strong>Share with everyone</strong><small>Public playlists can be discovered and shared.</small></span>
          </label>
          {error ? <p className="playlist-form__error" role="alert">{error}</p> : null}
          <button className="btn btn--primary" type="submit" disabled={submitting || !name.trim()}>
            <Icon name={initial ? 'check' : 'plus'} size={16} />
            {submitting ? 'Saving…' : initial ? 'Save changes' : 'Create playlist'}
          </button>
        </form>
      </section>
    </div>
  );
}
