
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";

interface VideoPlayerProps {
  title: string;
  source: string;
}

const VideoPlayer = ({ title, source }: VideoPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  // In a real application, this would be a proper stream URL
  // For this demo, we're using a mock URL
  const videoUrl = "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

  useEffect(() => {
    // Simulate loading delay
    const timer = setTimeout(() => {
      setIsLoading(false);
      toast.success(`Stream loaded from ${source}`);
    }, 2000);

    return () => clearTimeout(timer);
  }, [source]);

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
          <p className="mt-4 text-lg">Loading stream from {source}...</p>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            className="w-full aspect-video"
            controls
            autoPlay
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          >
            <source src={videoUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          <div className="absolute top-4 left-4 bg-black/70 px-3 py-1 rounded-md text-sm">
            {title}
          </div>
        </>
      )}
    </div>
  );
};

export default VideoPlayer;
