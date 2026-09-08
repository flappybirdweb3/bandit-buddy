import { Component } from 'react';
import type { ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; error?: string }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => this.setState({ hasError: false })} />
          <div className="relative w-full max-w-md glass rounded-t-3xl p-6 pb-10 text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <div className="text-white/60 text-sm">Feature unavailable in this environment.</div>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="mt-4 glass px-6 py-2.5 rounded-2xl text-white/70 font-semibold text-sm active:scale-95"
            >
              Close
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
