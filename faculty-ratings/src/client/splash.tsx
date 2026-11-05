import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

export const App = () => {
  const [currentView, setCurrentView] = useState('home');
  const [isMod, setIsMod] = useState(false);

  useEffect(() => {
    // 1. Listen for data coming from the Devvit backend
    const messageListener = (event: MessageEvent) => {
      const { type, data } = event.data;
      if (type === 'devvit-message') {
        const message = data.message;
        if (message.type === 'INIT_RESPONSE') {
          setIsMod(message.payload.isMod);
        }
      }
    };
    window.addEventListener('message', messageListener);

    // 2. Ask the Devvit backend if the current user is a mod
    window.parent.postMessage({ type: 'INITIALIZE' }, '*');

    return () => window.removeEventListener('message', messageListener);
  }, []);

  return (
    <div style={{ 
      backgroundColor: '#1a1a1b', 
      color: 'white', 
      minHeight: '100vh', 
      padding: '20px', 
      fontFamily: 'sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      
      {currentView === 'home' && (
        <div style={{ textAlign: 'center', maxWidth: '600px', width: '100%' }}>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '10px' }}>Faculty Rating Portal</h1>
          <p style={{ color: '#888', marginBottom: '40px', fontSize: '1.2rem' }}>Select an option to proceed</p>
          
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button 
              onClick={() => setCurrentView('rate_list')}
              style={{ padding: '12px 24px', cursor: 'pointer', borderRadius: '8px', border: 'none', backgroundColor: '#0079D3', color: 'white', fontSize: '1rem', fontWeight: 'bold', transition: 'background 0.2s' }}>
              Rate a Faculty
            </button>
            <button 
              onClick={() => setCurrentView('check_list')}
              style={{ padding: '12px 24px', cursor: 'pointer', borderRadius: '8px', border: '2px solid #0079D3', backgroundColor: 'transparent', color: '#0079D3', fontSize: '1rem', fontWeight: 'bold', transition: 'background 0.2s' }}>
              Check Faculty Rating
            </button>
          </div>

          {/* Admin Panel - Only visible if the backend confirmed they are a Mod */}
          {isMod && (
            <div style={{ marginTop: '50px' }}>
              <button 
                onClick={() => setCurrentView('admin')}
                style={{ padding: '12px 24px', cursor: 'pointer', borderRadius: '8px', border: 'none', backgroundColor: '#FF4500', color: 'white', fontSize: '1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 auto' }}>
                <span>⚙️</span> Mod Admin Panel
              </button>
            </div>
          )}
        </div>
      )}

      {currentView !== 'home' && (
        <div style={{ textAlign: 'center', maxWidth: '600px', width: '100%' }}>
          <h2 style={{ fontSize: '2rem', marginBottom: '20px' }}>
            {currentView === 'rate_list' ? 'Rate a Faculty' : 
             currentView === 'check_list' ? 'Faculty Ratings' : 
             'Admin Dashboard'}
          </h2>
          <p style={{ color: '#aaa', marginBottom: '30px' }}>Content coming next.</p>
          
          <button 
            onClick={() => setCurrentView('home')}
            style={{ padding: '10px 20px', cursor: 'pointer', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '6px', fontSize: '1rem' }}>
            Back to Home
          </button>
        </div>
      )}
    </div>
  );
};

// --- Mount the React App to the HTML ---
const rootElement = document.getElementById('root') || document.getElementById('app');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}