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
    window.addEventListener('pageshow', resetLauncher);

    return () => {
      window.removeEventListener('focus', resetLauncher);
      window.removeEventListener('pageshow', resetLauncher);
    };
  }, []);

  const openFacultyRatings = (event: MouseEvent<HTMLButtonElement>) => {
    setOpening(true);
    setError('');

    try {
      void requestExpandedMode(event.nativeEvent, 'expanded').catch((cause: unknown) => {
        console.error('Unable to open Faculty Ratings:', cause);
        setError('Unable to open Faculty Ratings. Please try again.');
        setOpening(false);
      });
    } catch (cause) {
      console.error('Unable to open Faculty Ratings:', cause);
      setError('Unable to open Faculty Ratings. Please try again.');
      setOpening(false);
    }
  };

  return (
    <main
      className="faculty-preview"
      style={{
        boxSizing: 'border-box',
        width: '100%',
        padding: '20px 22px',
        borderRadius: '12px',
        background: '#1a1a1b',
        color: '#fff',
        fontFamily: 'sans-serif',
        textAlign: 'center',
        touchAction: 'pan-y',
      }}
    >
      <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🎓</div>
      <h1 style={{ fontSize: '1.5rem', margin: '0 0 8px' }}>Faculty Ratings</h1>
      <p style={{ color: '#aaa', margin: '0 auto 18px', lineHeight: 1.5, maxWidth: '420px' }}>
        Search faculty members, explore student ratings, and submit faculty or course requests.
      </p>
      <button
        type="button"
        onClick={openFacultyRatings}
        disabled={opening}
        style={{
          padding: '12px 22px',
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
      {error && <p role="alert" style={{ color: '#ffb3b3', margin: '12px 0 0' }}>{error}</p>}
    </main>
  );
};

createRoot(document.getElementById('root')!).render(<Preview />);
