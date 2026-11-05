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
      <section
        style={{
          boxSizing: 'border-box',
          display: 'flex',
          width: '100%',
          maxWidth: '420px',
          minHeight: 'min(680px, calc(100vh - 40px))',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-evenly',
          gap: '22px',
          padding: '28px 12px',
          textAlign: 'center',
        }}
      >
        <img
          src="/vit-bhopal-logo.png"
          alt="VIT Bhopal University logo"
          style={{
            display: 'block',
            boxSizing: 'border-box',
            width: '240px',
            maxWidth: '90%',
            height: '145px',
            padding: '12px',
            borderRadius: '12px',
            background: '#fff',
            objectFit: 'contain',
          }}
        />
        <h1 style={{ fontSize: '1.4rem', lineHeight: 1.3, margin: 0 }}>
          r/vitbhopal Faculty Ratings
        </h1>
        <p
          style={{
            width: '100%',
            color: '#aaa',
            fontSize: '0.95rem',
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          A reddit app to help Lions of r/vitbhopal to share their faculty ratings to help with FFCS.
        </p>
        <button
          type="button"
          onClick={openFacultyRatings}
          disabled={opening}
          style={{
            padding: '13px 24px',
            borderRadius: '8px',
            border: 'none',
            background: '#0079D3',
            color: '#fff',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: opening ? 'wait' : 'pointer',
            opacity: opening ? 0.75 : 1,
          }}
        >
          {opening ? 'Opening...' : 'Launch App'}
        </button>
        {error && (
          <p role="alert" style={{ color: '#ffb3b3', fontSize: '0.85rem', margin: 0 }}>
            {error}
          </p>
        )}
      </section>
    </main>
  );
};

createRoot(document.getElementById('root')!).render(<Preview />);
