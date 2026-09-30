import type { ReactNode } from 'react';

type AppShellProps = {
  /** Sticky top bar for this screen. */
  bar?: ReactNode;
  /** Floating pill nav. */
  nav?: ReactNode;
  /** Drop the horizontal padding for full-bleed sections. */
  flush?: boolean;
  children: ReactNode;
};

/**
 * Mobile screen frame: .tp-stage > .tp-screen > .tp-fx + content.
 * The FX layer always ships so Wild themes can drive it.
 */
export function AppShell({ bar, nav, flush = false, children }: AppShellProps) {
  return (
    <div className="app-stage tp-stage">
      <div className="app tp-screen">
        <div className="tp-fx app__fx" aria-hidden="true" />
        {bar}
        <main className={`app__main${flush ? ' app__main--flush' : ''}`}>{children}</main>
        {nav}
      </div>
    </div>
  );
}
