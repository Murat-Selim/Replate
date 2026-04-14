"use client";

import React from "react";
import { Menu, Plus } from "lucide-react";
import SideMenu from "./SideMenu";
import { sdk } from "@farcaster/miniapp-sdk";
import { usePathname } from "next/navigation";

export default function Header() {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const [username, setUsername] = React.useState<string>("");
    const [pfpUrl, setPfpUrl] = React.useState<string>("");
    const [isLoading, setIsLoading] = React.useState(true);
    const [isBaseApp, setIsBaseApp] = React.useState(false);
    const [isMiniApp, setIsMiniApp] = React.useState(false);
    const [isAdded, setIsAdded] = React.useState(false);
    const [isAdding, setIsAdding] = React.useState(false);
    const pathname = usePathname();

    React.useEffect(() => {
        const fetchUser = async () => {
            try {
                const context = await sdk.context;
                if (!context) return;
                setIsMiniApp(true);
                const user = context?.user;
                if (user) {
                    const resolvedName =
                        user.username ||
                        user.displayName ||
                        (typeof user.fid === "number" ? `fid:${user.fid}` : "");
                    setUsername(resolvedName);
                    if (user.pfpUrl) setPfpUrl(user.pfpUrl);
                }
                // Detect if running in Base App (clientFid === 309857)
                if (context?.client?.clientFid === 309857) {
                    setIsBaseApp(true);
                }
                setIsAdded(Boolean(context?.client?.added));
            } catch (err) {
                console.log("Not in MiniApp context");
            } finally {
                setIsLoading(false);
            }
        };
        fetchUser();
    }, []);

    const initial = (username.charAt(0) || "?").toUpperCase();
    const showAtPrefix = !username.startsWith("fid:");
    const showAddButton = pathname === "/" && !isLoading && isMiniApp && !isAdded;

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
                            <img src={pfpUrl} alt={username} className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center text-white font-bold text-sm shadow-sm">
                            {isLoading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                initial
                            )}
                        </div>
                    )}
                    <div className="flex flex-col">
                        <span className="font-bold text-brand-primary text-[11px] uppercase tracking-wider">
                            {isLoading ? "@..." : username ? `${showAtPrefix ? "@" : ""}${username}` : "@guest"}
                        </span>
                        {isBaseApp && (
                            <span className="text-[9px] text-blue-600 font-medium">Base App</span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    {showAddButton && (
                        <button
                            onClick={handleAddMiniApp}
                            disabled={isAdding}
                            className="px-2.5 py-1.5 rounded-full bg-brand-primary text-white text-[10px] font-bold flex items-center gap-1 shadow-sm disabled:opacity-60"
                        >
                            <Plus size={12} />
                            {isAdding ? "Adding..." : "Add App"}
                        </button>
                    )}
                    <button
                        onClick={() => setIsMenuOpen(true)}
                        className="w-8 h-8 flex items-center justify-center text-brand-primary hover:bg-brand-accent/50 rounded-full transition-colors"
                    >
                        <Menu size={24} />
                    </button>
                </div>
            </header>
            <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
        </>
    );
}
