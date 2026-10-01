import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

type ToastMessage = { text: string; id: number };

type ToastApi = { push: (text: string) => void };

const ToastContext = createContext<ToastApi>({ push: () => {} });

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<ToastMessage | null>(null);

  const push = useCallback((text: string) => {
    const id = Date.now();
    setMessage({ text, id });
    window.setTimeout(() => {
      setMessage((current) => (current?.id === id ? null : current));
    }, 3000);
  }, []);

  const api = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {message ? (
        <div className="toast" role="status" aria-live="polite">
          <Icon name="check-circle" size={16} />
          <span>{message.text}</span>
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}
