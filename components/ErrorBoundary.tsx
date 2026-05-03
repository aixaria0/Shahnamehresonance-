'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = this.state.error?.message || 'An unexpected error occurred.';
      try {
        const parsed = JSON.parse(errorMessage);
        if (parsed && parsed.error) {
          errorMessage = parsed.error;
        }
      } catch (e) {
        // Not JSON
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-royal-black p-6 text-center" dir="rtl">
          <div className="glass-panel p-8 rounded-3xl border border-red-500/30 max-w-md w-full">
            <h2 className="text-2xl font-bold text-red-400 mb-4">خطایی رخ داد</h2>
            <p className="text-royal-turquoise/80 mb-6">{errorMessage}</p>
            <button
              className="px-6 py-2 bg-royal-gold text-royal-black rounded-full font-bold hover:bg-royal-gold/80 transition-all"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              تلاش مجدد
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
