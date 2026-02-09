'use client';

import { useEffect, useState } from 'react';
import { sdk } from '@farcaster/frame-sdk';
import SmartAssistant from '@/components/SmartAssistant';
import ImpactDashboard from '@/components/ImpactDashboard';
import Verification from '@/components/Verification';
import Leaderboard from '@/components/Leaderboard';

export default function ReplatePage() {
  const [isReady, setIsReady] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<'home' | 'assistant' | 'verify' | 'impact' | 'leaderboard'>('home');

  useEffect(() => {
    const init = async () => {
      try {
        await sdk.actions.ready();
      } catch (e) {
        console.error('Frame SDK init error', e);
      } finally {
        setIsReady(true);
      }
    };
    init();
  }, []);

  if (!isReady) return (
    <div className="flex flex-col items-center justify-center h-screen bg-background gap-4">
      <div className="w-16 h-16 plate-card animate-spin border-t-primary border-4 shadow-none"></div>
      <p className="text-primary font-bold animate-pulse">Initializing Replate...</p>
    </div>
  );

  return (
    <div className="max-w-[450px] mx-auto h-screen flex flex-col relative overflow-hidden bg-background selection:bg-accent/20">
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-8 py-16 relative z-10 custom-scrollbar flex flex-col h-full">
        {currentScreen === 'home' && (
          <div className="flex-1 flex flex-col items-center justify-between text-center animate-fadeIn h-full">
            {/* Top Section: Logo & Brand */}
            <div className="flex flex-col items-center gap-1 mt-4">
              <div className="text-primary mb-2">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C12 2 12 10 2 10C2 10 2 22 12 22C12 22 22 22 22 10C22 10 12 10 12 2Z" />
                </svg>
              </div>
              <h1 className="text-4xl font-extrabold text-primary tracking-tight">Replate</h1>
              <p className="text-sm font-medium text-text-muted">Waste nothing.</p>
            </div>

            {/* Middle Section: Hero Text */}
            <div className="space-y-4">
              <h2 className="text-[52px] font-extrabold text-primary leading-[1.05] tracking-tight">
                Replate your cart.
              </h2>
              <p className="text-lg text-text-muted font-medium max-w-[280px] mx-auto leading-relaxed">
                Shop smart. Eat all. Save the planet.
              </p>
            </div>

            {/* Bottom Section: Action Button */}
            <div className="w-full pb-10">
              <button
                onClick={() => setCurrentScreen('assistant')}
                className="btn-primary w-full max-w-[340px]"
              >
                Start Shopping
              </button>
            </div>
          </div>
        )}

        {currentScreen === 'assistant' && <SmartAssistant />}
        {currentScreen === 'verify' && <Verification />}
        {currentScreen === 'impact' && <ImpactDashboard />}
        {currentScreen === 'leaderboard' && <Leaderboard />}
      </main>

      {/* Navigation - only shown when NOT on home screen */}
      {currentScreen !== 'home' && (
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[94%] max-w-[460px] h-22 glass-panel flex justify-between items-center px-4 z-50 py-2">
          <button
            onClick={() => setCurrentScreen('assistant')}
            className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${currentScreen === 'assistant' ? 'text-primary' : 'text-text-muted opacity-40'}`}
          >
            <span className="text-2xl">🥗</span>
            <span className="text-[9px] font-black uppercase tracking-tighter">Plan</span>
          </button>

          <button
            onClick={() => setCurrentScreen('verify')}
            className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${currentScreen === 'verify' ? 'text-primary' : 'text-text-muted opacity-40'}`}
          >
            <span className="text-2xl">📸</span>
            <span className="text-[9px] font-black uppercase tracking-tighter">Verify</span>
          </button>

          <button
            onClick={() => setCurrentScreen('home')}
            className={`text-2xl opacity-40 hover:opacity-100 transition-opacity p-2`}
          >
            🌿
          </button>

          <button
            onClick={() => setCurrentScreen('impact')}
            className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${currentScreen === 'impact' ? 'text-primary' : 'text-text-muted opacity-40'}`}
          >
            <span className="text-2xl">🏆</span>
            <span className="text-[9px] font-black uppercase tracking-tighter">Impact</span>
          </button>

          <button
            onClick={() => setCurrentScreen('leaderboard')}
            className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${currentScreen === 'leaderboard' ? 'text-primary' : 'text-text-muted opacity-40'}`}
          >
            <span className="text-2xl">📊</span>
            <span className="text-[9px] font-black uppercase tracking-tighter">Ranks</span>
          </button>
        </nav>
      )}
    </div>
  );
}
