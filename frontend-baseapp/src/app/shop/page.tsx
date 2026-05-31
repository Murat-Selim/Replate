"use client";

import React, { useState, useRef } from "react";
import Shell from "@/components/Shell";
import { Minus, Plus, Sparkles, Camera, Check, Loader2, X, Leaf, Star, Trophy, Image } from "lucide-react";
import { useAccount } from "wagmi";
import { getApiUrl } from "@/lib/api";
import { compressImage } from "@/lib/image";

interface VerificationResult {
    txHash: string;
    healthScore: number;
    nutritionScore: number;
    totalItems: number;
    healthyItems: number;
    unhealthyItems: number;
    fruitVegGrams: number;
    daysCovered: number;
    pointsEarned: number;
    badgeMinted: boolean;
}

export default function SmartShop() {
    const { address } = useAccount();
    const [householdSize, setHouseholdSize] = useState(2);
    const [duration, setDuration] = useState(7);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isCompressing, setIsCompressing] = useState(false);
    const [result, setResult] = useState<VerificationResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setIsCompressing(true);
            setError(null);
            try {
                const compressed = await compressImage(file, 1600, 1600, 0.8);
                setImagePreview(compressed);
            } catch (err) {
                console.error("Image compression failed, falling back to original", err);
                const reader = new FileReader();
                reader.onloadend = () => {
                    setImagePreview(reader.result as string);
                };
                reader.readAsDataURL(file);
            } finally {
                setIsCompressing(false);
            }
        }
    };

    const triggerGalleryInput = () => {
        fileInputRef.current?.click();
    };

    const handleSelectOption = (option: "camera" | "gallery") => {
        setShowUploadModal(false);
        if (option === "camera") {
            startCamera();
        } else {
            triggerGalleryInput();
        }
    };

    const startCamera = async () => {
        try {
            setError(null);
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
                audio: false
            });
            setCameraStream(stream);
            setIsCameraActive(true);
            
            // Connect stream to video element
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            }, 100);
        } catch (err) {
            console.error("Failed to start camera stream", err);
            setError("Could not access camera. Please choose from gallery instead.");
        }
    };

    const stopCamera = () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
        setIsCameraActive(false);
    };

    const capturePhoto = () => {
        if (videoRef.current) {
            const video = videoRef.current;
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
                compressCapturedImage(dataUrl);
                stopCamera();
            }
        }
    };

    const compressCapturedImage = async (dataUrl: string) => {
        setIsCompressing(true);
        setError(null);
        try {
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            const file = new File([blob], "captured-receipt.jpg", { type: "image/jpeg" });
            const compressed = await compressImage(file, 1600, 1600, 0.8);
            setImagePreview(compressed);
        } catch (err) {
            console.error("Captured image compression failed", err);
            setImagePreview(dataUrl);
        } finally {
            setIsCompressing(false);
        }
    };

    const handleVerify = async () => {
        if (!imagePreview || !address) {
            setError("Please upload a receipt and ensure your wallet is connected");
            return;
        }

        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            const base64Data = imagePreview.split(",")[1] || imagePreview;
            const response = await fetch(getApiUrl("/api/verify-receipt"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    imageBase64: base64Data,
                    userAddress: address,
                    householdSize,
                    daysCovered: duration,
                }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || "Verification failed");
            }

            setResult(data.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    const handleShareWarpcast = () => {
        if (!result) return;
        const shareText = `Just verified my grocery run on Replate\n\nHealth Score: ${result.healthScore}/100\nEarned: ${result.pointsEarned} XP\n\nShop smart. Nourish well. Earn onchain.`;
        window.open(`https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}`, '_blank');
    };

    const handleShareTwitter = () => {
        if (!result) return;
        const shareText = `Just verified my grocery run on @replate\n\nHealth Score: ${result.healthScore}/100\nEarned: ${result.pointsEarned} XP\n\nShop smart. Nourish well. Earn onchain.\n\nhttps://replate.app`;
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank');
    };

    const resetForm = () => {
        setImagePreview(null);
        setResult(null);
        setError(null);
    };

    return (
        <>
            <Shell>
            <div className="space-y-8 animate-fade-in-up">
                {/* Page Header */}
                <div className="text-center lg:text-left space-y-2">
                    <h1 className="text-3xl sm:text-4xl font-black text-brand-primary">Shop & Verify</h1>
                    <p className="text-brand-text/60">Upload your receipt and earn XP rewards.</p>
                </div>

                {/* Main Content — 2 column on desktop */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                    {/* Left Column: Upload + Controls */}
                    <div className="space-y-6">
                        {/* Receipt Upload */}
                        <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-6">
                            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-brand-text/30 text-center">
                                Upload Receipt
                            </h2>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept="image/*"
                                className="hidden"
                            />
                            <div
                                onClick={() => setShowUploadModal(true)}
                                className="relative group cursor-pointer mx-auto"
                            >
                                <div className="relative w-full aspect-[4/3] max-w-sm mx-auto bg-brand-accent/30 rounded-3xl border-2 border-dashed border-brand-primary/15 flex flex-col items-center justify-center overflow-hidden transition-all group-hover:border-brand-primary/30 group-hover:bg-brand-accent/50">
                                    {imagePreview ? (
                                        <div className="relative w-full h-full">
                                            <img
                                                src={imagePreview}
                                                alt="Receipt preview"
                                                className="w-full h-full object-cover rounded-3xl"
                                            />
                                            <div className="absolute inset-0 bg-brand-primary/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl">
                                                <div className="bg-white/20 backdrop-blur-md p-4 rounded-full border border-white/30">
                                                    <Camera size={28} className="text-white" />
                                                </div>
                                            </div>
                                            <div className="absolute top-3 right-3 bg-green-500 text-white p-2 rounded-full shadow-lg">
                                                <Check size={16} />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-3 p-8">
                                            <div className="w-16 h-16 bg-brand-accent rounded-2xl flex items-center justify-center text-brand-primary group-hover:scale-110 transition-transform">
                                                <Camera size={32} />
                                            </div>
                                            <span className="font-bold text-brand-text/40 uppercase tracking-widest text-[10px] text-center">
                                                Tap to take photo
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
                            {/* Household Size */}
                            <div className="glass-card rounded-3xl p-6 space-y-4">
                                <h2 className="text-center text-xs font-black uppercase tracking-[0.15em] text-brand-text/30">
                                    Household
                                </h2>
                                <div className="flex items-center justify-center gap-4">
                                    <button
                                        onClick={() => setHouseholdSize(Math.max(1, householdSize - 1))}
                                        className="w-10 h-10 rounded-full bg-brand-primary text-white flex items-center justify-center active:scale-90 transition-transform shadow-lg shadow-brand-primary/20"
                                    >
                                        <Minus size={18} />
                                    </button>
                                    <span className="text-5xl font-black text-brand-primary w-16 text-center tabular-nums">
                                        {householdSize}
                                    </span>
                                    <button
                                        onClick={() => setHouseholdSize(householdSize + 1)}
                                        className="w-10 h-10 rounded-full bg-brand-primary text-white flex items-center justify-center active:scale-90 transition-transform shadow-lg shadow-brand-primary/20"
                                    >
                                        <Plus size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Shopping Duration */}
                            <div className="glass-card rounded-3xl p-6 space-y-4">
                                <h2 className="text-center text-xs font-black uppercase tracking-[0.15em] text-brand-text/30">
                                    Duration
                                </h2>
                                <div className="flex items-center justify-center gap-4">
                                    <button
                                        onClick={() => setDuration(Math.max(1, duration - 1))}
                                        className="w-10 h-10 rounded-full bg-brand-primary text-white flex items-center justify-center active:scale-90 transition-transform shadow-lg shadow-brand-primary/20"
                                    >
                                        <Minus size={18} />
                                    </button>
                                    <div className="flex items-baseline gap-1 w-20 justify-center">
                                        <span className="text-5xl font-black text-brand-primary tabular-nums">
                                            {duration}
                                        </span>
                                        <span className="text-brand-text/30 font-bold text-sm">d</span>
                                    </div>
                                    <button
                                        onClick={() => setDuration(duration + 1)}
                                        className="w-10 h-10 rounded-full bg-brand-primary text-white flex items-center justify-center active:scale-90 transition-transform shadow-lg shadow-brand-primary/20"
                                    >
                                        <Plus size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Verify Button */}
                        <button
                            onClick={handleVerify}
                            disabled={isLoading || isCompressing || !imagePreview}
                            className="w-full bg-brand-primary text-white py-4 px-8 rounded-2xl font-bold text-lg shadow-xl shadow-brand-primary/20 hover:bg-brand-secondary hover:shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-xl"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 size={22} className="animate-spin" />
                                    Verifying...
                                </>
                            ) : isCompressing ? (
                                <>
                                    <Loader2 size={22} className="animate-spin" />
                                    Compressing...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={22} />
                                    Verify & Earn
                                </>
                            )}
                        </button>

                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-2xl text-sm font-medium text-center">
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Right Column: Results or Tip */}
                    <div className="space-y-6">
                        {result ? (
                            <div className="glass-card rounded-3xl p-6 sm:p-8 border-2 border-green-500/20 space-y-6 animate-fade-in-up">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xl font-black text-brand-primary">Verification Complete!</h3>
                                    <button onClick={resetForm} className="p-2 hover:bg-brand-accent/30 rounded-full transition-colors">
                                        <X size={20} className="text-brand-text/50" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-brand-accent/30 p-5 rounded-2xl text-center space-y-1">
                                        <div className="flex items-center justify-center text-green-600">
                                            <Leaf size={18} fill="currentColor" />
                                        </div>
                                        <p className="text-3xl font-black text-brand-primary">{result.healthScore}</p>
                                        <p className="text-[10px] font-bold text-brand-text/50 uppercase tracking-wider">Health Score</p>
                                    </div>
                                    <div className="bg-brand-accent/30 p-5 rounded-2xl text-center space-y-1">
                                        <div className="flex items-center justify-center text-yellow-600">
                                            <Star size={18} fill="currentColor" />
                                        </div>
                                        <p className="text-3xl font-black text-brand-primary">{result.nutritionScore}</p>
                                        <p className="text-[10px] font-bold text-brand-text/50 uppercase tracking-wider">Nutrition</p>
                                    </div>
                                    <div className="bg-brand-accent/30 p-5 rounded-2xl text-center space-y-1">
                                        <div className="flex items-center justify-center text-brand-primary">
                                            <Trophy size={18} fill="currentColor" />
                                        </div>
                                        <p className="text-3xl font-black text-brand-primary">+{result.pointsEarned}</p>
                                        <p className="text-[10px] font-bold text-brand-text/50 uppercase tracking-wider">XP Earned</p>
                                    </div>
                                    <div className="bg-brand-accent/30 p-5 rounded-2xl text-center space-y-1">
                                        <div className="flex items-center justify-center text-green-600">
                                            <Leaf size={18} fill="currentColor" />
                                        </div>
                                        <p className="text-3xl font-black text-brand-primary">{result.fruitVegGrams}g</p>
                                        <p className="text-[10px] font-bold text-brand-text/50 uppercase tracking-wider">Fruits & Veg</p>
                                    </div>
                                </div>

                                {result.badgeMinted && (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-center">
                                        <p className="text-lg font-black text-yellow-600">🏆 Badge Earned!</p>
                                        <p className="text-xs text-yellow-600/70">You've unlocked the Healthy Shopper badge</p>
                                    </div>
                                )}

                                <div className="text-xs text-brand-text/30 text-center break-all font-mono">
                                    TX: {result.txHash.slice(0, 10)}...{result.txHash.slice(-8)}
                                </div>

                                <div className="flex flex-col gap-2">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleShareWarpcast}
                                            className="flex-1 bg-purple-600 text-white py-3 px-4 rounded-xl font-bold text-sm hover:bg-purple-700 transition-all flex items-center justify-center gap-2"
                                        >
                                            Warpcast
                                        </button>
                                        <button
                                            onClick={handleShareTwitter}
                                            className="flex-1 bg-black text-white py-3 px-4 rounded-xl font-bold text-sm hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
                                        >
                                            Share to X
                                        </button>
                                    </div>
                                    <button
                                        onClick={resetForm}
                                        className="w-full bg-brand-accent text-brand-primary py-3 px-4 rounded-xl font-bold text-sm hover:bg-brand-accent/80 transition-all"
                                    >
                                        Verify Another
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-6 gradient-mesh">
                                <h3 className="text-lg font-black text-brand-primary">How Scoring Works</h3>
                                <div className="space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center text-green-600 shrink-0 mt-0.5">
                                            <Leaf size={16} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-brand-primary">Health Score</p>
                                            <p className="text-xs text-brand-text/50 leading-relaxed">
                                                Based on the ratio of healthy vs unhealthy items in your cart. More fruits, veggies, and whole grains = higher score.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center text-yellow-600 shrink-0 mt-0.5">
                                            <Star size={16} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-brand-primary">Nutrition Score</p>
                                            <p className="text-xs text-brand-text/50 leading-relaxed">
                                                Based on WHO's 300g/day fruit & veg recommendation. We check if you're buying enough for your household.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-brand-accent flex items-center justify-center text-brand-primary shrink-0 mt-0.5">
                                            <Trophy size={16} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-brand-primary">XP Points</p>
                                            <p className="text-xs text-brand-text/50 leading-relaxed">
                                                Earn up to 150 XP per receipt based on your scores, plus streak bonuses for consistent healthy shopping.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-brand-accent/50 p-4 rounded-2xl text-center">
                                    <p className="text-sm text-brand-text/50 italic font-medium">
                                        &ldquo;Eat healthier and more balanced with a {duration} day plan.&rdquo;
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Shell>

        {/* Upload Source Selection Modal */}
        {showUploadModal && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                {/* Backdrop */}
                <div 
                    className="absolute inset-0 bg-brand-text/40 backdrop-blur-md transition-opacity"
                    onClick={() => setShowUploadModal(false)}
                ></div>
                
                {/* Modal Content */}
                <div className="relative w-full sm:max-w-sm bg-white rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl border border-brand-accent/20 animate-in slide-in-from-bottom duration-300 z-10 space-y-4">
                    <div className="text-center pb-2">
                        <h3 className="text-lg font-black text-brand-primary">Select Receipt Source</h3>
                        <p className="text-xs text-brand-text/50">Choose how you want to upload your receipt</p>
                    </div>
                    
                    <div className="space-y-3">
                        <button
                            onClick={() => handleSelectOption("camera")}
                            type="button"
                            className="w-full py-4 px-6 bg-brand-primary text-white rounded-2xl font-bold text-base hover:bg-brand-secondary active:scale-98 transition-all flex items-center justify-center gap-3 shadow-lg shadow-brand-primary/10 cursor-pointer"
                        >
                            <Camera size={20} />
                            Take Photo (Camera)
                        </button>
                        
                        <button
                            onClick={() => handleSelectOption("gallery")}
                            type="button"
                            className="w-full py-4 px-6 bg-brand-accent text-brand-primary rounded-2xl font-bold text-base hover:bg-brand-accent/80 active:scale-98 transition-all flex items-center justify-center gap-3 border border-brand-accent/50 cursor-pointer"
                        >
                            <Image size={20} />
                            Choose from Gallery
                        </button>
                    </div>
                    
                    <button
                        onClick={() => setShowUploadModal(false)}
                        type="button"
                        className="w-full py-3 px-6 bg-transparent text-brand-text/40 hover:text-brand-text/60 font-bold text-sm transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        )}

        {/* Custom Camera Stream Overlay */}
        {isCameraActive && (
            <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between p-6">
                <div className="flex justify-between items-center text-white">
                    <h3 className="text-lg font-bold">Align Receipt</h3>
                    <button 
                        onClick={stopCamera}
                        type="button"
                        className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>
                
                <div className="relative flex-1 my-6 bg-zinc-900 rounded-3xl overflow-hidden flex items-center justify-center">
                    <video 
                        ref={videoRef}
                        autoPlay 
                        playsInline 
                        muted
                        className="w-full h-full object-cover"
                    />
                    {/* Overlay frame guide */}
                    <div className="absolute inset-8 border-2 border-dashed border-white/30 rounded-2xl pointer-events-none flex items-center justify-center">
                        <span className="text-white/50 text-xs font-medium uppercase tracking-wider bg-black/40 px-3 py-1.5 rounded-full text-center">
                            Place receipt inside frame
                        </span>
                    </div>
                </div>
                
                <div className="flex justify-center pb-4">
                    <button
                        onClick={capturePhoto}
                        type="button"
                        className="w-20 h-20 rounded-full bg-white p-1 border-4 border-zinc-800 active:scale-90 transition-transform shadow-2xl cursor-pointer"
                    >
                        <div className="w-full h-full rounded-full bg-brand-primary flex items-center justify-center text-white">
                            <Camera size={28} />
                        </div>
                    </button>
                </div>
            </div>
        )}
        </>
    );
}
