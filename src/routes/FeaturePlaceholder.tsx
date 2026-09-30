import { Link } from 'react-router-dom';

type FeaturePlaceholderProps = {
  name: string;
  feature: string;
};

export function FeaturePlaceholder({ name, feature }: FeaturePlaceholderProps) {
  return (
    <main className="music-page min-h-screen bg-canvas font-sans text-ink">
      <div className="feature-placeholder">
        <p className="t-eyebrow">BEDROOM POP · NEXT UP</p>
        <h1 className="t-h1">{name}</h1>
        <p className="t-lead">{feature} is mapped in the app and will be built in its own phase.</p>
        <Link to="/" className="btn btn--primary">
          Back to the project hub
        </Link>
      </div>
    </main>
  );
}
