'use client';

import PluginRunner from "@/components/plugins/PluginRunner";
import { Button } from "@/components/ui/button";
import { usePluginContext } from "@/contexts/PluginsContext";
import { ArrowLeft, AlertCircle, Puzzle } from "lucide-react";
import Link from "next/link";
import { use } from "react";

interface PlateformPluginPageProps {
    params: Promise<{
        plateformId: string;
    }>;
}

const PlateformPluginPage = ({ params }: PlateformPluginPageProps) => {
    const { plateformId } = use(params)
    const { pluginIndexes } = usePluginContext()
    const open = pluginIndexes.find((p) => p.id == plateformId)

    return (
        <>
            {open ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="border-b bg-card/80 backdrop-blur-sm px-6 py-3 flex items-center gap-3 sticky top-0 z-10">
                        <Link href="/plateforms" className="border flex items-center p-1 rounded-full hover:bg-accent transition-colors">
                            <ArrowLeft className="w-4 h-4" />
                        </Link>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="text-sm font-medium">{open.icon} {open.name}</span>
                    </div>
                    <PluginRunner plugin={open} />
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[60vh]">
                    <div className="relative mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                        <Puzzle className="h-10 w-10 text-muted-foreground/60" />
                        <div className="absolute -bottom-1 -right-1 rounded-full bg-background p-1 shadow-sm">
                            <AlertCircle className="h-5 w-5 text-destructive" />
                        </div>
                    </div>

                    <h3 className="text-xl font-semibold tracking-tight">
                        Plugin not found
                    </h3>
                    <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                        We couldn't find a platform plugin with the ID <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-xs font-semibold">{plateformId}</code>. It may have been removed or the URL might be incorrect.
                    </p>

                    <div className="mt-6">
                        <Button asChild variant="outline" size="sm">
                            <Link href="/plateforms" className="flex items-center gap-2">
                                <ArrowLeft className="w-4 h-4" />
                                Back to Platforms
                            </Link>
                        </Button>
                    </div>
                </div>
            )}
        </>
    )
}

export default PlateformPluginPage;