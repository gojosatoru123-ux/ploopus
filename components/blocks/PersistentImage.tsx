import { StorageEngine } from "@/lib/storage-engine";
import { useEffect, useState } from "react";


const PersistentImage = ({ src, alt, className, onClick }: { src: string, alt: string, className?: string, onClick?: () => void }) => {
    const [resolvedUrl, setResolvedUrl] = useState<string>("");

    useEffect(() => {
        let currentBlob: string | null = null;
        async function resolve() {
            if (!src) return;
            // Handle standard web URLs or existing blobs
            if (src.startsWith('http') || src.startsWith('blob:')) {
                setResolvedUrl(src);
            } else {
                // Handle local OPFS filenames
                const url = await StorageEngine.getMediaUrl(src);
                if (url) {
                    currentBlob = url;
                    setResolvedUrl(url);
                }
            }
        }
        resolve();
        return () => { if (currentBlob) URL.revokeObjectURL(currentBlob); };
    }, [src]);

    if (!resolvedUrl) {
        return <div className="w-full h-75 bg-muted/20 animate-pulse rounded-lg" />;
    }

    return (
        <img
            src={resolvedUrl}
            alt={alt}
            className={className}
            onClick={onClick}
            loading="lazy"
        />
    );
};
export default PersistentImage;