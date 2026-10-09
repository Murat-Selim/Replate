"use client";

import React, { useEffect, useState, useRef } from "react";
import Shell from "@/components/Shell";
import { Minus, Plus, Sparkles, Camera, Check, Loader2, X, Leaf, Star, Trophy, Image, ChevronDown } from "lucide-react";
import { useAccount, useConnect, useWalletClient } from "wagmi";
import { appChain } from "@/lib/network";
import { getApiUrl, getConfiguredApiUrl } from "@/lib/api";
import { compressImage } from "@/lib/image";
import { analyzeReceiptForVerification, getPendingReceiptAnalysis, clearPendingReceiptAnalysis } from "@/lib/receipt-analysis";
import { useSubmitReceipt } from "@/lib/useTransaction";
import { track } from "@vercel/analytics";
import {
    unlockAdvancedIntelligence,
    fetchBehaviorIntelligence,
    fetchBasketIntelligence,
    fetchSpendingBreakdown,
    fetchReceiptProductPrices,
    fetchReceiptSpendingBreakdown,
    type AdvancedReport,
    type BehaviorIntelligence,
    type BasketIntelligence,
    type SpendingBreakdown,
    type ReceiptProductPrices,
    type ReceiptSpendingBreakdown,
} from "@/lib/intelligence";

interface VerificationResult {
    receiptId: string;
    txHash: string;
    receiptHash: `0x${string}`;
    receiptDate?: string;
    healthScore: number;
    nutritionScore: number;
    totalItems: number;
    healthyItems: number;
    unhealthyItems: number;
    fruitVegGrams: number;
    daysCovered: number;
    pointsEarned: number;
    badgeMinted: boolean;
    storeName?: string | null;
    currencyCode?: string | null;
    totalSpent?: number | null;
    totalSpentSource?: "receipt_total" | "line_items" | null;
    expectedItemsTotal?: number | null;
    products?: { name: string; category: string; spendingCategory?: string; fruitVegGrams: number; paidPrice?: number; quantity?: number; actualWeightGrams?: number; canonicalProductId?: string | null; priceUnit?: string }[];
}

function drawReceiptHuntText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
    const lines: string[] = [];
    let line = "";
    for (const word of text.trim().split(/\s+/)) {
        const candidate = line ? line + " " + word : word;
        if (line && ctx.measureText(candidate).width > maxWidth) {
            lines.push(line);
            line = word;
            if (lines.length === maxLines) break;
        } else {
            line = candidate;
        }
    }
    if (line && lines.length < maxLines) lines.push(line);
    lines.forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight, maxWidth));
}

function drawReceiptHuntCard(canvas: HTMLCanvasElement, result: VerificationResult, insight: string, spending: ReceiptSpendingBreakdown) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = 1080;
    canvas.height = 1350;
    const background = ctx.createLinearGradient(0, 0, 1080, 1350);
    background.addColorStop(0, "#10251A");
    background.addColorStop(1, "#050806");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 1080, 1350);
    ctx.strokeStyle = "rgba(0,227,110,0.38)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(32, 32, 1016, 1286, 40);
    ctx.stroke();

    ctx.fillStyle = "#00E36E";
    ctx.font = "900 34px Arial";
    ctx.fillText("REPLATE", 76, 106);
    ctx.font = "700 25px Arial";
    ctx.fillText("RECEIPT HUNT #01", 76, 166);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 56px Arial";
    drawReceiptHuntText(ctx, "Which category did you spend more on than you expected?", 76, 252, 900, 68, 2);

    const topCategory = spending.categories[0];
    ctx.fillStyle = "#00E36E";
    ctx.font = "900 22px Arial";
    ctx.fillText("TOP SPENDING CATEGORY", 76, 390);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "700 30px Arial";
    drawReceiptHuntText(ctx, topCategory ? `${topCategory.category} · ${formatSpendingAmount(topCategory.amount, spending.currencyCode)} · ${(topCategory.share * 100).toFixed(1)}%` : "No priced categories found", 76, 434, 900, 40, 1);

    const stats = [
        ["HEALTH SCORE", String(result.healthScore)],
        ["NUTRITION", String(result.nutritionScore)],
        ["FRUITS & VEG", String(result.fruitVegGrams) + "g"],
        ["RP EARNED", "+" + String(result.pointsEarned)],
    ];
    stats.forEach(([label, value], index) => {
        const x = 76 + index * 237;
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.beginPath();
        ctx.roundRect(x, 470, 218, 220, 24);
        ctx.fill();
        ctx.fillStyle = "#00E36E";
        ctx.font = "900 20px Arial";
        ctx.fillText(label, x + 18, 514, 182);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "900 58px Arial";
        ctx.fillText(value, x + 18, 604, 182);
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.font = "600 20px Arial";
        if (index < 2) ctx.fillText("/ 100", x + 18, 650);
    });

    ctx.fillStyle = "#00E36E";
    ctx.font = "900 24px Arial";
    ctx.fillText("MY SURPRISING FIND", 76, 800);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "700 42px Arial";
    drawReceiptHuntText(ctx, insight.trim() || "Add your observation to complete this card.", 76, 872, 900, 58, 4);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.moveTo(76, 1160);
    ctx.lineTo(1004, 1160);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = "700 22px Arial";
    ctx.fillText("MY RECEIPT STAYS PRIVATE", 76, 1214);
    ctx.fillStyle = "rgba(255,255,255,0.42)";
    ctx.font = "500 20px Arial";
    ctx.fillText("Share what it revealed · #ReceiptHunt", 76, 1260);
}

const spendingCategoryColors: Record<string, string> = {
    meat: "#F97316",
    other: "#94A3B8",
    produce: "#22C55E",
    dairy: "#38BDF8",
    bakery: "#F59E0B",
    snacks: "#E879F9",
    drinks: "#06B6D4",
    household: "#A78BFA",
    frozen: "#EF4444",
    pantry: "#A3E635",
};

function formatSpendingAmount(amount: number, currencyCode: string | null) {
    const value = Number.isFinite(amount) ? amount : 0;
    try {
        if (currencyCode) return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode }).format(value);
    } catch { /* Fall back for missing or invalid currency codes. */ }
    return `${currencyCode ? `${currencyCode} ` : ""}${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
}

function getReceiptChatReply(question: string, result: VerificationResult, advancedReport: AdvancedReport | null) {
    const q = question.toLocaleLowerCase();
    const recommendations = advancedReport
        ? [...advancedReport.insights, ...advancedReport.recommendations].map((item) => item.message)
        : [];

    if (/(improve|increase|better|artır|geliştir|recommend|öner)/.test(q)) {
        return recommendations[0] || (result.healthyItems < result.totalItems
            ? `Try replacing one of the ${result.unhealthyItems} less-balanced items with a minimally processed option.`
            : "Add more fruit and vegetables to improve your nutrition balance.");
    }
    if (/(nutrition|beslen|meyve|sebze|fruit|vegetable)/.test(q)) {
        return `Your Nutrition Score is ${result.nutritionScore}/100, with ${result.fruitVegGrams}g of fruit and vegetables detected.`;
    }
    if (/(health|score|skor|puan)/.test(q)) {
        return `Your Health Score is ${result.healthScore}/100 and your Nutrition Score is ${result.nutritionScore}/100. You earned ${result.pointsEarned} RP.`;
    }
    if (/(product|item|ürün|basket|sepet)/.test(q)) {
        const products = result.products?.filter((product) => product.category !== "excluded") || [];
        const names = products.slice(0, 3).map((product) => product.name).join(", ");
        return `${result.totalItems} items were counted: ${result.healthyItems} healthy and ${result.unhealthyItems} less-balanced. ${names ? `Examples: ${names}.` : ""}`;
    }
    return "Ask about your scores, nutrition balance, basket items, or how to improve your next shop.";
}

function getBasketFeedback(result: VerificationResult) {
    const positive = result.healthyItems > result.unhealthyItems
        ? `${result.healthyItems} of ${result.totalItems} detected items support a more balanced basket.`
        : result.fruitVegGrams > 0
            ? `Your receipt includes about ${result.fruitVegGrams}g of fruit and vegetables.`
            : "You have created a clear baseline for improving your next grocery basket.";

    const improvement = result.unhealthyItems > 0
        ? `Next time, try replacing one of the ${result.unhealthyItems} less-balanced items with a minimally processed option.`
        : result.fruitVegGrams < 400
            ? "Next time, consider adding another fruit or vegetable option for more variety."
            : "Keep the mix varied by rotating fruit, vegetables, and whole-food staples.";

    return { positive, improvement };
}

function getIntelligenceTier(receiptCount: number) {
    if (receiptCount >= 30) return { label: "Richer Replate Intelligence", detail: "Your 30-day history makes the $0.10 USDC report more personalized." };
    if (receiptCount >= 10) return { label: "Behavior pattern + recommendation", detail: `${30 - receiptCount} more verified receipts unlock richer Replate Intelligence.` };
    if (receiptCount >= 5) return { label: "30-day pattern analysis", detail: `${10 - receiptCount} more verified receipts unlock behavior patterns and recommendations.` };
    if (receiptCount >= 3) return { label: "Richer comparison", detail: `${5 - receiptCount} more verified receipts unlock 30-day pattern analysis.` };
    if (receiptCount >= 1) return { label: "Basic insight", detail: `${3 - receiptCount} more verified receipts unlock richer comparison.` };
    return { label: "Start your Replate Intelligence", detail: "Verify 1 receipt to unlock your first basic insight." };
}

export default function SmartShop() {
    const { address } = useAccount();
    const { connectAsync, connectors } = useConnect();
    const { data: walletClient } = useWalletClient({ chainId: appChain.id });
    const { submitReceipt } = useSubmitReceipt();
    const [householdSize, setHouseholdSize] = useState(2);
    const [duration, setDuration] = useState(7);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [pendingAnalysis, setPendingAnalysis] = useState(false);
    const [isReadingReceipt, setIsReadingReceipt] = useState(false);
    const verificationController = useRef<AbortController | null>(null);
    useEffect(() => {
        verificationController.current?.abort();
        setPendingAnalysis(Boolean(getPendingReceiptAnalysis(address)));
        return () => { verificationController.current?.abort(); };
    }, [address]);
    const [isCompressing, setIsCompressing] = useState(false);
    const [result, setResult] = useState<VerificationResult | null>(null);
    const [receiptHuntEntry, setReceiptHuntEntry] = useState(false);
    const [huntInsight, setHuntInsight] = useState("");
    const [huntNotice, setHuntNotice] = useState("");
    const [receiptHuntSpending, setReceiptHuntSpending] = useState<ReceiptSpendingBreakdown | null>(null);
    const [advancedReport, setAdvancedReport] = useState<AdvancedReport | null>(null);
    const [behaviorIntelligence, setBehaviorIntelligence] = useState<BehaviorIntelligence | null>(null);
    const [basketIntelligence, setBasketIntelligence] = useState<BasketIntelligence | null>(null);
    const [spendingBreakdown, setSpendingBreakdown] = useState<SpendingBreakdown | null>(null);
    const [receiptProductPrices, setReceiptProductPrices] = useState<ReceiptProductPrices | null>(null);
    const [chatQuestion, setChatQuestion] = useState("");
    const [chatAnswer, setChatAnswer] = useState<string | null>(null);
    const [activeIntelligenceCall, setActiveIntelligenceCall] = useState<string | null>(null);
    const [isUnlocking, setIsUnlocking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const [verifiedReceiptCount, setVerifiedReceiptCount] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const receiptHuntCanvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        setReceiptHuntEntry(new URLSearchParams(window.location.search).get("challenge") === "receipt-hunt-01");
    }, []);

    useEffect(() => {
        if (receiptHuntEntry && result && receiptHuntSpending && receiptHuntCanvasRef.current) {
            drawReceiptHuntCard(receiptHuntCanvasRef.current, result, huntInsight, receiptHuntSpending);
        }
    }, [receiptHuntEntry, result, huntInsight, receiptHuntSpending]);

    useEffect(() => {
        if (!address) {
            setVerifiedReceiptCount(0);
            return;
        }
        let cancelled = false;
        fetch(getApiUrl(`/api/user/${address}`))
            .then((response) => response.json())
            .then((data) => {
                if (!cancelled && data.success) setVerifiedReceiptCount(Number(data.data?.receiptCount || 0));
            })
            .catch(() => undefined);
        return () => { cancelled = true; };
    }, [address]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            verificationController.current?.abort();
            clearPendingReceiptAnalysis(address);
            setPendingAnalysis(false);
            setIsCompressing(true);
            setError(null);
            try {
                const compressed = await compressImage(file, 2000, 3000, 0.8, 700000);
                setImagePreview(compressed);
            } catch (err) {
                setImagePreview(null);
                setError(err instanceof Error ? err.message : "Receipt photo could not be prepared.");
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
        verificationController.current?.abort();
        clearPendingReceiptAnalysis(address);
        setPendingAnalysis(false);
        setIsCompressing(true);
        setError(null);
        try {
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            const file = new File([blob], "captured-receipt.jpg", { type: "image/jpeg" });
            const compressed = await compressImage(file, 2000, 3000, 0.8, 700000);
            setImagePreview(compressed);
        } catch (err) {
            setImagePreview(null);
            setError(err instanceof Error ? err.message : "Receipt photo could not be prepared.");
        } finally {
            setIsCompressing(false);
        }
    };

    const handleVerify = async () => {
        if (!imagePreview && !pendingAnalysis) {
            setError("Please upload a receipt first.");
            return;
        }

        if (!address) {
            const connector = connectors.find((item) => item.id === "baseAccount") || connectors[0];
            if (!connector) {
                setError("No compatible wallet was found.");
                return;
            }
            try {
                setError(null);
                await connectAsync({ connector });
                setError("Wallet connected. Click Analyze & Verify again to continue.");
            } catch (connectError) {
                setError(connectError instanceof Error ? connectError.message : "Wallet connection failed.");
            }
            return;
        }

        const controller = new AbortController();
        verificationController.current = controller;
        setIsLoading(true);
        setIsReadingReceipt(true);
        setError(null);
        setResult(null);
        setAdvancedReport(null);
        setBehaviorIntelligence(null);
        setBasketIntelligence(null);
        setSpendingBreakdown(null);
        setReceiptProductPrices(null);
        setReceiptHuntSpending(null);

        try {
            const analysis = await analyzeReceiptForVerification<VerificationResult & { householdSize: number }>({
                imageBase64: imagePreview?.split(",")[1] || imagePreview || undefined,
                userAddress: address,
                householdSize,
                daysCovered: duration,
            }, setPendingAnalysis, controller.signal);
            controller.signal.throwIfAborted();
            const data = { data: analysis };
            setIsReadingReceipt(false);

            // 2. Direct on-chain receipt submission from user's wallet
            const txResult = await submitReceipt({
                receiptHash: data.data.receiptHash as `0x${string}`,
                totalItems: data.data.totalItems,
                healthyItems: data.data.healthyItems,
                unhealthyItems: data.data.unhealthyItems,
                fruitVegGrams: data.data.fruitVegGrams,
                householdSize: data.data.householdSize ?? householdSize,
                daysCovered: data.data.daysCovered,
            });

            if (!txResult.success) {
                throw new Error(txResult.error || "Transaction failed");
            }

            const confirmedResponse = await fetch(getApiUrl("/api/receipts/confirmed"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    txHash: txResult.txHash,
                    userAddress: address,
                    receiptHash: data.data.receiptHash,
                    receiptDate: data.data.receiptDate,
                }),
            });
            const confirmedData = await confirmedResponse.json();
            if (!confirmedResponse.ok || !confirmedData.success) {
                throw new Error(confirmedData.error || "Verified receipt could not be saved");
            }

            clearPendingReceiptAnalysis(address);
            setPendingAnalysis(false);
            // 4. Show successful result with user's direct txHash
            setResult({
                ...data.data,
                products: (data.data.products as VerificationResult["products"])?.map((product, index) => ({ ...product, ...(confirmedData.productRefs?.[index] || {}) })),
                receiptId: String(confirmedData.data?.receiptId ?? confirmedData.receiptId),
                txHash: txResult.txHash || "",
            });
            track("receipt_verification_completed", { health_score: Number(data.data.healthScore) });
            setVerifiedReceiptCount((count) => count + 1);
        } catch (err) {
            if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            if (verificationController.current === controller) {
                verificationController.current = null;
                setIsLoading(false);
                setIsReadingReceipt(false);
            }
        }
    };

    const handleUnlockAdvanced = async () => {
        if (!result || !address || !walletClient) {
            setError("Connect a Base wallet to unlock Advanced Intelligence");
            return;
        }
        setIsUnlocking(true);
        setError(null);
        try {
            const report = await unlockAdvancedIntelligence(walletClient, {
                receiptId: result.receiptId,
                receiptHash: result.receiptHash,
                userAddress: address,
            });
            setAdvancedReport(report);
            track("x402_advanced_insight_unlocked");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Replate Intelligence could not be unlocked");
        } finally {
            setIsUnlocking(false);
        }
    };

    const handleReceiptChat = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!result || !chatQuestion.trim()) return;
        setChatAnswer(getReceiptChatReply(chatQuestion, result, advancedReport));
    };

    const runIntelligenceCall = async (callId: string, request: () => Promise<void>) => {
        if (!walletClient) {
            setError("Connect a Base wallet to call Replate Intelligence");
            return;
        }
        setActiveIntelligenceCall(callId);
        setError(null);
        try {
            await request();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Replate Intelligence call failed");
        } finally {
            setActiveIntelligenceCall(null);
        }
    };

    const handleCallBehavior = () => runIntelligenceCall("behavior", async () => {
        setBehaviorIntelligence(await fetchBehaviorIntelligence(walletClient!));
    });

    const handleCallSpending = () => runIntelligenceCall("spending", async () => {
        setSpendingBreakdown(await fetchSpendingBreakdown(walletClient!));
    });

    const handleCallBasket = () => {
        if (!result) return Promise.resolve();
        return runIntelligenceCall("basket", async () => setBasketIntelligence(await fetchBasketIntelligence(walletClient!, result.receiptId)));
    };

    const handleCallProductPrice = () => {
        if (!result) return Promise.resolve();
        return runIntelligenceCall("product-price", async () => setReceiptProductPrices(await fetchReceiptProductPrices(walletClient!, result.receiptId)));
    };

    const handleReceiptHuntAnalysis = () => {
        if (!result) return Promise.resolve();
        const itemizedTotal = result.products?.reduce((sum, product) => sum + (product.paidPrice ?? 0), 0) ?? 0;
        const pricedCount = result.products?.filter((product) => typeof product.paidPrice === "number").length ?? 0;
        const totalCount = result.products?.length || result.totalItems;
        if (result.totalSpentSource !== "receipt_total" || !result.totalSpent || result.totalSpent <= 0) {
            setHuntNotice("The printed receipt total could not be read. This receipt must be reprocessed before the paid analysis. No payment was made.");
            return Promise.resolve();
        }
        const totalMismatch = Math.abs(Math.round(itemizedTotal * 100) - Math.round((result.expectedItemsTotal ?? result.totalSpent) * 100)) > 1;
        const missingPrices = pricedCount !== totalCount;
        if (totalMismatch || missingPrices) {
            const mismatch = Math.round(Math.abs(itemizedTotal / result.totalSpent - 1) * 100);
            setHuntNotice(missingPrices
                ? `Prices were recognized for only ${pricedCount} of ${totalCount} detected line items. This receipt must be reprocessed before the paid analysis. No payment was made.`
                : `Recognized item prices differ from the printed total by ${mismatch}%. This receipt must be reprocessed before the paid analysis. No payment was made.`);
            return Promise.resolve();
        }
        setHuntNotice("");
        return runIntelligenceCall("receipt-hunt-spending", async () => setReceiptHuntSpending(await fetchReceiptSpendingBreakdown(walletClient!, result.receiptId)));
    };

    const handleShareWarpcast = () => {
        if (!result) return;
        track("receipt_result_shared", { channel: "farcaster" });
        const shareText = `Just verified my grocery run on Replate\n\nHealth Score: ${result.healthScore}/100\nEarned: ${result.pointsEarned} RP\n\nShop smart. Nourish well. Earn onchain.`;
        window.open(`https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}`, '_blank');
    };

    const handleShareTwitter = () => {
        if (!result) return;
        track("receipt_result_shared", { channel: "x" });
        const shareText = `🎉 I just verified my grocery receipt on @replateapp, built on @base!\n\n🥗 Health Score: ${result.healthScore}/100\n🌿 Nutrition Score: ${result.nutritionScore}/100\n⭐ Earned: ${result.pointsEarned} RP\n🥕 Fruits & Veg: ${result.fruitVegGrams}g\n\nTurn everyday food choices into simple, useful insights.\n\nhttps://replate-webapp.vercel.app`;
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank');
    };

    const handleDownloadReceiptHuntCard = () => {
        if (!result || !receiptHuntSpending || !huntInsight.trim() || !receiptHuntCanvasRef.current) return;
        const link = document.createElement("a");
        link.download = "replate-receipt-hunt-01.png";
        link.href = receiptHuntCanvasRef.current.toDataURL("image/png");
        link.click();
        track("receipt_hunt_card_downloaded", { challenge: "receipt-hunt-01" });
        setHuntNotice("Attach the downloaded card to your post. Publish it with #ReceiptHunt and tag @replateapp to enter.");
    };

    const handleShareReceiptHunt = (channel: "x" | "farcaster") => {
        if (!result || !receiptHuntSpending || !huntInsight.trim()) return;
        handleDownloadReceiptHuntCard();
        const insight = huntInsight.trim().replace(/\s+/g, " ");
        const topCategory = receiptHuntSpending.categories[0];
        const pageUrl = window.location.origin + "/receipt-hunt";
        const shareText = "Receipt Hunt #01\n\nTop spending category: " + (topCategory ? `${topCategory.category} (${formatSpendingAmount(topCategory.amount, receiptHuntSpending.currencyCode)}, ${(topCategory.share * 100).toFixed(1)}%)` : "not available") + "\nMy surprise: “" + insight + "”\n\nHealth: " + result.healthScore + "/100 · Nutrition: " + result.nutritionScore + "/100\n\nJoin the Hunt: " + pageUrl + "\n\n@replateapp #ReceiptHunt";
        track("receipt_hunt_share_clicked", { channel, challenge: "receipt-hunt-01" });
        const url = channel === "x"
            ? "https://twitter.com/intent/tweet?text="
            : "https://warpcast.com/~/compose?text=";
        window.open(url + encodeURIComponent(shareText), "_blank", "noopener,noreferrer");
    };

    const handleShareBase = async () => {
        if (!result) return;
        track("receipt_result_shared", { channel: "base" });
        const share = { title: "My Replate Result", text: `My Replate Health Score is ${result.healthScore}/100. I earned ${result.pointsEarned} RP.`, url: window.location.href };
        try {
            if (navigator.share) await navigator.share(share);
            else await navigator.clipboard.writeText(`${share.text} ${share.url}`);
        } catch { /* User cancelled sharing. */ }
    };

    const resetForm = () => {
        clearPendingReceiptAnalysis(address);
        setPendingAnalysis(false);
        setImagePreview(null);
        setResult(null);
        setHuntInsight("");
        setHuntNotice("");
        setReceiptHuntSpending(null);
        setAdvancedReport(null);
        setBehaviorIntelligence(null);
        setBasketIntelligence(null);
        setSpendingBreakdown(null);
        setReceiptProductPrices(null);
        setChatQuestion("");
        setChatAnswer(null);
        setActiveIntelligenceCall(null);
        setError(null);
    };

    const resultProducts = result?.products || [];
    const receiptCurrencySpending = spendingBreakdown?.currencies.find((summary) => summary.currencyCode === (result?.currencyCode ?? null));
    const intelligenceOptions: Array<{ id: string; name: string; price: string; handler: () => Promise<void>; loaded: boolean }> = [
        { id: "behavior", name: "Behavior Intelligence", price: "0.05 USDC", handler: handleCallBehavior, loaded: Boolean(behaviorIntelligence) },
        { id: "spending", name: "Spending Breakdown", price: "0.05 USDC", handler: handleCallSpending, loaded: Boolean(spendingBreakdown) },
        { id: "basket", name: "Basket Insights", price: "0.04 USDC", handler: handleCallBasket, loaded: Boolean(basketIntelligence) },
        ...(resultProducts.some((item) => typeof item.paidPrice === "number") ? [{ id: "product-price", name: "Product Prices · This Receipt", price: "0.03 USDC", handler: handleCallProductPrice, loaded: Boolean(receiptProductPrices) }] : []),
    ];

    return (
        <>
            <Shell>
            <div className="space-y-8 animate-fade-in-up">
                {/* Page Header */}
                <div className="text-center lg:text-left space-y-2">
                <h1 className="text-3xl sm:text-4xl font-black text-[#00E36E] drop-shadow-[0_0_10px_rgba(0,227,110,0.15)]">Verify Your Receipt</h1>
                    <p className="text-[#8c9790]">Take or upload a grocery receipt photo to understand and verify your basket.</p>
                </div>
                <div className="rounded-2xl border border-[#00E36E]/20 bg-[#00E36E]/5 px-4 py-3 text-sm text-[#8c9790]">
                    <p className="font-black text-[#00E36E]">Contribute data → unlock better intelligence</p>
                    <p className="mt-1">The more verified data you contribute, the smarter your Replate Intelligence becomes.</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                        {["1 · Basic insight", "3 · Richer comparison", "5 · 30-day patterns", "10 · Behavior patterns", "30-day history · Richer Intelligence"].map((step) => (
                            <div key={step} className="rounded-xl border border-[#00E36E]/15 bg-black/10 px-2 py-2 text-center font-bold text-white/80">{step}</div>
                        ))}
                    </div>
                    <p className="mt-3 text-xs font-bold text-white">{verifiedReceiptCount} verified receipts · {getIntelligenceTier(verifiedReceiptCount).label}</p>
                </div>

                {/* Main Content — 2 column on desktop */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                    {/* Left Column: Upload + Controls */}
                    <div className="space-y-6">
                        {/* Receipt Upload */}
                        <div className="bg-[#0c1310]/90 border border-[#00E36E]/12 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 space-y-6 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#8c9790]/50 text-center">
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
                                <div className="relative w-full aspect-[4/3] max-w-sm mx-auto bg-[#00E36E]/5 rounded-3xl border-2 border-dashed border-[#00E36E]/15 flex flex-col items-center justify-center overflow-hidden transition-all group-hover:border-[#00E36E]/30 group-hover:bg-[#00E36E]/10">
                                    {imagePreview ? (
                                        <div className="relative w-full h-full">
                                            <img
                                                src={imagePreview}
                                                alt="Receipt preview"
                                                className="w-full h-full object-cover rounded-3xl"
                                            />
                                            <div className="absolute inset-0 bg-[#00E36E]/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl">
                                                <div className="bg-[#00E36E]/25 backdrop-blur-md p-4 rounded-full border border-[#00E36E]/45 shadow-[0_0_15px_rgba(0,227,110,0.2)]">
                                                    <Camera size={28} className="text-[#00E36E]" />
                                                </div>
                                            </div>
                                            <div className="absolute top-3 right-3 bg-green-500 text-white p-2 rounded-full shadow-lg">
                                                <Check size={16} />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-3 p-8">
                                            <div className="w-16 h-16 bg-[#00E36E]/10 border border-[#00E36E]/20 rounded-2xl flex items-center justify-center text-[#00E36E] group-hover:scale-110 transition-transform shadow-[0_0_10px_rgba(0,227,110,0.1)]">
                                                <Camera size={32} />
                                            </div>
                                            <span className="font-bold text-[#8c9790]/60 uppercase tracking-widest text-[10px] text-center">
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
                            <div className="bg-[#0c1310]/90 border border-[#00E36E]/12 backdrop-blur-2xl rounded-3xl p-6 space-y-4 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                                <h2 className="text-center text-xs font-black uppercase tracking-[0.15em] text-[#8c9790]">
                                    Household
                                </h2>
                                <div className="flex items-center justify-center gap-4">
                                    <button
                                        onClick={() => setHouseholdSize(Math.max(1, householdSize - 1))}
                                        className="w-10 h-10 rounded-full bg-[#00E36E] hover:bg-[#00FF66] text-[#050806] flex items-center justify-center active:scale-90 transition-transform shadow-lg shadow-[#00E36E]/20"
                                    >
                                        <Minus size={18} strokeWidth={2.5} />
                                    </button>
                                    <span className="text-5xl font-black text-white w-16 text-center tabular-nums drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                                        {householdSize}
                                    </span>
                                    <button
                                        onClick={() => setHouseholdSize(householdSize + 1)}
                                        className="w-10 h-10 rounded-full bg-[#00E36E] hover:bg-[#00FF66] text-[#050806] flex items-center justify-center active:scale-90 transition-transform shadow-lg shadow-[#00E36E]/20"
                                    >
                                        <Plus size={18} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>

                            {/* Shopping Duration */}
                            <div className="bg-[#0c1310]/90 border border-[#00E36E]/12 backdrop-blur-2xl rounded-3xl p-6 space-y-4 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                                <h2 className="text-center text-xs font-black uppercase tracking-[0.15em] text-[#8c9790]">
                                    Duration
                                </h2>
                                <div className="flex items-center justify-center gap-4">
                                    <button
                                        onClick={() => setDuration(Math.max(1, duration - 1))}
                                        className="w-10 h-10 rounded-full bg-[#00E36E] hover:bg-[#00FF66] text-[#050806] flex items-center justify-center active:scale-90 transition-transform shadow-lg shadow-[#00E36E]/20"
                                    >
                                        <Minus size={18} strokeWidth={2.5} />
                                    </button>
                                    <div className="flex items-center w-20 justify-center">
                                        <span className="text-5xl font-black text-white tabular-nums drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] text-center">
                                            {duration}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => setDuration(duration + 1)}
                                        className="w-10 h-10 rounded-full bg-[#00E36E] hover:bg-[#00FF66] text-[#050806] flex items-center justify-center active:scale-90 transition-transform shadow-lg shadow-[#00E36E]/20"
                                    >
                                        <Plus size={18} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Verify Button */}
                        <button
                            onClick={handleVerify}
                            disabled={isLoading || isCompressing || (!imagePreview && !pendingAnalysis)}
                            className="w-full bg-[#00E36E] hover:bg-[#00FF66] text-[#050806] py-4 px-8 rounded-2xl font-black text-lg shadow-xl shadow-[#00E36E]/20 hover:shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 size={22} className="animate-spin" />
                                    {isReadingReceipt ? "Reading receipt..." : "Verifying..."}
                                </>
                            ) : isCompressing ? (
                                <>
                                    <Loader2 size={22} className="animate-spin" />
                                    Compressing...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={22} />
                                    {address ? (pendingAnalysis ? "Resume analysis" : "Analyze & Verify") : "Connect Wallet to Continue"}
                                </>
                            )}
                        </button>

                        {error && (
                            <div className="bg-red-950/40 border border-red-800/30 text-red-400 p-4 rounded-2xl text-sm font-medium text-center shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                                {error}
                            </div>
                        )}

                    </div>

                    {/* Right Column: Results or Tip */}
                    <div className="space-y-6">
                        {result ? (
                            <div className="bg-[#0c1310]/90 border border-green-500/20 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 space-y-6 animate-fade-in-up shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
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
                                        <p className="text-[10px] font-bold text-brand-text/50 uppercase tracking-wider">RP Earned</p>
                                    </div>
                                    <div className="bg-brand-accent/30 p-5 rounded-2xl text-center space-y-1">
                                        <div className="flex items-center justify-center text-green-600">
                                            <Leaf size={18} fill="currentColor" />
                                        </div>
                                        <p className="text-3xl font-black text-brand-primary">{result.fruitVegGrams}g</p>
                                        <p className="text-[10px] font-bold text-brand-text/50 uppercase tracking-wider">Fruits & Veg</p>
                                    </div>
                                </div>
                                {receiptHuntEntry && (
                                    <section className="space-y-4 rounded-2xl border border-[#00E36E]/20 bg-[#00E36E]/5 p-4" aria-labelledby="receipt-hunt-entry-title">
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-wider text-[#00E36E]">Receipt Hunt #01</p>
                                            <h4 id="receipt-hunt-entry-title" className="mt-1 text-lg font-black text-white">Which category did you spend more on than you expected?</h4>
                                            <p className="mt-1 text-xs leading-5 text-brand-text/60">Name the category and share what surprised you. The card only shows these analysis results and your text.</p>
                                            <p className="mt-2 text-[10px] leading-5 text-brand-text/50">Every item price and the printed total are checked before verification. Automatic recovery runs when the first reading is incomplete.</p>
                                        </div>
                                            {!receiptHuntSpending ? (
                                                <button type="button" onClick={handleReceiptHuntAnalysis} disabled={activeIntelligenceCall !== null} className="rounded-xl bg-[#00E36E] px-4 py-3 text-sm font-black text-[#050806] disabled:opacity-50">
                                                    {activeIntelligenceCall === "receipt-hunt-spending" ? "Analyzing receipt..." : "Run analysis · 0.05 USDC"}
                                                </button>
                                            ) : (
                                                <>
                                                    {receiptHuntSpending.categories.length === 0 ? <p className="text-xs text-brand-text/60">No priced items were available for this receipt.</p> : (
                                                        <div className="space-y-3 rounded-xl border border-white/10 bg-black/10 p-3">
                                                            <p className="text-xs text-brand-text/60">Top category on this receipt: <strong className="capitalize text-white">{receiptHuntSpending.categories[0].category}</strong> · {formatSpendingAmount(receiptHuntSpending.categories[0].amount, receiptHuntSpending.currencyCode)} · {(receiptHuntSpending.categories[0].share * 100).toFixed(1)}%</p>
                                                            {receiptHuntSpending.categories.map((category) => <div key={category.category} className="space-y-1">
                                                                <div className="flex justify-between gap-3 text-xs"><span className="capitalize text-white">{category.category}</span><span className="text-brand-text/70">{formatSpendingAmount(category.amount, receiptHuntSpending.currencyCode)} · {(category.share * 100).toFixed(1)}%</span></div>
                                                                <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${Math.min(100, category.share * 100)}%`, backgroundColor: spendingCategoryColors[category.category] || spendingCategoryColors.other }} /></div>
                                                            </div>)}
                                                            <p className="text-[10px] text-brand-text/45">Based on {receiptHuntSpending.pricedItemCount} priced line items from this receipt, in {receiptHuntSpending.currencyCode || "its currency"}.</p>
                                                        </div>
                                                    )}
                                                    <label htmlFor="receipt-hunt-insight" className="block text-xs font-bold text-white">What surprised you?</label>
                                                    <textarea id="receipt-hunt-insight" value={huntInsight} onChange={(event) => setHuntInsight(event.target.value.slice(0, 140))} maxLength={140} rows={3} placeholder={receiptHuntSpending.categories[0] ? `I didn't expect ${receiptHuntSpending.categories[0].category} to be my top category...` : "I was surprised by..."} className="w-full resize-y rounded-xl border border-[#00E36E]/20 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-brand-text/40 focus:border-[#00E36E]/60" />
                                                    <p className="text-right text-[10px] text-brand-text/50">{huntInsight.length}/140</p>
                                                    <canvas ref={receiptHuntCanvasRef} width={1080} height={1350} role="img" aria-label="Preview of your privacy-safe Receipt Hunt share card" className="mx-auto h-auto w-full max-w-[320px] rounded-2xl border border-white/10" />
                                                    <div className="grid gap-2 sm:grid-cols-3">
                                                        <button type="button" onClick={handleDownloadReceiptHuntCard} disabled={!huntInsight.trim() || !receiptHuntSpending.categories.length} className="rounded-xl bg-[#00E36E] px-3 py-3 text-xs font-black text-[#050806] disabled:opacity-40">Download Card</button>
                                                        <button type="button" onClick={() => handleShareReceiptHunt("x")} disabled={!huntInsight.trim() || !receiptHuntSpending.categories.length} className="rounded-xl border border-white/15 px-3 py-3 text-xs font-bold text-white disabled:opacity-40">Share to X</button>
                                                        <button type="button" onClick={() => handleShareReceiptHunt("farcaster")} disabled={!huntInsight.trim() || !receiptHuntSpending.categories.length} className="rounded-xl border border-white/15 px-3 py-3 text-xs font-bold text-white disabled:opacity-40">Share to Farcaster</button>
                                                    </div>
                                                    <p className="text-[10px] leading-5 text-brand-text/45">Attach the downloaded card to your public post with #ReceiptHunt and tag @replateapp. That post is your entry; the Replate team reviews entries manually each week. The receipt image is never shared.</p>
                                                </>
                                            )}
                                        {huntNotice && <p role="status" className="text-xs leading-5 text-[#00E36E]">{huntNotice}</p>}
                                    </section>
                                )}
                                <div className="bg-[#00E36E]/5 border border-[#00E36E]/15 rounded-2xl p-4 space-y-3">
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-wider text-[#00E36E]">What went well</p>
                                        <p className="text-sm text-brand-text/70 mt-1">{getBasketFeedback(result).positive}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-wider text-amber-500">One next step</p>
                                        <p className="text-sm text-brand-text/70 mt-1">{getBasketFeedback(result).improvement}</p>
                                    </div>
                                    <p className="text-[10px] text-brand-text/40 border-t border-[#00E36E]/10 pt-3">General informational feedback only; this is not medical advice.</p>
                                </div>
                                <div className="bg-[#00E36E]/5 border border-[#00E36E]/15 rounded-2xl p-4 space-y-3">
                                    <p className="text-sm font-black text-brand-primary">Ask about your receipt</p>
                                    <form onSubmit={handleReceiptChat} className="flex gap-2">
                                        <input value={chatQuestion} onChange={(event) => setChatQuestion(event.target.value)} placeholder="Ask about your scores..." aria-label="Ask about your receipt" className="min-w-0 flex-1 rounded-xl border border-[#00E36E]/15 bg-black/20 px-3 py-2 text-xs text-white outline-none placeholder:text-brand-text/40 focus:border-[#00E36E]/50" />
                                        <button type="submit" disabled={!chatQuestion.trim()} className="rounded-xl bg-[#00E36E] px-4 py-2 text-xs font-black text-[#050806] disabled:opacity-40">Ask</button>
                                    </form>
                                    <div className="flex flex-wrap gap-2">
                                        {["How can I improve my score?", "Why is my nutrition score like this?", "Which items affected my basket?"] .map((prompt) => <button key={prompt} type="button" onClick={() => setChatQuestion(prompt)} className="rounded-full border border-[#00E36E]/15 px-3 py-1.5 text-[10px] text-brand-text/70 hover:border-[#00E36E]/40">{prompt}</button>)}
                                    </div>
                                    {chatAnswer && <p role="status" className="border-t border-[#00E36E]/10 pt-3 text-xs leading-5 text-brand-text/75">{chatAnswer}</p>}
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

                                {advancedReport ? (
                                    <>
                                    <div className="bg-[#00E36E]/5 border border-[#00E36E]/20 rounded-2xl p-4 space-y-3">
                                        <p className="text-sm font-black text-brand-primary">Personalized Basket Insights</p>
                                        {[...advancedReport.insights, ...advancedReport.recommendations].map((item, index) => (
                                            <p key={`${item.message}-${index}`} className="text-xs text-brand-text/70">• {item.message}</p>
                                        ))}
                                        {!advancedReport.insights.length && !advancedReport.recommendations.length && (
                                            <p className="text-xs text-brand-text/70">Your basket has no additional rule-based recommendations.</p>
                                        )}
                                    </div>
                                    </>
                                ) : (
                                    <div className="space-y-2">
                                        <p className="text-xs text-brand-text/60">{getIntelligenceTier(verifiedReceiptCount).detail}</p>
                                        <button
                                            onClick={handleUnlockAdvanced}
                                            disabled={isUnlocking}
                                            className="w-full bg-[#00E36E] text-[#050806] py-3 px-4 rounded-xl font-black text-sm hover:bg-[#00FF66] disabled:opacity-60 transition-all flex items-center justify-center gap-2"
                                        >
                                            {isUnlocking ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                            {isUnlocking ? "Unlocking..." : "Unlock Advanced Report · 0.10 USDC"}
                                        </button>
                                    </div>
                                )}

                                <div className="bg-[#00E36E]/5 border border-[#00E36E]/15 rounded-2xl p-4 space-y-3">
                                    <p className="text-sm font-black text-brand-primary">Choose Intelligence APIs</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {intelligenceOptions.map(({ id, name, price, handler, loaded }) => (
                                            <button key={id as string} onClick={handler as () => void} disabled={activeIntelligenceCall !== null} className="rounded-xl border border-[#00E36E]/15 bg-black/10 px-3 py-3 text-left hover:border-[#00E36E]/40 disabled:opacity-50">
                                                <span className="block text-xs font-black text-white">{activeIntelligenceCall === id ? "Calling..." : loaded ? `${name} · Loaded` : name}</span>
                                                <span className="block mt-1 text-[10px] text-brand-text/50">{price} · {id === "product-price" ? "one call per receipt" : "separate x402 call"}</span>
                                            </button>
                                        ))}
                                    </div>
                                    {behaviorIntelligence && (
                                        <div className="space-y-2 border-t border-[#00E36E]/10 pt-3 text-xs text-brand-text/70">
                                            <p className="font-black text-brand-primary">Behavior Intelligence</p>
                                            <p>Trend: <b className="text-white">{behaviorIntelligence.basketTrend}</b> · Repeat purchases: <b className="text-white">{Math.round(behaviorIntelligence.repeatPurchaseRatio * 100)}%</b></p>
                                            <p>Top categories: {behaviorIntelligence.topCategories.join(" · ") || "None"}</p>
                                            <p>Frequent items: {Object.entries(behaviorIntelligence.purchaseFrequency).map(([item, count]) => `${item} (${count})`).join(" · ") || "None"}</p>
                                        </div>
                                    )}
                                    {receiptProductPrices && (
                                        <div className="space-y-2 border-t border-[#00E36E]/10 pt-3 text-xs text-brand-text/70">
                                            <p className="font-black text-brand-primary">Prices from this receipt · {receiptProductPrices.currencyCode || "Unknown currency"}</p>
                                            {receiptProductPrices.products.length ? (
                                                <div className="divide-y divide-[#00E36E]/10 rounded-xl border border-[#00E36E]/10 px-3">
                                                    {receiptProductPrices.products.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
                                                        <span className="font-semibold text-white">{item.name}{item.quantity > 1 ? ` × ${item.quantity}` : ""}</span>
                                                        <span className="tabular-nums">{item.paidPrice === null ? "Line total unavailable" : `Line total ${formatSpendingAmount(item.paidPrice, receiptProductPrices.currencyCode)}`}{item.unitPrice === null ? "" : ` · ${formatSpendingAmount(item.unitPrice, receiptProductPrices.currencyCode)}/${item.priceUnit}`}</span>
                                                    </div>)}
                                                </div>
                                            ) : <p className="text-brand-text/60">No priced line items were found on this receipt.</p>}
                                        </div>
                                    )}
                                    {receiptCurrencySpending ? (
                                        <div key={receiptCurrencySpending.currencyCode || "unknown"} className="space-y-3 border-t border-[#00E36E]/10 pt-4 text-xs text-brand-text/75">
                                            <div>
                                                <p className="font-black text-brand-primary">Spending Breakdown · {receiptCurrencySpending.currencyCode || "Unknown currency"}</p>
                                                <p className="mt-1 text-sm font-semibold text-white">Total {formatSpendingAmount(receiptCurrencySpending.totalSpent, receiptCurrencySpending.currencyCode)} <span className="font-normal text-brand-text/65">across {receiptCurrencySpending.receiptCount} receipts · average {formatSpendingAmount(receiptCurrencySpending.averageReceiptSpend, receiptCurrencySpending.currencyCode)} per receipt</span></p>
                                                {receiptCurrencySpending.lineItemEstimateCount > 0 && <p className="mt-1 text-[10px] text-brand-text/55">{receiptCurrencySpending.lineItemEstimateCount} of {receiptCurrencySpending.receiptCount} receipt totals estimated from recognized line items.</p>}
                                            </div>
                                            <p className="rounded-xl bg-white/[0.03] px-3 py-2">Food categories {formatSpendingAmount(receiptCurrencySpending.foodSpend, receiptCurrencySpending.currencyCode)} · Household {formatSpendingAmount(receiptCurrencySpending.householdSpend, receiptCurrencySpending.currencyCode)} · Last 30 days {formatSpendingAmount(receiptCurrencySpending.last30Days.spent, receiptCurrencySpending.currencyCode)}{receiptCurrencySpending.last30Days.change === null ? "" : ` (${receiptCurrencySpending.last30Days.change > 0 ? "+" : ""}${(receiptCurrencySpending.last30Days.change * 100).toFixed(1)}%)`}</p>
                                            <div className="space-y-3">
                                                <p className="font-bold text-white">Category spend <span className="font-normal text-brand-text/55">· share of recognized priced items</span></p>
                                                {receiptCurrencySpending.categories.length === 0 ? <p className="text-brand-text/60">No priced items available for category breakdown.</p> : receiptCurrencySpending.categories.map((category) => {
                                                    const share = Number.isFinite(category.share) ? Math.min(1, Math.max(0, category.share)) : 0;
                                                    const percent = share * 100;
                                                    const color = spendingCategoryColors[category.category] || "#94A3B8";
                                                    return <div key={category.category} className="space-y-1.5">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <span className="flex items-center gap-2 font-semibold capitalize text-white/90"><span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />{category.category}</span>
                                                            <span className="shrink-0 font-semibold tabular-nums text-white">{formatSpendingAmount(category.amount, receiptCurrencySpending.currencyCode)} <span className="text-brand-text/65">· {percent.toFixed(1)}%</span></span>
                                                        </div>
                                                        <div role="progressbar" aria-label={`${category.category}: ${percent.toFixed(1)}% of recognized priced items`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number(percent.toFixed(1))} className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: color }} /></div>
                                                    </div>;
                                                })}
                                            </div>
                                        </div>
                                    ) : spendingBreakdown && <p className="border-t border-[#00E36E]/10 pt-3 text-xs text-brand-text/60">No spending data is available in this receipt&apos;s currency ({result?.currencyCode || "Unknown"}).</p>}
                                    {basketIntelligence && <div className="border-t border-[#00E36E]/10 pt-3 text-xs text-brand-text/70"><p className="font-black text-brand-primary">Basket Insights · score {basketIntelligence.basketScore}</p><p>Diversity {Math.round(basketIntelligence.basketDiversity * 100)}% · fruit & veg {Math.round(basketIntelligence.fruitVegRatio * 100)}% · healthy items {Math.round(basketIntelligence.healthyItemRatio * 100)}%</p></div>}
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
                                            onClick={handleShareBase}
                                            className="flex-1 bg-[#00E36E]/15 text-[#00E36E] border border-[#00E36E]/25 py-3 px-4 rounded-xl font-bold text-sm hover:bg-[#00E36E]/25 transition-all flex items-center justify-center gap-2"
                                        >
                                            Share to Base
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
                            <div className="bg-[#0c1310]/90 border border-[#00E36E]/12 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 space-y-6 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                                <h3 className="text-lg font-black text-white">How Scoring Works</h3>
                                <div className="space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-[#00E36E]/10 border border-[#00E36E]/20 flex items-center justify-center text-[#00E36E] shrink-0 mt-0.5">
                                            <Leaf size={16} />
                                        </div>
                                        <div>
                                            <p className="font-extrabold text-sm text-[#00E36E]">Health Score</p>
                                            <p className="text-xs text-[#8c9790] leading-relaxed">
                                                Based on the ratio of healthy vs unhealthy items in your cart. More fruits, veggies, and whole grains = higher score.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                                            <Star size={16} />
                                        </div>
                                        <div>
                                            <p className="font-extrabold text-sm text-[#00E36E]">Nutrition Score</p>
                                            <p className="text-xs text-[#8c9790] leading-relaxed">
                                                Based on an average target of around 300g of fruit and vegetables per person per day. We check if your basket provides enough for your household.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                                            <Trophy size={16} />
                                        </div>
                                        <div>
                                            <p className="font-extrabold text-sm text-[#00E36E]">Replate Points (RP)</p>
                                            <p className="text-xs text-[#8c9790] leading-relaxed">
                                                Earn up to 15 RP per receipt based on your scores, plus streak bonuses for consistent healthy shopping.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-[#00E36E]/5 border border-[#00E36E]/12 p-4 rounded-2xl text-center">
                                    <p className="text-sm text-[#8c9790] italic font-medium">
                                        &ldquo;Eat healthier and more balanced with a {duration} day plan.&rdquo;
                                    </p>
                                </div>
                            </div>
                        )}

                        <details className="group rounded-2xl border border-[#00E36E]/15 bg-[#00E36E]/5 p-4">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#00E36E]">For AI Agents</p>
                                    <p className="mt-1 text-sm font-bold text-white">Machine-readable Replate Intelligence API via x402</p>
                                </div>
                                <ChevronDown size={18} className="shrink-0 text-[#00E36E] transition-transform group-open:rotate-180" />
                            </summary>
                            <div className="mt-4 space-y-4 border-t border-[#00E36E]/10 pt-4">
                                <p className="text-xs leading-5 text-brand-text/65">
                                    Agents can autonomously pay and fetch intelligence from verified receipt data using x402 — no browser interaction required.
                                </p>
                                <div className="space-y-2">
                                    {[
                                        ["Advanced Receipt Report", "POST /api/intelligence/advanced", "0.10 USDC", "Live"],
                                        ["Meal Photo Analysis", "POST /api/analyze-meal", "0.01 USDC", "Live"],
                                        ["Basket Intelligence", "GET /api/intelligence/basket/{receiptId}", "0.04 USDC", "Live"],
                                        ["Receipt Product Prices", "GET /api/intelligence/price/receipt/{receiptId}", "0.03 USDC / receipt", "Live"],
                                        ["Receipt Spending Breakdown", "GET /api/intelligence/spending/receipt/{receiptId}", "0.05 USDC / receipt", "Live"],
                                        ["Spending Breakdown", "GET /api/intelligence/spending/me", "0.05 USDC", "Live"],
                                        ["Behavior Intelligence", "GET /api/intelligence/behavior/me", "0.05 USDC", "Live"],
                                        ["Product Signal", "GET /api/signals/product/{canonicalProductId}", "0.01 USDC", "Soon"],
                                        ["Category Signal", "GET /api/signals/category/{category}", "0.01 USDC", "Soon"],
                                        ["Merchant Signal", "GET /api/signals/merchant/{merchantId}", "0.01 USDC", "Soon"],
                                    ].map(([name, endpoint, price, status]) => (
                                        <div key={endpoint} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/10 px-3 py-2.5">
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-white">{name}</p>
                                                <code className="block truncate text-[10px] text-brand-text/45">{endpoint}</code>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <p className="text-xs font-black text-[#00E36E]">{price}</p>
                                                <p className={`text-[10px] font-bold ${status === "Live" ? "text-[#00E36E]" : "text-brand-text/35"}`}>{status}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex flex-wrap gap-3 text-xs font-bold">
                                    <a href={getConfiguredApiUrl("/openapi.json")} target="_blank" rel="noreferrer" className="text-[#00E36E] hover:underline">OpenAPI spec →</a>
                                    <a href={getConfiguredApiUrl("/.well-known/agent-card.json")} target="_blank" rel="noreferrer" className="text-[#00E36E] hover:underline">Agent card →</a>
                                </div>
                            </div>
                        </details>
                    </div>
                </div>
            </div>
        </Shell>

        {/* Upload Source Selection Modal */}
        {showUploadModal && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                {/* Backdrop */}
                <div 
                    className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity"
                    onClick={() => setShowUploadModal(false)}
                ></div>
                
                {/* Modal Content */}
                <div className="relative w-full sm:max-w-sm bg-[#0a0e0c] border border-[#00E36E]/20 backdrop-blur-2xl rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom duration-300 z-10 space-y-4">
                    <div className="text-center pb-2">
                        <h3 className="text-lg font-black text-white">Select Receipt Source</h3>
                        <p className="text-xs text-[#8c9790]">Choose how you want to upload your receipt</p>
                    </div>
                    
                    <div className="space-y-3">
                        <button
                            onClick={() => handleSelectOption("camera")}
                            type="button"
                            className="w-full py-4 px-6 bg-[#00E36E] hover:bg-[#00FF66] text-[#050806] rounded-2xl font-black text-base active:scale-98 transition-all flex items-center justify-center gap-3 shadow-lg shadow-[#00E36E]/20 cursor-pointer"
                        >
                            <Camera size={20} />
                                Take Receipt Photo
                        </button>
                        
                        <button
                            onClick={() => handleSelectOption("gallery")}
                            type="button"
                            className="w-full py-4 px-6 bg-[#00E36E]/10 hover:bg-[#00E36E]/20 text-[#00E36E] rounded-2xl font-black text-base active:scale-98 transition-all flex items-center justify-center gap-3 border border-[#00E36E]/20 cursor-pointer"
                        >
                            <Image size={20} />
                            Choose from Gallery
                        </button>

                    </div>
                    
                    <button
                        onClick={() => setShowUploadModal(false)}
                        type="button"
                        className="w-full py-3 px-6 bg-transparent text-[#8c9790] hover:text-white font-bold text-sm transition-colors cursor-pointer"
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
                {error && <p className="mb-4 rounded-xl bg-red-500/20 px-4 py-3 text-center text-sm font-bold text-red-200">{error}</p>}
                
                <div className="flex justify-center pb-4">
                    <button
                        onClick={capturePhoto}
                        type="button"
                        className="w-20 h-20 rounded-full bg-[#00E36E] p-1 border-4 border-[#050806] active:scale-90 transition-transform shadow-2xl cursor-pointer shadow-[#00E36E]/20"
                    >
                        <div className="w-full h-full rounded-full bg-[#050806] flex items-center justify-center text-[#00E36E]">
                            <Camera size={28} />
                        </div>
                    </button>
                </div>
            </div>
        )}
        </>
    );
}
