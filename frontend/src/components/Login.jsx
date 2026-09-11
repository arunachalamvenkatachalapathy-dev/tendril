import { useState } from 'react';
import { signInWithGoogle, signInWithGoogleRedirect, signInAsGuest, auth } from '../firebase.js';
import ThemeSelector from './ThemeSelector.jsx';
import { useTheme } from '../theme.js';

export default function Login() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [theme, setTheme] = useTheme(null);

  async function handleSignIn() {
    setError(null);
    setLoading(true);
    try {
      // 12-second safeguard against popup blockers / hanging cross-origin promises
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Sign-in popup timed out or was blocked by your browser. Please allow popups or use 1-Click Guest Access below.')), 12000)
      );
      await Promise.race([signInWithGoogle(), timeoutPromise]);
    } catch (err) {
      console.error('Sign-in error:', err);
      const isPopupBlocked = err?.code === 'auth/popup-blocked' || err?.message?.includes('popup');
      setError(
        isPopupBlocked
          ? 'Google sign-in popup was blocked by your browser. Click "1-Click Guest Access" below to enter immediately.'
          : (err?.message || 'Sign-in failed. Please try 1-Click Guest Access below.')
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleGuestSignIn() {
    setError(null);
    setGuestLoading(true);
    try {
      await signInAsGuest();
    } catch (err) {
      console.error('Guest sign-in error (Firebase):', err);
      // Fallback: if Firebase anonymous auth is blocked/disabled, create a local guest session
      // so the user is NEVER locked out of the app.
      try {
        const guestId = 'guest_' + Math.random().toString(36).slice(2, 10);
        const pseudoUser = {
          uid: guestId,
          displayName: 'Guest',
          email: null,
          isAnonymous: true,
          getIdToken: async () => 'local-guest-token',
        };
        window.__TENDRIL_LOCAL_GUEST__ = pseudoUser;
        // Trigger the auth state listener in firebase.js by dispatching a custom event
        window.dispatchEvent(new CustomEvent('tendril:localGuest', { detail: pseudoUser }));
        setError(null);
      } catch (fallbackErr) {
        setError(err?.message || 'Could not start guest session.');
      }
    } finally {
      setGuestLoading(false);
    }
  }

  return (
    <div className="login-screen-wrap">
      <div className="google-surface-card" style={{ maxWidth: '620px', width: '100%' }}>
        <div className="google-card-body login-card-inner">
          
          {/* Google Labs / Gemini Product Eyebrow */}
          <div className="google-eyebrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#a8c7fa' }}>
              <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6Z" />
            </svg>
            <span>Powered by Google Gemini</span>
          </div>

          {/* Product Title */}
          <h1 className="login-title">
            Tendril <span className="login-title-sub">Journal</span>
          </h1>

          <p className="login-subtitle">
            A thoughtful, intelligent journal. Speak your thoughts freely, organize ideas effortlessly, 
            and rediscover past reflections through continuous context.
          </p>

          {/* Google Material 3 Feature Cards */}
          <div className="login-bento-grid">
            <div className="google-feature-tile">
              <div className="tile-icon-wrap">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a8c7fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              </div>
              <div className="tile-title">Live Voice Dialogue</div>
              <div className="tile-desc">Low-latency conversational voice companion via Gemini Live audio streaming.</div>
            </div>

            <div className="google-feature-tile">
              <div className="tile-icon-wrap">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a8c7fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
              </div>
              <div className="tile-title">Continuous Context</div>
              <div className="tile-desc">Intelligently bridges thoughts and themes across days, resurfacing relevant reflections.</div>
            </div>

            <div className="google-feature-tile">
              <div className="tile-icon-wrap">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a8c7fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <div className="tile-title">Private & Secure</div>
              <div className="tile-desc">Personal entries and voice data are strictly isolated to your authenticated account.</div>
            </div>
          </div>

          {/* Theme Option Just Near Login */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: '340px', margin: '20px auto 0', padding: '0 4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Atmosphere theme:</span>
            <ThemeSelector currentTheme={theme} onSelectTheme={setTheme} />
          </div>

          {/* Sign-In Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', margin: '14px auto 0', width: '100%', maxWidth: '340px' }}>
            {/* Google Sign-In */}
            <button
              className="google-signin-btn btn-tendril-primary"
              onClick={handleSignIn}
              disabled={loading || guestLoading}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48" style={{ marginRight: '12px', flexShrink: 0 }}>
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                <path fill="none" d="M0 0h48v48H0z"/>
              </svg>
              <span>{loading ? 'Signing in with Google…' : 'Sign in with Google'}</span>
            </button>

            {/* Instant Guest / Demo Pass */}
            <button
              type="button"
              className="btn-google-secondary"
              onClick={handleGuestSignIn}
              disabled={loading || guestLoading}
              style={{
                width: '100%',
                padding: '12px 18px',
                borderRadius: '9999px',
                fontSize: '13.5px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-subtle)',
                color: '#e3e3e3',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a8c7fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
              <span>{guestLoading ? 'Starting demo session…' : '1-Click Demo / Guest Pass (Instant)'}</span>
            </button>

            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', textAlign: 'center' }}>
              Instant access • No popup or account setup required
            </span>
          </div>

          {error && (
            <div className="google-alert-error">
              {error}
            </div>
          )}

          {/* Clean Google Project Footer */}
          <div className="google-footer-meta">
            Google Cloud Project tendril-74291 • Built with Google Gemini
          </div>

        </div>
      </div>
    </div>
  );
}
