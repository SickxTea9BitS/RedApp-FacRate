import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { getWebViewMode, requestExpandedMode } from '@devvit/web/client';
import './index.css';

const Preview = () => {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const resetLauncher = () => {
      if (getWebViewMode() === 'inline') {
        setOpening(false);
        setError('');
      }
    };

    window.addEventListener('focus', resetLauncher);
    return () => window.removeEventListener('focus', resetLauncher);
  }, []);

  const openFacultyRatings = (event: MouseEvent<HTMLButtonElement>) => {
    setOpening(true);
    setError('');

    try {
      void requestExpandedMode(event.nativeEvent, 'expanded').catch((cause: unknown) => {
        console.error('Unable to open Faculty Ratings:', cause);
        const detail = cause instanceof Error ? cause.message : String(cause);
        setError(`Unable to open Faculty Ratings. ${detail}`);
        setOpening(false);
      });
    } catch (cause) {
      console.error('Unable to open Faculty Ratings:', cause);
      const detail = cause instanceof Error ? cause.message : String(cause);
      setError(`Unable to open Faculty Ratings. ${detail}`);
      setOpening(false);
    }
  };

  return (
    <main
      className="faculty-preview"
      style={{
        boxSizing: 'border-box',
        width: '100%',
        padding: '14px 16px',
        borderRadius: '12px',
        background: '#1a1a1b',
        color: '#fff',
        fontFamily: 'sans-serif',
        textAlign: 'center',
        touchAction: 'pan-y',
      }}
    >
      <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>🎓</div>
      <h1 style={{ fontSize: '1.25rem', margin: '0 0 6px' }}>Faculty Ratings</h1>
      <p style={{ color: '#aaa', fontSize: '0.9rem', margin: '0 auto 12px', lineHeight: 1.35, maxWidth: '420px' }}>
        Search faculty members, explore student ratings, and submit faculty or course requests.
      </p>
      <button
        type="button"
        onClick={openFacultyRatings}
        disabled={opening}
        style={{
          padding: '10px 18px',
          borderRadius: '8px',
          border: 'none',
          background: '#0079D3',
          color: '#fff',
          fontSize: '0.95rem',
          fontWeight: 700,
          cursor: opening ? 'wait' : 'pointer',
          opacity: opening ? 0.75 : 1,
        }}
      >
        {opening ? 'Opening...' : 'Launch App'}
      </button>
      {error && <p role="alert" style={{ color: '#ffb3b3', fontSize: '0.85rem', margin: '10px 0 0' }}>{error}</p>}
    </main>
  );
};

createRoot(document.getElementById('root')!).render(<Preview />);
