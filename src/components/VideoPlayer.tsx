
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
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Sample videos for fallback when streaming fails
  const sampleVideos = [
    "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    "https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4"
  ];

  useEffect(() => {
    // Reset state when source changes
    setIsLoading(true);
    setStreamUrl(null);
    setError(null);
    
    const loadStream = async () => {
      try {
        console.log("Loading stream for:", title, "Source:", source.provider);
        
        // Get streamable URL from the API
        let url;
        try {
          url = await api.getStreamUrl(source, mediaType, mediaId, title);
        } catch (error) {
          console.error("Error getting stream URL from API:", error);
          // If API fails, use a sample video as fallback
          const randomIndex = Math.floor(Math.random() * sampleVideos.length);
          url = sampleVideos[randomIndex];
          toast.info("Using sample video as fallback");
        }
        
        if (!url) {
          const randomIndex = Math.floor(Math.random() * sampleVideos.length);
          url = sampleVideos[randomIndex];
          toast.info("Using sample video as fallback");
        }
        
        setStreamUrl(url);
        toast.success(`Stream loaded from ${source.provider}`);
      } catch (error) {
        console.error("Error loading stream:", error);
        // Always provide a fallback URL even on error
        const randomIndex = Math.floor(Math.random() * sampleVideos.length);
        setStreamUrl(sampleVideos[randomIndex]);
        setError("Using fallback stream. Original source failed to load.");
        toast.error("Failed to load stream. Using fallback video.");
      } finally {
        setIsLoading(false);
      }
    };
    
    loadStream();
  }, [source, mediaType, mediaId, title, sampleVideos]);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(e => {
          console.error("Error playing video:", e);
          toast.error("Error playing video. Please try another source.");
        });
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVideoError = () => {
    console.error("Video error occurred, trying fallback");
    // On video error, try a sample video as fallback
    const randomIndex = Math.floor(Math.random() * sampleVideos.length);
    setStreamUrl(sampleVideos[randomIndex]);
    toast.error("Error playing video. Using fallback source.");
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
            onError={handleVideoError}
          >
            <source src={streamUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          <div className="absolute top-4 left-4 bg-black/70 px-3 py-1 rounded-md text-sm">
            {title} ({source.quality}) {error && "- Fallback"}
          </div>
        </>
      ) : (
        <div className="aspect-video flex flex-col items-center justify-center bg-gray-900">
          <p className="text-lg text-red-500">{error || "Failed to load stream"}</p>
          <p className="mt-2">Please try another source</p>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
