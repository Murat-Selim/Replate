"use client";

import React from "react";
import { Menu, Plus } from "lucide-react";
import SideMenu from "./SideMenu";
import { sdk } from "@farcaster/miniapp-sdk";
import { usePathname } from "next/navigation";
import { useBaseAccount } from "@/hooks/useBaseAccount";

export default function Header() {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const [sdkUser, setSdkUser] = React.useState<{username?: string, displayName?: string, pfpUrl?: string, fid?: number} | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isBaseApp, setIsBaseApp] = React.useState(false);
    const [isAdded, setIsAdded] = React.useState(false);
    const [isAdding, setIsAdding] = React.useState(false);
    const pathname = usePathname();
    const { address, isConnected } = useBaseAccount();

    React.useEffect(() => {
        const fetchContext = async () => {
            try {
                const context = await sdk.context;
                if (context?.user) {
                    setSdkUser(context.user);
                }
                
                // Base App Detection
                if (context?.client?.clientFid === 309857) {
                    setIsBaseApp(true);
                }
                
                setIsAdded(Boolean(context?.client?.added));
            } catch (err) {
                console.log("Header: Not in MiniApp context");
            } finally {
                setIsLoading(false);
            }
        };
        fetchContext();
    }, []);

    // Identity Logic
    const username = sdkUser?.username || sdkUser?.displayName || (sdkUser?.fid ? `fid:${sdkUser.fid}` : "");
    const walletDisplay = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";
    const displayIdentity = username || walletDisplay || "Guest";
    const pfpUrl = sdkUser?.pfpUrl || "";
    const initial = (displayIdentity.charAt(0) || "?").toUpperCase();
    
    // Constraints for "Add App" button:
    // 1. Must be on homepage
    // 2. Must not be loading
    // 3. Must have a Farcaster FID (proves we are in Farcaster)
    // 4. Must not be already added
    const showAddButton = pathname === "/" && !isLoading && Boolean(sdkUser?.fid) && !isAdded;

    const handleAddMiniApp = async () => {
        try {
            setIsAdding(true);
            await sdk.actions.addFrame();
            setIsAdded(true);
        } catch (err) {
            console.error("Add app cancelled or failed:", err);
        } finally {
            setIsAdding(false);
        }
    };

    return (
        <>
            <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-3 py-4 bg-brand-background/80 backdrop-blur-md">
                <div className="flex items-center gap-2">
                    {pfpUrl ? (
                        <div className="w-8 h-8 rounded-full overflow-hidden shadow-sm border border-brand-accent/20">
                            <img src={pfpUrl} alt={displayIdentity} className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center text-white font-bold text-sm shadow-sm transition-all">
                            {isLoading && !isConnected ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                initial
                            )}
                        </div>
                    )}
                    <div className="flex flex-col">
                        <span className="font-bold text-brand-primary text-[11px] uppercase tracking-wider">
                            {isLoading && !isConnected ? "@..." : `@${displayIdentity.toLowerCase()}`}
                        </span>
                        {isBaseApp && (
                            <span className="text-[9px] text-blue-600 font-medium tracking-tight">Base App</span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    {showAddButton && (
                        <button
                            onClick={handleAddMiniApp}
                            disabled={isAdding}
                            className="px-2.5 py-1.5 rounded-full bg-brand-primary text-white text-[10px] font-bold flex items-center gap-1 shadow-sm disabled:opacity-60 ring-1 ring-white/20 active:scale-95 transition-transform"
                        >
                            <Plus size={12} />
                            {isAdding ? "Adding..." : "Add App"}
                        </button>
                    )}
                    <button
                        onClick={() => setIsMenuOpen(true)}
                        className="w-8 h-8 flex items-center justify-center text-brand-primary hover:bg-brand-accent/50 rounded-full transition-colors active:scale-90"
                    >
                        <Menu size={24} />
                    </button>
                </div>
            </header>
            <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
        </>
    );
}
