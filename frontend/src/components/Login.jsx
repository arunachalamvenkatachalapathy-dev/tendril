import { useState } from 'react';
import { signInWithGoogle } from '../firebase.js';

export default function Login() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Sign-in error:', err);
      setError(err?.message || 'Sign-in failed. Please ensure Google Auth is enabled.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen-wrap">
      <div className="bezel-outer" style={{ maxWidth: '640px', width: '100%' }}>
        <div className="bezel-inner login-card-inner">
          
          {/* Eyebrow Pill */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 14px',
            borderRadius: '9999px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            fontWeight: '600',
            letterSpacing: '0.15em',
            color: '#34d399',
            textTransform: 'uppercase',
            marginBottom: '20px'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
            Zero-Trust Neural Architecture
          </div>

          {/* Logo & Headline */}
          <h1 className="login-title">
            Tendril <span style={{
              background: 'linear-gradient(135deg, #10b981, #06b6d4)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>Neural Journal</span>
          </h1>

          <p className="login-subtitle">
            Cultivate your stream of consciousness. Ambient conversational voice companion with 
            persistent 3-tier layered memory and live cognitive idea distillation.
          </p>

          {/* Feature Trio Bento */}
          <div className="login-bento-grid">
            <div style={{
              padding: '16px 14px',
              borderRadius: '16px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-subtle)'
            }}>
              <div style={{ fontSize: '18px', marginBottom: '6px' }}>🎙️</div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#f1f5f9', marginBottom: '4px' }}>Live Voice</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>Gemini Live native multimodal audio streaming</div>
            </div>

            <div style={{
              padding: '16px 14px',
              borderRadius: '16px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-subtle)'
            }}>
              <div style={{ fontSize: '18px', marginBottom: '6px' }}>🧠</div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#f1f5f9', marginBottom: '4px' }}>Layered Memory</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>Now → Recent 7-Day Rollup → Identity Archive</div>
            </div>

            <div style={{
              padding: '16px 14px',
              borderRadius: '16px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-subtle)'
            }}>
              <div style={{ fontSize: '18px', marginBottom: '6px' }}>🛡️</div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#f1f5f9', marginBottom: '4px' }}>Zero-Key Vault</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>Strict UID row isolation & Secret Manager</div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center', margin: '0 auto' }}>
            <button
              className="btn-tendril-primary"
              onClick={handleSignIn}
              disabled={loading}
              style={{
                padding: '10px 14px 10px 28px',
                fontSize: '15px',
                display: 'inline-flex'
              }}
            >
              <span>{loading ? 'Authenticating…' : 'Initialize with Google'}</span>
              <div className="btn-inner-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </div>
            </button>
          </div>

          {error && (
            <div style={{
              marginTop: '20px',
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: '#fda4af',
              fontSize: '12px'
            }}>
              {error}
            </div>
          )}

          <div style={{
            marginTop: '32px',
            fontSize: '11px',
            color: 'var(--text-dim)',
            fontFamily: 'var(--font-mono)'
          }}>
            PROJECT TENDRIL • ID: tendril-74291 • REGION: asia-south1
          </div>

        </div>
      </div>
    </div>
  );
}
