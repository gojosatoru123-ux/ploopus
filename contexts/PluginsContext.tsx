'use client';
import { createContext, useContext, ReactNode } from "react";
import { usePlugin, SearchHit } from "@/hooks/usePlugins";
import { PluginManifest, PluginNotification, PluginRecord, ReminderHit } from "@/lib/plugins/types";

type PluginContextType = ReturnType<typeof usePlugin>;

const PluginContext = createContext<PluginContextType | null>(null);

export const PluginProvider = ({ children }: { children: ReactNode }) => {
    const plugin = usePlugin();
    return (
        <PluginContext.Provider value={plugin}>
            {children}
        </PluginContext.Provider>
    );
};

export const usePluginContext = () => {
    const context = useContext(PluginContext);
    if (!context) throw new Error("usePluginContext must be used within PluginProvider");
    return context;
};