import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { getWebViewMode, requestExpandedMode } from '@devvit/web/client';
import './index.css';

const Preview = () => {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!opening) return;

    const resetOpeningState = () => {
      setOpening(false);
      setError('');
    };

    const resetLauncher = () => {
      if (getWebViewMode() === 'inline') {
        resetOpeningState();
      }
    };

    const fallbackTimeout = window.setTimeout(resetOpeningState, 2500);

    window.addEventListener('focus', resetLauncher);
    window.addEventListener('pageshow', resetLauncher);
    document.addEventListener('visibilitychange', resetLauncher);

    return () => {
      window.clearTimeout(fallbackTimeout);
      window.removeEventListener('focus', resetLauncher);
      window.removeEventListener('pageshow', resetLauncher);
      document.removeEventListener('visibilitychange', resetLauncher);
    };
  }, [opening]);

  const openFacultyRatings = (event: MouseEvent<HTMLButtonElement>) => {
    setOpening(true);
    setError('');

    try {
      requestExpandedMode(event.nativeEvent, 'expanded');
    } catch (cause) {
      console.error('Unable to open Faculty Ratings:', cause);
      const detail = cause instanceof Error ? cause.message : String(cause);
      setError(`Unable to open Faculty Ratings. ${detail}`);
      setOpening(false);
    }
  };

  return (
    <main className="faculty-preview">
      <img
        src="/vit-bhopal-logo.png"
        alt="VIT Bhopal University logo"
        style={{
          display: 'block',
          width: '180px',
          maxWidth: '55%',
          height: '100px',
          objectFit: 'contain',
          marginBottom: '12px',
        }}
      />
      <h1 style={{ fontSize: '1.25rem', margin: '0 0 6px' }}>r/vitbhopal Faculty Ratings</h1>
      <p style={{ color: '#aaa', fontSize: '0.9rem', margin: '0 auto 12px', lineHeight: 1.35, maxWidth: '540px' }}>
        A reddit app to help Lions of r/vitbhopal to share their faculty ratings to help with FFCS.
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
