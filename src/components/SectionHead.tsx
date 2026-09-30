import type { ReactNode } from 'react';

type SectionHeadProps = {
  title: string;
  hint?: string;
  action?: ReactNode;
};

export function SectionHead({ title, hint, action }: SectionHeadProps) {
  return (
    <div className="app__section-head">
      <div style={{ minWidth: 0 }}>
        <h2 className="t-h3">{title}</h2>
        {hint ? <p className="t-small t-mute">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}
