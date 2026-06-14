import { StorageEngine } from "@/lib/storage-engine";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

const PersistentAudio = ({ src, className }: { src: string; className?: string }) => {
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        // If it's a direct web link, use it. Otherwise, fetch from OPFS.
        if (src.startsWith('http') || src.startsWith('blob:')) {
            setUrl(src);
        } else {
            StorageEngine.getMediaUrl(src).then((blob) => {
                if (isMounted && blob) setUrl(blob);
            });
        }

        return () => {
            isMounted = false;
            if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
        };
    }, [src]);

    if (!url) {
        return (
            <div className="w-full h-10 bg-secondary/50 animate-pulse rounded-xl flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <audio
            controls
            className={`${className}`}
            src={url}
        >
            Your browser does not support audio.
        </audio>
    );
};
export default PersistentAudio