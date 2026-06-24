"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
}

type ModalReason = "cooldown" | "ios" | "unsupported";

export default function PWAInstallButton() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [modalReason, setModalReason] = useState<ModalReason>("cooldown");

    useEffect(() => {
        const handlePrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };

        window.addEventListener("beforeinstallprompt", handlePrompt);
        return () => window.removeEventListener("beforeinstallprompt", handlePrompt);
    }, []);

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            try {
                await deferredPrompt.prompt();
                return;
            } catch (error) {
                console.error("Installation failed:", error);
            }
        }

        // --- AUTOMATIC PROMPT FAILED: DETERMINE THE REASON ---
        const ua = typeof window !== "undefined" ? navigator.userAgent.toLowerCase() : "";
        const isIOS = /iphone|ipad|ipod/.test(ua);
        const isFirefox = ua.includes("firefox");

        if (isIOS) {
            setModalReason("ios");
        } else if (isFirefox) {
            setModalReason("unsupported");
        } else {
            // Default fallback for Chrome/Edge/Brave when cooldown is active or blocking
            setModalReason("cooldown");
        }

        setIsOpen(true);
    };

    const onClose = () => setIsOpen(false);

    // --- DYNAMIC CONTENT CONFIGURATION ---
    const modalContent = {
        cooldown: {
            title: "💡 Quick App Reinstallation",
            description: "Your browser is pausing automatic popups because this app was recently removed.",
            steps: [
                "Look at the top right of your browser screen (inside or right next to the URL address bar).",
                "Click the small Monitor/Download icon, OR open the menu (three dots ⋮) and select 'Install Ploopus'."
            ]
        },
        ios: {
            title: "📱 Install on iOS / Safari",
            description: "Apple Safari requires you to add progressive web apps manually to your home screen.",
            steps: [
                "Tap the Share button at the bottom of your Safari browser window (the box with an arrow pointing up 📤).",
                "Scroll down through the options list and tap 'Add to Home Screen' (➕)."
            ]
        },
        unsupported: {
            title: "🌐 Browser Support Notice",
            description: "Your current browser configuration doesn't support direct desktop web apps.",
            steps: [
                "For the best app experience, copy this website link and open it in Google Chrome, Microsoft Edge, or Brave.",
                "Alternatively, bookmark this page (Ctrl+D / Cmd+D) to easily access it like a desktop launcher."
            ]
        }
    };

    const activeContent = modalContent[modalReason];

    return (
        <>
            {/* Action Button */}
            <button
                onClick={handleInstallClick}
                className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg shadow active:scale-95 transition-all"
            >
                Install App
            </button>

            {/* Adaptive Modal */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                            onClick={onClose}
                        />

                        {/* Modal Wrapper */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.85 }}
                            transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 30 }}
                            className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none"
                        >
                            <div className="pointer-events-auto w-full max-w-md bg-zinc-900 border border-zinc-800 text-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col p-6 relative">

                                {/* Close Button */}
                                <button
                                    onClick={onClose}
                                    className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 w-8 h-8 rounded-full flex items-center justify-center transition-colors font-bold text-sm"
                                >
                                    ✕
                                </button>

                                {/* Dynamic Header */}
                                <div className="mb-4">
                                    <h3 className="text-xl font-bold text-amber-400 flex items-center gap-2">
                                        {activeContent.title}
                                    </h3>
                                    <p className="text-zinc-400 text-sm mt-1">
                                        {activeContent.description}
                                    </p>
                                </div>

                                <hr className="border-zinc-800 my-2" />

                                {/* Dynamic Step Instructions */}
                                <div className="space-y-4 my-2 text-sm text-zinc-300">
                                    <p>Follow these quick instructions to set up the app shortcut:</p>

                                    <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 space-y-3">
                                        {activeContent.steps.map((step, index) => (
                                            <div key={index} className="flex gap-3 items-start">
                                                <span className="flex items-center justify-center bg-blue-600/20 text-blue-400 font-bold rounded-full w-5 h-5 text-xs shrink-0 mt-0.5">
                                                    {index + 1}
                                                </span>
                                                <p className="text-zinc-300">{step}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Footer Action */}
                                <div className="mt-5 flex justify-end">
                                    <button
                                        onClick={onClose}
                                        className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl transition-colors text-sm"
                                    >
                                        Got it, Thanks
                                    </button>
                                </div>

                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}