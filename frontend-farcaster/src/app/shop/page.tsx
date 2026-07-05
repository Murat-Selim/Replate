"use client";

import React, { useState, useRef, useEffect } from "react";
import Shell from "@/components/Shell";
import { Minus, Plus, Sparkles, Camera, Check, Loader2, X, Leaf, Star, Trophy, Image } from "lucide-react";
import { sdk } from "@farcaster/miniapp-sdk";
import { useFarcasterAccount } from "@/hooks/useFarcasterAccount";
import { getApiUrl } from "@/lib/api";
import { compressImage } from "@/lib/image";
import { useAccount } from "wagmi";
import { useSubmitReceipt } from "@/lib/useTransaction";

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
    const { submitReceipt } = useSubmitReceipt();
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

            // 1. Analyze receipt off-chain (no on-chain submission from relayer)
            const response = await fetch(getApiUrl("/api/verify-receipt"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    imageBase64: base64Data,
                    userAddress: targetAddress,
                    householdSize,
                    daysCovered: duration,
                    fid: userContext.fid,
                    onlyAnalyze: true,
                }),
            });

            const data = await response.json();

            if (!data.success || !data.data) {
                throw new Error(data.error || "Verification failed");
            }

            // 2. Direct on-chain receipt submission from user's wallet
            const txResult = await submitReceipt({
                totalItems: data.data.totalItems,
                healthyItems: data.data.healthyItems,
                unhealthyItems: data.data.unhealthyItems,
                fruitVegGrams: data.data.fruitVegGrams,
                householdSize,
                daysCovered: data.data.daysCovered,
            });

            if (!txResult.success) {
                throw new Error(txResult.error || "Transaction failed");
            }

            // 3. Show successful result with user's direct txHash
            setResult({
                ...data.data,
                txHash: txResult.txHash || "",
            });
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
                        <span className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-[#22D97A] font-heading">
                            Smart Verification
                        </span>
                        <h1 className="text-4xl font-black text-white font-heading uppercase tracking-wide">Shop & Verify</h1>
                        <p className="text-[#A6B0B5] text-sm">Upload receipt and earn rewards.</p>
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
                                <div className="absolute inset-0 bg-[#22D97A]/10 rounded-full blur-3xl group-hover:bg-[#22D97A]/25 transition-all"></div>
                                <div className="relative w-56 h-56 bg-[#131C20] rounded-full border-4 border-[#1E2A2F] flex flex-col items-center justify-center overflow-hidden transition-transform group-hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(34,217,122,0.1)]">
                                    {imagePreview ? (
                                        <div className="relative w-full h-full">
                                            <img
                                                src={imagePreview}
                                                alt="Receipt preview"
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute inset-0 bg-[#0B1114]/75 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="bg-brand-primary/20 backdrop-blur-md p-4 rounded-full border border-brand-primary/30">
                                                    <Camera size={32} className="text-[#22D97A]" />
                                                </div>
                                            </div>
                                            <div className="absolute top-4 right-4 bg-[#22D97A] text-[#0B1114] p-2 rounded-full shadow-lg">
                                                <Check size={20} strokeWidth={3} />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-20 h-20 bg-[#1E2A2F] border border-[#22D97A]/15 rounded-[24px] flex items-center justify-center text-[#22D97A] shadow-[0_0_20px_rgba(34,217,122,0.1)]">
                                                <Camera size={36} />
                                            </div>
                                            <span className="font-extrabold text-[#A6B0B5] uppercase tracking-widest text-[9px] font-heading">
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
                        <div className="space-y-5">
                            {/* Household Size */}
                            <div className="glass-card rounded-[32px] p-8 border border-[#22D97A]/10 space-y-4">
                                <h2 className="text-center text-xs font-black uppercase tracking-[0.2em] text-[#A6B0B5] font-heading">
                                    Household Size
                                </h2>
                                <div className="flex items-center justify-center gap-8">
                                    <button
                                        onClick={() => setHouseholdSize(Math.max(1, householdSize - 1))}
                                        className="w-12 h-12 rounded-full bg-[#1E2A2F] border border-[#22D97A]/25 text-[#22D97A] flex items-center justify-center active:scale-90 transition-transform shadow-md hover:bg-[#22D97A]/10 animate-all duration-200"
                                    >
                                        <Minus size={20} strokeWidth={3} />
                                    </button>
                                    <span className="text-6xl font-black text-white w-20 text-center font-heading">
                                        {householdSize}
                                    </span>
                                    <button
                                        onClick={() => setHouseholdSize(householdSize + 1)}
                                        className="w-12 h-12 rounded-full bg-[#1E2A2F] border border-[#22D97A]/25 text-[#22D97A] flex items-center justify-center active:scale-90 transition-transform shadow-md hover:bg-[#22D97A]/10 animate-all duration-200"
                                    >
                                        <Plus size={20} strokeWidth={3} />
                                    </button>
                                </div>
                            </div>

                            {/* Shopping Duration */}
                            <div className="glass-card rounded-[32px] p-8 border border-[#22D97A]/10 space-y-4">
                                <h2 className="text-center text-xs font-black uppercase tracking-[0.2em] text-[#A6B0B5] font-heading">
                                    Shopping Duration
                                </h2>
                                <div className="flex items-center justify-center gap-8">
                                    <button
                                        onClick={() => setDuration(Math.max(1, duration - 1))}
                                        className="w-12 h-12 rounded-full bg-[#1E2A2F] border border-[#22D97A]/25 text-[#22D97A] flex items-center justify-center active:scale-90 transition-transform shadow-md hover:bg-[#22D97A]/10 animate-all duration-200"
                                    >
                                        <Minus size={20} strokeWidth={3} />
                                    </button>
                                    <div className="flex items-baseline gap-2 w-32 justify-center">
                                        <span className="text-6xl font-black text-white font-heading">
                                            {duration}
                                        </span>
                                        <span className="text-[#A6B0B5] font-black uppercase tracking-wider text-xs">days</span>
                                    </div>
                                    <button
                                        onClick={() => setDuration(duration + 1)}
                                        className="w-12 h-12 rounded-full bg-[#1E2A2F] border border-[#22D97A]/25 text-[#22D97A] flex items-center justify-center active:scale-90 transition-transform shadow-md hover:bg-[#22D97A]/10 animate-all duration-200"
                                    >
                                        <Plus size={20} strokeWidth={3} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <button
                                onClick={handleVerify}
                                disabled={isLoading || isCompressing || !imagePreview}
                                className="w-full bg-[#22D97A] text-[#0B1114] py-5 px-8 rounded-full font-black text-lg uppercase tracking-wider flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_30px_rgba(34,217,122,0.4)] hover:shadow-[0_0_40px_rgba(34,217,122,0.6)] cursor-pointer"
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
                                <div className="bg-[#1E2A2F] border border-red-500/30 text-red-400 p-5 rounded-[22px] text-sm font-bold text-center">
                                    {error}
                                </div>
                            )}

                            {result && (
                                <div className="glass-card rounded-[32px] p-6 border border-[#22D97A]/20 space-y-5 animate-in fade-in duration-300">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-black text-[#22D97A] font-heading uppercase tracking-wide">Verification Complete!</h3>
                                        <button onClick={resetForm} className="p-2 hover:bg-[#1E2A2F] rounded-full transition-colors text-white">
                                            <X size={20} />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-[#131C20] border border-[#22D97A]/10 p-4 rounded-[22px] text-center">
                                            <div className="flex items-center justify-center gap-1 text-[#22D97A] mb-1">
                                                <Leaf size={16} fill="currentColor" />
                                            </div>
                                            <p className="text-2xl font-black text-white font-heading">{result.healthScore}</p>
                                            <p className="text-[9px] font-black text-[#A6B0B5] uppercase tracking-wider">Health Score</p>
                                        </div>
                                        <div className="bg-[#131C20] border border-[#22D97A]/10 p-4 rounded-[22px] text-center">
                                            <div className="flex items-center justify-center gap-1 text-[#22D97A] mb-1">
                                                <Star size={16} fill="currentColor" />
                                            </div>
                                            <p className="text-2xl font-black text-white font-heading">{result.nutritionScore}</p>
                                            <p className="text-[9px] font-black text-[#A6B0B5] uppercase tracking-wider">Nutrition</p>
                                        </div>
                                        <div className="bg-[#131C20] border border-[#22D97A]/10 p-4 rounded-[22px] text-center">
                                            <div className="flex items-center justify-center gap-1 text-[#22D97A] mb-1">
                                                <Trophy size={16} fill="currentColor" />
                                            </div>
                                            <p className="text-2xl font-black text-white font-heading">+{result.pointsEarned}</p>
                                            <p className="text-[9px] font-black text-[#A6B0B5] uppercase tracking-wider">XP Earned</p>
                                        </div>
                                        <div className="bg-[#131C20] border border-[#22D97A]/10 p-4 rounded-[22px] text-center">
                                            <div className="flex items-center justify-center gap-1 text-[#22D97A] mb-1">
                                                <Leaf size={16} fill="currentColor" />
                                            </div>
                                            <p className="text-2xl font-black text-white font-heading">{result.fruitVegGrams}g</p>
                                            <p className="text-[9px] font-black text-[#A6B0B5] uppercase tracking-wider">Fruits & Veg</p>
                                        </div>
                                    </div>

                                    {result.badgeMinted && (
                                        <div className="bg-[#22D97A]/10 border border-[#22D97A]/25 rounded-[22px] p-4 text-center">
                                            <p className="text-base font-extrabold text-[#22D97A] font-heading uppercase tracking-wide">🏆 Badge Earned!</p>
                                            <p className="text-xs text-[#A6B0B5] font-semibold mt-1">You've unlocked the Healthy Shopper badge</p>
                                        </div>
                                    )}

                                    <div className="text-[9px] text-[#A6B0B5]/50 text-center break-all font-mono">
                                        TX: {result.txHash}
                                    </div>

                                    <div className="flex gap-2 pt-2">
                                        <button
                                            onClick={handleShare}
                                            className="flex-1 bg-[#1DA1F2] text-white py-3.5 px-4 rounded-xl font-bold text-xs hover:bg-[#1a9ed8] transition-all flex items-center justify-center gap-2"
                                        >
                                            Share Result
                                        </button>
                                        <button
                                            onClick={resetForm}
                                            className="flex-1 bg-[#1E2A2F] border border-[#22D97A]/20 text-[#22D97A] py-3.5 px-4 rounded-xl font-bold text-xs hover:bg-[#22D97A]/10 transition-all"
                                        >
                                            Verify Another
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="bg-[#131C20]/50 border border-[#22D97A]/5 p-5 rounded-[24px] text-center">
                                <p className="text-xs text-[#A6B0B5] italic font-medium leading-relaxed">
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
                        className="absolute inset-0 bg-[#0B1114]/80 backdrop-blur-sm transition-opacity"
                        onClick={() => setShowUploadModal(false)}
                    ></div>
                    
                    {/* Modal Content */}
                    <div className="relative w-full sm:max-w-sm bg-[#131C20] border border-[#22D97A]/15 rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom duration-300 z-10 space-y-5">
                        <div className="text-center pb-2">
                            <h3 className="text-lg font-black text-white font-heading uppercase tracking-wide">Select Receipt Source</h3>
                            <p className="text-xs text-[#A6B0B5]">Choose how you want to upload your receipt</p>
                        </div>
                        
                        <div className="space-y-3">
                            <button
                                onClick={() => handleSelectOption("camera")}
                                type="button"
                                className="w-full py-4 px-6 bg-[#22D97A] text-[#0B1114] rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-3 shadow-lg shadow-brand-primary/10 cursor-pointer transition-all active:scale-98"
                            >
                                <Camera size={18} strokeWidth={3} />
                                Take Photo (Camera)
                            </button>
                            
                            <button
                                onClick={() => handleSelectOption("gallery")}
                                type="button"
                                className="w-full py-4 px-6 bg-[#1E2A2F] border border-[#22D97A]/25 text-[#22D97A] rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-3 cursor-pointer transition-all hover:bg-[#22D97A]/10 active:scale-98"
                            >
                                <Image size={18} />
                                Choose from Gallery
                            </button>
                        </div>
                        
                        <button
                            onClick={() => setShowUploadModal(false)}
                            type="button"
                            className="w-full py-3 px-6 bg-transparent text-[#A6B0B5] hover:text-white font-black text-xs uppercase tracking-widest transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Custom Camera Stream Overlay */}
            {isCameraActive && (
                <div className="fixed inset-0 z-50 bg-[#0B1114] flex flex-col justify-between p-6">
                    <div className="flex justify-between items-center text-white">
                        <h3 className="text-lg font-black font-heading uppercase tracking-wide">Align Receipt</h3>
                        <button 
                            onClick={stopCamera}
                            type="button"
                            className="p-2.5 bg-[#1E2A2F] border border-white/10 rounded-full hover:bg-white/10 transition-colors cursor-pointer text-white"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    
                    <div className="relative flex-1 my-6 bg-[#131C20] rounded-3xl overflow-hidden flex items-center justify-center border border-[#22D97A]/10 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
                        <video 
                            ref={videoRef}
                            autoPlay 
                            playsInline 
                            muted
                            className="w-full h-full object-cover"
                        />
                        {/* Overlay frame guide */}
                        <div className="absolute inset-8 border-2 border-dashed border-[#22D97A]/30 rounded-2xl pointer-events-none flex items-center justify-center">
                            <span className="text-white text-[10px] font-black uppercase tracking-widest bg-[#0B1114]/80 border border-[#22D97A]/10 px-4 py-2 rounded-full text-center">
                                Place receipt inside frame
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex justify-center pb-4">
                        <button
                            onClick={capturePhoto}
                            type="button"
                            className="w-20 h-20 rounded-full bg-white p-1 border-4 border-[#1E2A2F] active:scale-90 transition-transform shadow-2xl cursor-pointer"
                        >
                            <div className="w-full h-full rounded-full bg-[#22D97A] flex items-center justify-center text-[#0B1114]">
                                <Camera size={28} strokeWidth={2.5} />
                            </div>
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
