
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { TorrentSource } from "@/types";

interface VideoPlayerProps {
  title: string;
  source: TorrentSource;
  mediaType: "movie" | "tv";
  mediaId: number;
}

const VideoPlayer = ({ title, source, mediaType, mediaId }: VideoPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Reset state when source changes
    setIsLoading(true);
    setStreamUrl(null);
    
    const loadStream = async () => {
      try {
        // Get streamable URL from the API
        const url = await api.getStreamUrl(source, mediaType, mediaId, title);
        setStreamUrl(url);
        toast.success(`Stream loaded from ${source.provider}`);
      } catch (error) {
        console.error("Error loading stream:", error);
        toast.error("Failed to load stream. Please try another source.");
      } finally {
        setIsLoading(false);
      }
    };
    
    loadStream();
  }, [source, mediaType, mediaId, title]);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="w-full rounded-lg overflow-hidden bg-black relative">
      {isLoading ? (
        <div className="aspect-video flex flex-col items-center justify-center bg-gray-900">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-lg">Loading stream from {source.provider} ({source.quality})...</p>
        </div>
      ) : streamUrl ? (
        <>
          <video
            ref={videoRef}
            className="w-full aspect-video"
            controls
            autoPlay
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          >
            <source src={streamUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          <div className="absolute top-4 left-4 bg-black/70 px-3 py-1 rounded-md text-sm">
            {title} ({source.quality})
          </div>
        </>
      ) : (
        <div className="aspect-video flex flex-col items-center justify-center bg-gray-900">
          <p className="text-lg text-red-500">Failed to load stream</p>
          <p className="mt-2">Please try another source</p>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
