"use client";

import React, { useState, useRef, useEffect } from "react";
import Shell from "@/components/Shell";
import { Minus, Plus, Sparkles, Camera, Check, Loader2, X, Leaf, Star, Trophy, Image } from "lucide-react";
import { sdk } from "@farcaster/miniapp-sdk";
import { useFarcasterAccount } from "@/hooks/useFarcasterAccount";
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

interface UserContext {
    address?: string;
    fid?: number;
    username?: string;
}

export default function SmartShop() {
    const { address } = useFarcasterAccount();
    const [userContext, setUserContext] = useState<UserContext>({});
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


    useEffect(() => {
        const fetchContext = async () => {
            try {
                const context = await sdk.context;
                if (context?.user) {
                    setUserContext({
                        address,
                        fid: context.user.fid,
                        username: context.user.username,
                    });
                }
            } catch (err) {
                console.log("Not running in MiniApp context");
            }
        };
        fetchContext();
    }, [address]);

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
            
            // Request permissions via Farcaster SDK first if available
            try {
                if (typeof window !== "undefined" && sdk?.actions?.requestCameraAndMicrophoneAccess) {
                    await sdk.actions.requestCameraAndMicrophoneAccess();
                }
            } catch (sdkErr) {
                console.warn("Farcaster SDK camera request failed/unsupported", sdkErr);
            }

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
        const targetAddress = address || userContext.address;

        if (!imagePreview || !targetAddress) {
            setError("Please upload a receipt and ensure you're connected");
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
                    userAddress: targetAddress,
                    householdSize,
                    daysCovered: duration,
                    fid: userContext.fid,
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

    const handleShare = async () => {
        if (!result) return;

        try {
            await sdk.actions.composeCast({
                text: `🎉 I just verified my grocery receipt on Replate! 

🥗 Health Score: ${result.healthScore}/100
🌿 Nutrition Score: ${result.nutritionScore}/100
⭐ Earned ${result.pointsEarned} XP

Join me in reducing food waste!`,
                embeds: ["https://replate.app"],
            });
        } catch (err) {
            console.log("Share cancelled or failed");
        }
    };

    const resetForm = () => {
        setImagePreview(null);
        setResult(null);
        setError(null);
    };

    return (
        <>
            <Shell>
                <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {/* Combined Header Area */}
                    <div className="text-center space-y-2">
                        <h1 className="text-4xl font-black text-brand-primary">Shop & Verify</h1>
                        <p className="text-brand-text/60">Upload receipt and earn rewards.</p>
                    </div>

                    {/* Section 1: Verify (Top) */}
                    <div className="space-y-6">
                        <div className="flex flex-col items-center justify-center pt-4">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept="image/*"
                                className="hidden"
                            />
                            <div 
                                onClick={() => setShowUploadModal(true)}
                                className="relative group cursor-pointer"
                            >
                                <div className="absolute inset-0 bg-brand-primary/5 rounded-full blur-3xl group-hover:bg-brand-primary/10 transition-colors"></div>
                                <div className="relative w-56 h-56 bg-white rounded-full shadow-xl border-4 border-white flex flex-col items-center justify-center overflow-hidden transition-transform group-hover:scale-105 active:scale-95">
                                    {imagePreview ? (
                                        <div className="relative w-full h-full">
                                            <img
                                                src={imagePreview}
                                                alt="Receipt preview"
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute inset-0 bg-brand-primary/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="bg-white/20 backdrop-blur-md p-4 rounded-full border border-white/30">
                                                    <Camera size={32} className="text-white" />
                                                </div>
                                            </div>
                                            <div className="absolute top-4 right-4 bg-green-500 text-white p-2 rounded-full shadow-lg">
                                                <Check size={20} />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-20 h-20 bg-brand-accent/50 rounded-[24px] flex items-center justify-center text-brand-primary">
                                                <Camera size={40} />
                                            </div>
                                            <span className="font-bold text-brand-text/40 uppercase tracking-widest text-[10px]">
                                                Tap to take photo
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                {/* Section 2: Smart Shop Controls */}
                <div className="space-y-8">
                    <div className="space-y-6">
                        {/* Household Size */}
                        <div className="bg-white rounded-[32px] p-8 shadow-sm border border-brand-accent/20 space-y-4">
                            <h2 className="text-center text-xs font-black uppercase tracking-[0.2em] text-brand-text/30">
                                Household Size
                            </h2>
                            <div className="flex items-center justify-center gap-8">
                                <button
                                    onClick={() => setHouseholdSize(Math.max(1, householdSize - 1))}
                                    className="w-12 h-12 rounded-full bg-brand-primary text-white flex items-center justify-center active:scale-90 transition-transform shadow-lg shadow-brand-primary/20"
                                >
                                    <Minus size={24} />
                                </button>
                                <span className="text-6xl font-black text-brand-primary w-20 text-center">
                                    {householdSize}
                                </span>
                                <button
                                    onClick={() => setHouseholdSize(householdSize + 1)}
                                    className="w-12 h-12 rounded-full bg-brand-primary text-white flex items-center justify-center active:scale-90 transition-transform shadow-lg shadow-brand-primary/20"
                                >
                                    <Plus size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Shopping Duration */}
                        <div className="bg-white rounded-[32px] p-8 shadow-sm border border-brand-accent/20 space-y-4">
                            <h2 className="text-center text-xs font-black uppercase tracking-[0.2em] text-brand-text/30">
                                Shopping Duration
                            </h2>
                            <div className="flex items-center justify-center gap-8">
                                <button
                                    onClick={() => setDuration(Math.max(1, duration - 1))}
                                    className="w-12 h-12 rounded-full bg-brand-primary text-white flex items-center justify-center active:scale-90 transition-transform shadow-lg shadow-brand-primary/20"
                                >
                                    <Minus size={24} />
                                </button>
                                <div className="flex items-baseline gap-2 w-32 justify-center">
                                    <span className="text-6xl font-black text-brand-primary">
                                        {duration}
                                    </span>
                                    <span className="text-brand-text/30 font-bold">days</span>
                                </div>
                                <button
                                    onClick={() => setDuration(duration + 1)}
                                    className="w-12 h-12 rounded-full bg-brand-primary text-white flex items-center justify-center active:scale-90 transition-transform shadow-lg shadow-brand-primary/20"
                                >
                                    <Plus size={24} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <button
                            onClick={handleVerify}
                            disabled={isLoading || isCompressing || !imagePreview}
                            className="w-full bg-brand-primary text-white py-5 px-8 rounded-3xl font-black text-xl shadow-xl shadow-brand-primary/20 hover:bg-brand-secondary transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 size={24} className="animate-spin" />
                                    Verifying...
                                </>
                            ) : isCompressing ? (
                                <>
                                    <Loader2 size={24} className="animate-spin" />
                                    Compressing...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={24} />
                                    Verify & Earn
                                </>
                            )}
                        </button>

                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-2xl text-sm font-medium">
                                {error}
                            </div>
                        )}

                        {result && (
                            <div className="bg-white rounded-[32px] p-6 shadow-xl border-2 border-green-500/30 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-black text-brand-primary">Verification Complete!</h3>
                                    <button onClick={resetForm} className="p-2 hover:bg-brand-accent/20 rounded-full">
                                        <X size={20} className="text-brand-text/50" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-brand-accent/30 p-4 rounded-2xl text-center">
                                        <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                                            <Leaf size={16} fill="currentColor" />
                                        </div>
                                        <p className="text-2xl font-black text-brand-primary">{result.healthScore}</p>
                                        <p className="text-[10px] font-bold text-brand-text/50 uppercase">Health Score</p>
                                    </div>
                                    <div className="bg-brand-accent/30 p-4 rounded-2xl text-center">
                                        <div className="flex items-center justify-center gap-1 text-yellow-600 mb-1">
                                            <Star size={16} fill="currentColor" />
                                        </div>
                                        <p className="text-2xl font-black text-brand-primary">{result.nutritionScore}</p>
                                        <p className="text-[10px] font-bold text-brand-text/50 uppercase">Nutrition</p>
                                    </div>
                                    <div className="bg-brand-accent/30 p-4 rounded-2xl text-center">
                                        <div className="flex items-center justify-center gap-1 text-brand-primary mb-1">
                                            <Trophy size={16} fill="currentColor" />
                                        </div>
                                        <p className="text-2xl font-black text-brand-primary">+{result.pointsEarned}</p>
                                        <p className="text-[10px] font-bold text-brand-text/50 uppercase">XP Earned</p>
                                    </div>
                                    <div className="bg-brand-accent/30 p-4 rounded-2xl text-center">
                                        <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                                            <Leaf size={16} fill="currentColor" />
                                        </div>
                                        <p className="text-2xl font-black text-brand-primary">{result.fruitVegGrams}g</p>
                                        <p className="text-[10px] font-bold text-brand-text/50 uppercase">Fruits & Veg</p>
                                    </div>
                                </div>

                                {result.badgeMinted && (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-center">
                                        <p className="text-lg font-black text-yellow-600">🏆 Badge Earned!</p>
                                        <p className="text-xs text-yellow-600/70">You've unlocked the Healthy Shopper badge</p>
                                    </div>
                                )}

                                <div className="text-xs text-brand-text/40 text-center break-all">
                                    TX: {result.txHash.slice(0, 10)}...{result.txHash.slice(-8)}
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <button
                                        onClick={handleShare}
                                        className="flex-1 bg-[#1DA1F2] text-white py-3 px-4 rounded-2xl font-bold text-sm hover:bg-[#1a9ed8] transition-all flex items-center justify-center gap-2"
                                    >
                                        Share Result
                                    </button>
                                    <button
                                        onClick={resetForm}
                                        className="flex-1 bg-brand-accent text-brand-primary py-3 px-4 rounded-2xl font-bold text-sm hover:bg-brand-accent/80 transition-all"
                                    >
                                        Verify Another
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="bg-brand-accent/40 p-5 rounded-[24px] border border-brand-accent/50 text-center">
                            <p className="text-sm text-brand-text/50 italic font-medium">
                                "Eat healthier and more balanced with a {duration} day plan."
                            </p>
                        </div>
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
