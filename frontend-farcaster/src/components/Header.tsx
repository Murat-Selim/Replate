"use client";

import React from "react";
import { Menu, Plus } from "lucide-react";
import SideMenu from "./SideMenu";
import { sdk } from "@farcaster/miniapp-sdk";
import { usePathname } from "next/navigation";
import { useFarcasterAccount } from "@/hooks/useFarcasterAccount";

export default function Header() {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const [sdkUser, setSdkUser] = React.useState<{username?: string, displayName?: string, pfpUrl?: string, fid?: number} | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isBaseApp, setIsBaseApp] = React.useState(false);
    const [isAdded, setIsAdded] = React.useState(false);
    const [isAdding, setIsAdding] = React.useState(false);
    const pathname = usePathname();
    const { address, isConnected } = useFarcasterAccount();

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
            <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-[#0B1114]/70 backdrop-blur-md border-b border-brand-primary/5">
                <div className="flex items-center gap-3">
                    {pfpUrl ? (
                        <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-brand-primary shadow-[0_0_10px_rgba(34,217,122,0.4)]">
                            <img src={pfpUrl} alt={displayIdentity} className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="w-9 h-9 rounded-full bg-brand-surface border border-brand-primary/30 flex items-center justify-center text-brand-primary font-bold text-sm shadow-[0_0_10px_rgba(34,217,122,0.2)]">
                            {isLoading && !isConnected ? (
                                <div className="w-4 h-4 border-2 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
                            ) : (
                                initial
                            )}
                        </div>
                    )}
                    <div className="flex flex-col">
                        <span className="font-extrabold text-white text-xs tracking-wider uppercase font-heading">
                            {isLoading && !isConnected ? "@..." : `@${displayIdentity.toUpperCase()}`}
                        </span>
                        {isBaseApp && (
                            <span className="text-[9px] text-brand-primary font-bold tracking-widest uppercase">Base App</span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {showAddButton && (
                        <button
                            onClick={handleAddMiniApp}
                            disabled={isAdding}
                            className="px-3 py-1.5 rounded-full bg-brand-primary text-black text-[10px] font-black uppercase tracking-wider flex items-center gap-1 neon-glow-btn disabled:opacity-60 active:scale-95 transition-all"
                        >
                            <Plus size={11} strokeWidth={3} />
                            {isAdding ? "Adding..." : "Add App"}
                        </button>
                    )}
                    <button
                        onClick={() => setIsMenuOpen(true)}
                        className="w-9 h-9 flex items-center justify-center text-white hover:bg-brand-surface rounded-full transition-colors active:scale-90"
                    >
                        <Menu size={24} />
                    </button>
                </div>
            </header>
            <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
        </>
    );
}
