import { StorageEngine } from "@/lib/storage-engine";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

const PersistentVideo = ({ src, className }: { src: string; className?: string }) => {
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        // Logic: If it's a web link, use as is. If not, treat as OPFS path.
        if (src.startsWith('http') || src.startsWith('blob:')) {
            setUrl(src);
        } else {
            StorageEngine.getMediaUrl(src).then((blob) => {
                if (isMounted) setUrl(blob);
            });
        }

        return () => {
            isMounted = false;
            // Clean up the blob URL to save memory
            if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
        };
    }, [src]);

    if (!url) {
        return (
            <div className={`${className} flex items-center justify-center bg-zinc-900 animate-pulse`}>
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <video
            src={url}
            controls
            playsInline
            className={className}
        />
    );
};
export default PersistentVideo;