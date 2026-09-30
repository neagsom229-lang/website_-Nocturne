import type { ReactNode } from 'react';
import { useToast } from './Toast';

/**
 * Apple and Google sign-in buttons are exempt from the theme: brand rules require
 * solid black with a white mark for Apple, and white with the official multicolour G
 * for Google. Only the radius token and press scale follow the pack.
 */
function AppleLogo() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        fill="#fff"
        d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.9-1.4-.1-2.7.8-3.4.8-.7 0-1.8-.8-3-.8-1.5 0-2.9.9-3.7 2.2-1.6 2.7-.4 6.7 1.1 8.9.7 1.1 1.6 2.3 2.8 2.2 1.1 0 1.5-.7 2.9-.7 1.3 0 1.7.7 2.9.7 1.2 0 2-1.1 2.7-2.2.9-1.3 1.2-2.5 1.2-2.6 0 0-2.3-.9-2.3-3.1z"
      />
      <path
        fill="#fff"
        d="M14.1 5.6c.6-.7 1-1.7.9-2.7-.9 0-1.9.6-2.5 1.3-.6.6-1.1 1.6-.9 2.6 1 .1 1.9-.5 2.5-1.2z"
      />
    </svg>
  );
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.9-.1-1.5-.2-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.3 3.8v.1l3.4 2.6c2-1.8 3.4-4.5 3.4-8.4z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2-6.7-4.9H5.2l-3.7 2.8C3.5 21.3 7.4 24 12 24z"
      />
      <path fill="#FBBC05" d="M5.3 14.5c-.2-.7-.4-1.5-.4-2.5s.1-1.7.4-2.5L5.2 9.4 1.5 6.6C.5 8.1 0 10 0 12s.5 3.9 1.5 5.4z" />
      <path
        fill="#EA4335"
        d="M12 4.7c2.2 0 3.7.9 4.5 1.7l3.3-3.2C17.9 1.2 15.2 0 12 0 7.4 0 3.5 2.7 1.5 6.6l3.8 3c.9-2.9 3.6-4.9 6.7-4.9z"
      />
    </svg>
  );
}

function SocialButton({
  children,
  onClick,
  tone,
  className,
}: {
  children: ReactNode;
  onClick: () => void;
  tone: 'apple' | 'google';
  className: string;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      style={
        tone === 'apple'
          ? { background: '#000', color: '#fff', borderColor: '#000' }
          : { background: '#fff', color: '#1f1f1f', borderColor: '#dadce0' }
      }
    >
      {children}
    </button>
  );
}

export function AppleButton({ onClick }: { onClick: () => void }) {
  return (
    <SocialButton tone="apple" className="btn btn--block" onClick={onClick}>
      <AppleLogo />
      <span>Continue with Apple</span>
    </SocialButton>
  );
}

export function GoogleButton({ onClick }: { onClick: () => void }) {
  return (
    <SocialButton tone="google" className="btn btn--block" onClick={onClick}>
      <GoogleLogo />
      <span>Continue with Google</span>
    </SocialButton>
  );
}

/** Both providers wired to the same demo "accepted" acknowledgement. */
export function SocialAuthRow() {
  const toast = useToast();
  const accept = (provider: string) => toast.push(`${provider} sign-in accepted — this demo stops here.`);

  return (
    <div className="grid" style={{ gap: 10 }}>
      <AppleButton onClick={() => accept('Apple')} />
      <GoogleButton onClick={() => accept('Google')} />
    </div>
  );
}
