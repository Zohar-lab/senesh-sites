import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  friendlyMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      friendlyMessage: '',
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let message = 'אירעה שגיאה בלתי צפויה בטעינת הפורטל.';
    try {
      const parsed = JSON.parse(error.message) as { error?: string };
      if (parsed?.error?.includes('Quota exceeded')) {
        message = 'מכסת הקריאות היומית של מסד הנתונים הסתיימה להיום ותתאפס מחר.';
      } else if (parsed?.error?.toLowerCase().includes('permission')) {
        message = 'אין הרשאה מתאימה לביצוע פעולה זו. ודאו שאתם מחוברים עם החשבון המתאים.';
      }
    } catch {
      if (error.message.includes('Quota exceeded')) {
        message = 'מכסת הקריאות היומית של מסד הנתונים הסתיימה להיום ותתאפס מחר.';
      }
    }

    return {
      hasError: true,
      friendlyMessage: message,
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Portal ErrorBoundary caught error:', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, friendlyMessage: '' });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-white"
        >
          <div className="max-w-md w-full bg-white text-slate-950 border-2 border-lime-400 rounded-2xl shadow-[8px_8px_0px_#ec4899] p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-700 inline-flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" aria-hidden="true" />
            </div>
            <h1 className="font-display text-xl font-black">משהו השתבש בדרך</h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              {this.state.friendlyMessage}
            </p>
            <button
              type="button"
              onClick={this.handleRetry}
              className="min-h-11 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border-2 border-slate-950 bg-lime-400 text-slate-950 text-sm font-extrabold shadow-[3px_3px_0px_#020617] hover:bg-lime-300 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              <span>רענון הפורטל</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
