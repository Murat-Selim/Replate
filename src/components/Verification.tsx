'use client';

import { useState } from 'react';

export default function Verification() {
    const [isVerifying, setIsVerifying] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleVerify = () => {
        setIsVerifying(true);
        // Simulate verification logic
        setTimeout(() => {
            setIsVerifying(false);
            setSuccess(true);
        }, 2000);
    };

    return (
        <div className="animate-fadeIn space-y-12 pb-12">
            <div className="text-center space-y-2 pt-6">
                <h2 className="text-4xl font-extrabold text-primary tracking-tight">Verify Shop</h2>
                <p className="text-sm font-medium text-text-muted">Prove your impact onchain.</p>
            </div>

            {!success ? (
                <div className="flex flex-col items-center justify-center min-h-[400px] space-y-12">
                    {/* Large Upload Circle */}
                    <button
                        onClick={handleVerify}
                        disabled={isVerifying}
                        className="w-56 h-56 rounded-full bg-white border-8 border-primary/5 shadow-2xl flex flex-col items-center justify-center group active:scale-95 transition-all outline-none"
                    >
                        <span className="text-7xl group-hover:scale-110 transition-transform">📸</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary mt-4 opacity-40">Tap to Scan</span>
                    </button>

                    <div className="text-center space-y-6 w-full max-w-[320px]">
                        <p className="text-sm text-text-muted font-semibold leading-relaxed">
                            Upload your receipt to verify your zero-waste grocery run and earn badges.
                        </p>

                        <button
                            onClick={handleVerify}
                            disabled={isVerifying}
                            className={`btn-primary w-full ${isVerifying ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isVerifying ? 'Verifying...' : 'Scan Receipt'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center min-h-[400px] space-y-12 py-10">
                    <div className="w-56 h-56 rounded-full bg-primary text-white shadow-2xl flex items-center justify-center animate-fadeIn">
                        <span className="text-8xl">✅</span>
                    </div>

                    <div className="text-center space-y-2">
                        <h3 className="text-4xl font-black text-primary">Verified!</h3>
                        <p className="text-lg text-text-muted font-semibold">+100 XP Earned Onchain</p>
                    </div>

                    <div className="w-full max-w-[340px] p-6 bg-primary/5 rounded-3xl border border-primary/10 text-center">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary opacity-40">Transaction Verified on Base</span>
                        <p className="text-[10px] font-mono text-primary mt-2 break-all opacity-60">0x71c...a293bf8e29a9</p>
                    </div>

                    <button
                        onClick={() => setSuccess(false)}
                        className="text-sm font-bold text-primary underline underline-offset-8 decoration-primary/20 hover:text-accent transition-colors"
                    >
                        Verify another shop
                    </button>
                </div>
            )}
        </div>
    );
}
