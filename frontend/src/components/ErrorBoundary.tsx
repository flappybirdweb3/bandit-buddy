import { Component } from 'react';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}
interface State {
  hasError: boolean;
  error?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error?.message || String(error) };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  handleClose = () => {
    if (this.props.onReset) {
      this.setState({ hasError: false, error: undefined });
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const errorMsg = (this.state.error || '').toLowerCase();
      const isChunkError =
        errorMsg.includes('failed to fetch') ||
        errorMsg.includes('failed to load') ||
        errorMsg.includes('dynamically imported') ||
        errorMsg.includes('importing a module script') ||
        errorMsg.includes('chunkloaderror') ||
        errorMsg.includes('loading chunk') ||
        errorMsg.includes('load failed') ||
        errorMsg.includes('fetch failed') ||
        errorMsg.includes('404');

      return (
        <div
          className="fixed inset-0 z-[9999] flex flex-col justify-end px-7 py-2"
          style={{ paddingBottom: 'calc(var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 32px)) + 100px)' }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={this.handleClose} />
          <div className="relative w-full max-w-md glass mx-auto rounded-3xl overflow-hidden p-6 pb-8 text-center border border-white/15">
            <div className="text-4xl mb-2">{isChunkError ? '🚀' : '⚠️'}</div>
            <div className="text-white font-bold text-base mb-1">
              {isChunkError ? 'New Update Available' : 'Temporary Glitch'}
            </div>
            <div className="text-white/60 text-xs mb-4 leading-relaxed">
              {isChunkError
                ? 'A newer version of Bandit Buddy has been deployed. Please reload the game to get the latest features.'
                : 'Unable to open this section right now. Please reload or try again in a moment.'}
            </div>
            <div className="flex gap-2 justify-center">
              <button
                onClick={this.handleReload}
                className="bg-amber-500 hover:bg-amber-600 text-black font-black px-5 py-2.5 rounded-2xl text-xs active:scale-95 transition-all shadow-lg shadow-amber-500/20"
              >
                Reload Game
              </button>
              <button
                onClick={this.handleClose}
                className="glass px-5 py-2.5 rounded-2xl text-white/80 font-semibold text-xs active:scale-95 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

