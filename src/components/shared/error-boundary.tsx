'use client';

import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] App crashed:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex flex-col items-center justify-center min-h-screen px-8"
          style={{ background: 'var(--ios-bg, #F2F2F7)' }}
        >
          <div
            className="w-[64px] h-[64px] rounded-2xl flex items-center justify-center mb-6"
            style={{ background: '#FFF0F0' }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#FF3B30" />
            </svg>
          </div>
          <p className="text-[17px] font-semibold mb-2" style={{ color: 'var(--ios-text-primary, #1C1C1E)' }}>
            Что-то пошло не так
          </p>
          <p className="text-[13px] mb-6 text-center" style={{ color: '#8E8E93' }}>
            {this.state.error?.message || 'Произошла неожиданная ошибка'}
          </p>
          <button
            onClick={this.handleReset}
            className="px-6 py-3 rounded-xl text-[15px] font-semibold text-white"
            style={{ background: '#007AFF' }}
          >
            Попробовать снова
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
