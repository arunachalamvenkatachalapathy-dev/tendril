import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught render error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '28px',
          margin: '20px auto',
          maxWidth: '520px',
          background: 'rgba(242, 139, 130, 0.08)',
          border: '1px solid rgba(242, 139, 130, 0.3)',
          borderRadius: '16px',
          color: '#f1f3f4',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: 'rgba(242, 139, 130, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px',
            color: '#f28b82',
            fontSize: '20px'
          }}>
            ⚠
          </div>
          <h3 style={{ fontSize: '17px', fontWeight: '600', marginBottom: '8px', color: '#f28b82' }}>
            Something went wrong
          </h3>
          <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '18px', lineHeight: '1.5' }}>
            {this.state.error?.message || 'An unexpected error interrupted the session.'}
          </p>
          <button
            onClick={this.handleReset}
            style={{
              background: '#a8c7fa',
              color: '#040c17',
              border: 'none',
              padding: '8px 20px',
              borderRadius: '999px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Recover Session
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
