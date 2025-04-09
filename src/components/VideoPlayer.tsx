
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { TorrentSource } from "@/types";
import { FaSpinner, FaPlay, FaDownload, FaUsers, FaInfoCircle, FaExclamationTriangle, FaRedo, FaVideo } from 'react-icons/fa';

// Torrent API base URL (our local server)
const TORRENT_API_URL = "http://localhost:3001/api/torrent";

interface VideoPlayerProps {
  title: string;
  source: TorrentSource;
  mediaType: "movie" | "tv";
  mediaId: number;
}

const VideoPlayer = ({ title, source, mediaType, mediaId }: VideoPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const [peersCount, setPeersCount] = useState(0);
  const [downloadedSize, setDownloadedSize] = useState("0 MB");
  const [useDemoVideo, setUseDemoVideo] = useState(false);
  const [infoHash, setInfoHash] = useState<string | null>(null);
  const [downloadStats, setDownloadStats] = useState({
    progress: 0,
    downloadSpeed: 0,
    peers: 0,
    timeRemaining: 0,
    downloadedSize: 0
  });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const isMountedRef = useRef<boolean>(true);
  const statusIntervalRef = useRef<number | null>(null);
  const retryCountRef = useRef<number>(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const MIN_BYTES_FOR_PLAYBACK = 1024 * 1024; // At least 1MB before trying to play

  // Format bytes to human-readable format
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Format speed to human-readable format
  const formatSpeed = (bytesPerSecond: number) => {
    return `${formatBytes(bytesPerSecond)}/s`;
  };

  // Extract info hash from magnet URI
  const extractInfoHash = (magnetUri: string): string | null => {
    if (!magnetUri) return null;
    
    // If it's a 40-char hex string, it's already an info hash
    if (/^[a-f0-9]{40}$/i.test(magnetUri)) {
      return magnetUri.toLowerCase();
    }
    
    // Extract from magnet URI
    const match = magnetUri.match(/urn:btih:([a-f0-9]{40})/i);
    if (match) {
      return match[1].toLowerCase();
    }
    
    return null;
  };

  // Start downloading torrent and get stream URL
  const startTorrentDownload = async () => {
    try {
      if (!source.url) {
        setError("No video source provided");
        setIsLoading(false);
        return;
      }

      // Reset states
      setError(null);
      setIsLoading(true);
      setProgress(0);
      setPeersCount(0);
      setDownloadSpeed(0);
      setDownloadedSize('0 MB');
      setUseDemoVideo(false);

      console.log(`Starting download for: ${source.url}`);
      toast.loading(`Preparing download from ${source.provider || 'torrent source'}...`);

      // Extract infoHash from magnet URI (to use later for status checks)
      const hash = extractInfoHash(source.url);
      if (hash) {
        console.log("Extracted infoHash:", hash);
        setInfoHash(hash);
      } else {
        console.warn("Could not extract infoHash from magnet URI");
      }

      // Start the download via our API
      console.log(`Sending request to ${TORRENT_API_URL}/download with magnet link`);
      
      try {
        const response = await fetch(`${TORRENT_API_URL}/download`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            magnetUri: source.url,
          }),
        });

        console.log("Download request response status:", response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("Error response:", errorText);
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch (e) {
            errorData = { error: errorText || 'Unknown server error' };
          }
          throw new Error(errorData.error || `Server error: ${response.status}`);
        }

        const data = await response.json();
        console.log("Download response data:", data);
        
        if (!data.success || !data.data) {
          throw new Error('Invalid response from server');
        }

        // We have started the download, now setup the status checking
        const downloadInfo = data.data;
        setInfoHash(downloadInfo.infoHash);

        toast.dismiss();
        toast.success('Started downloading the video');

        // Start polling for status - video player will be set up once we reach minimum progress
        startStatusPolling(downloadInfo.infoHash);
        
        // Note: Video player setup has been moved to status polling
        // to wait for minimum download progress
      } catch (fetchError) {
        console.error("Fetch error:", fetchError);
        throw new Error(`Network error: ${fetchError.message}`);
      }
    } catch (error: any) {
      console.error('Error starting torrent download:', error);
      setError(`Failed to start download: ${error.message}`);
      setIsLoading(false);
      toast.error('Failed to start download');
      
      // Try demo video after a failed download attempt
      setTimeout(() => {
        if (isMountedRef.current && error) {
          playDemoVideo();
        }
      }, 3000);
    }
  };

  // Test if we can directly access the file
  const testDirectFileAccess = async (hash: string): Promise<number> => {
    try {
      // Try a HEAD request to see if the stream is available
      const response = await fetch(`${TORRENT_API_URL}/stream/${hash}`, {
        method: 'HEAD'
      });
      
      if (response.ok) {
        const contentLength = response.headers.get('Content-Length');
        if (contentLength) {
          const bytes = parseInt(contentLength, 10);
          console.log(`Stream endpoint reports file size: ${formatBytes(bytes)}`);
          return bytes;
        }
      }
      
      console.log(`Stream endpoint not ready yet: ${response.status}`);
      return 0;
    } catch (error) {
      console.error('Error testing direct file access:', error);
      return 0;
    }
  };

  // Start polling for torrent status
  const startStatusPolling = (hash: string) => {
    // Clear any existing interval
    if (statusIntervalRef.current) {
      window.clearInterval(statusIntervalRef.current);
    }

    let videoSetupDone = false;
    const MIN_PROGRESS_FOR_PLAYBACK = 2; // Minimum 2% download before trying to play
    const MIN_FILE_SIZE_MB = 5; // Or at least 5MB of data
    const MIN_FILE_SIZE_BYTES = MIN_FILE_SIZE_MB * 1024 * 1024;

    // Set up polling every second
    statusIntervalRef.current = window.setInterval(async () => {
      if (!isMountedRef.current) {
        clearStatusPolling();
        return;
      }

      try {
        // Use direct file access test as a fallback if status API is unreliable
        const fileBytes = await testDirectFileAccess(hash);
        const hasEnoughDirectData = fileBytes >= MIN_FILE_SIZE_BYTES;
        
        if (hasEnoughDirectData && !videoSetupDone) {
          console.log(`Direct file test shows enough data for playback: ${formatBytes(fileBytes)}`);
          setupVideoPlayer(hash);
          videoSetupDone = true;
          return;
        }
        
        // Continue with normal status check
        const response = await fetch(`${TORRENT_API_URL}/status/${hash}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch torrent status');
        }
        
        const statusData = await response.json();
        console.log('Full status:', statusData);
        
        // Calculate MB from bytes for logging
        const downloadedMB = statusData.downloadedBytes / (1024 * 1024);
        console.log(`Downloaded: ${downloadedMB.toFixed(2)}MB (${statusData.progress}%)`);
        
        // Update UI with download stats
        setDownloadStats({
          progress: statusData.progress,
          downloadSpeed: statusData.downloadSpeed,
          peers: statusData.numPeers,
          timeRemaining: statusData.timeRemaining,
          downloadedSize: statusData.downloadedBytes
        });
        
        // Check if we have enough data to start playing
        const hasEnoughProgress = statusData.progress >= MIN_PROGRESS_FOR_PLAYBACK;
        const hasEnoughData = statusData.downloadedBytes >= MIN_FILE_SIZE_BYTES;
        
        // Set video source when enough content has been downloaded
        if ((hasEnoughProgress || hasEnoughData) && !videoSetupDone) {
          console.log(`Setting up video player. Progress: ${statusData.progress}%, Downloaded: ${downloadedMB.toFixed(2)}MB`);
          setupVideoPlayer(hash);
          videoSetupDone = true;
        }
      } catch (error) {
        console.error('Error checking torrent status:', error);
        // Don't clear interval on error, just continue trying
      }
    }, 1000);
  };

  // Clear status polling interval
  const clearStatusPolling = () => {
    if (statusIntervalRef.current) {
      window.clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = null;
    }
  };

  // Function to test if a stream is available
  const testStreamAvailability = async (streamUrl: string): Promise<boolean> => {
    try {
      // Add a timestamp to prevent caching
      const url = `${streamUrl}?t=${Date.now()}`;
      
      // Make a HEAD request to get headers without downloading content
      const response = await fetch(url, { 
        method: 'HEAD',
        headers: {
          'Range': 'bytes=0-0' // Just request the first byte to check availability
        }
      });
      
      // If we get a 206 Partial Content response, the stream is available
      if (response.status === 206) {
        // Parse Content-Range header to see how much data is available
        const contentRange = response.headers.get('Content-Range');
        console.log(`Stream test successful. Content-Range: ${contentRange}`);
        
        if (contentRange) {
          // Format is "bytes 0-0/TOTAL"
          const total = contentRange.split('/')[1];
          const availableBytes = parseInt(total, 10);
          
          console.log(`Available bytes: ${formatBytes(availableBytes)}`);
          
          // Check if we have enough data to start playback
          if (availableBytes >= MIN_BYTES_FOR_PLAYBACK) {
            console.log(`Sufficient data available for playback (${formatBytes(MIN_BYTES_FOR_PLAYBACK)} minimum)`);
            return true;
          } else {
            console.log(`Insufficient data for smooth playback: ${formatBytes(availableBytes)} < ${formatBytes(MIN_BYTES_FOR_PLAYBACK)}`);
            return false;
          }
        }
        
        return true; // If we can't determine size, assume it's OK
      }
      
      console.log(`Stream test failed with status: ${response.status}`);
      return false;
    } catch (error) {
      console.error('Error testing stream:', error);
      return false;
    }
  };

  // Stream a file from a torrent
  const setupVideoPlayer = (hash: string) => {
    if (!videoRef.current) {
      setError('Video player not found');
      setIsLoading(false);
      return;
    }

    const streamUrl = `${TORRENT_API_URL}/stream/${hash}`;
    console.log(`Setting up video with stream URL: ${streamUrl}`);

    // First check if the server is accessible
    fetch(`${TORRENT_API_URL}/status/${hash}`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }
        return response.json();
      })
      .then(async data => {
        if (!data.success) {
          throw new Error('Invalid response from server');
        }
        
        // Even if data.data is incomplete, continue as long as we have a valid response
        const statusData = data.data || {};
        console.log('Torrent status:', statusData);
        
        // Get the file extension to decide if we need special handling
        const fileName = statusData.videoFile?.name || '';
        const fileExt = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
        const isMkv = fileExt === '.mkv';
        
        if (isMkv) {
          console.log('MKV file detected, using specialized handling');
        }
        
        // Test if the stream is available before setting the source
        const isStreamAvailable = await testStreamAvailability(streamUrl);
        if (!isStreamAvailable) {
          console.log('Stream not ready yet, will retry in 2 seconds');
          setTimeout(() => {
            if (isMountedRef.current) {
              setupVideoPlayer(hash);
            }
          }, 2000);
          return;
        }
        
        // Directly set the video source - don't test the stream URL first
        // The stream endpoint will serve what's available and the browser will handle buffering
        console.log('Stream test passed, setting up video element with stream URL');
        
        // Add timestamp to prevent caching
        const timestampedUrl = `${streamUrl}?t=${Date.now()}`;
        videoRef.current.src = timestampedUrl;
        
        // For MKV files, try to set the MIME type explicitly
        if (isMkv && videoRef.current.canPlayType('video/x-matroska')) {
          console.log('Browser supports MKV playback');
        } else if (isMkv) {
          console.log('Browser may not support native MKV playback, will rely on server transcoding');
        }
        
        // Handle video events with more detailed debugging
        videoRef.current.addEventListener('loadeddata', () => {
          console.log('Video data loaded successfully');
          setIsLoading(false);
        });

        videoRef.current.addEventListener('waiting', () => {
          console.log('Video is waiting for more data');
          // Always let the video buffer if we're waiting for data
          setIsLoading(true);
        });
        
        videoRef.current.addEventListener('playing', () => {
          console.log('Video is playing');
          setIsLoading(false);
        });

        videoRef.current.addEventListener('error', (e) => {
          const videoError = videoRef.current?.error;
          const errorCode = videoError?.code || 0;
          const errorMessage = videoError?.message || 'Unknown error';
          
          // Log detailed error information
          console.error('Video element error event:', e);
          console.error(`Video error (${errorCode}): ${errorMessage}`);
          
          // Map error codes to more helpful messages
          const errorMessages = {
            1: 'Video loading aborted',
            2: 'Network error while loading video',
            3: 'Video decoding failed - file may be corrupted',
            4: 'Video format not supported by browser'
          };
          
          const detailedError = errorMessages[errorCode as keyof typeof errorMessages] || errorMessage;
          console.error(`Detailed error: ${detailedError}`);
          
          // If the video isn't ready yet (file not yet created), we'll retry
          if (retryCountRef.current < 10) {
            retryCountRef.current++;
            
            console.log(`Video not ready yet, retry ${retryCountRef.current}/10 in 2 seconds...`);
            
            // For each retry, check if the file is actually growing
            fetch(`${TORRENT_API_URL}/status/${hash}`)
              .then(resp => resp.json())
              .then(statusResp => {
                if (statusResp.success && statusResp.data) {
                  const status = statusResp.data;
                  console.log(`File status before retry: Progress ${status.progress}%, Size: ${status.downloaded}`);
                }
              })
              .catch(err => console.error('Error checking status before retry:', err))
              .finally(() => {
                // Add a timestamp to force a fresh request
                setTimeout(() => {
                  if (videoRef.current) {
                    // Add a cache-busting parameter
                    videoRef.current.src = `${streamUrl}?t=${Date.now()}`;
                    videoRef.current.load();
                  }
                }, 2000);
              });
          } else {
            console.log('Max retries reached, falling back to demo video');
            // Set error message based on the detailed error
            setError(`Playback failed: ${detailedError}`);
            playDemoVideo();
          }
        });

        videoRef.current.addEventListener('play', () => {
          if (isMountedRef.current) setIsPlaying(true);
        });
        
        videoRef.current.addEventListener('pause', () => {
          if (isMountedRef.current) setIsPlaying(false);
        });

        // Start loading the video
        videoRef.current.load();
      })
      .catch(error => {
        console.error('Error setting up video:', error);
        setError(`Failed to connect to torrent server: ${error.message}`);
        setIsLoading(false);
        
        // Auto-fallback to demo video after 3 seconds
        setTimeout(() => {
          if (isMountedRef.current) {
            playDemoVideo();
          }
        }, 3000);
      });
  };

  // Retry downloading torrent
  const retryLoadTorrent = () => {
    setError(null);
    retryCountRef.current = 0;
    startTorrentDownload();
  };

  // Function to play a demo video when download fails
  const playDemoVideo = () => {
    console.log("Playing demo video directly");
    
    // Clear any active status polling
    clearStatusPolling();
    
    // Reset UI states
    setIsLoading(true);
    setError(null);
    setUseDemoVideo(true);
    
    // Define high-quality demo videos that should work in any modern browser
    const demoVideos = {
      movie: [
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
      ],
      tv: [
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4'
      ]
    };
    
    // Choose a demo video based on media type
    const videoUrl = demoVideos[mediaType][Math.floor(Math.random() * 2)];
    console.log("Selected demo video URL:", videoUrl);
    
    if (videoRef.current) {
      // Configure video element
      videoRef.current.src = videoUrl;
      
      // Add event listeners
      const canPlayHandler = () => {
        console.log("Demo video can play now");
        setIsLoading(false);
        toast.success("Playing demo video");
        
        // Auto-play
        videoRef.current?.play()
          .then(() => setIsPlaying(true))
          .catch((error) => {
            console.error("Auto-play prevented:", error);
            toast.warning("Click play to start the video");
            setIsLoading(false);
          });
          
        // Remove the event listener after it fires once
        videoRef.current?.removeEventListener('canplay', canPlayHandler);
      };
      
      const errorHandler = (e: any) => {
        console.error("Video error:", e);
        // Try the other video in the array as fallback
        const fallbackUrl = demoVideos[mediaType][Math.floor(Math.random() * 2)];
        if (fallbackUrl !== videoUrl && videoRef.current) {
          console.log("Trying fallback video:", fallbackUrl);
          videoRef.current.src = fallbackUrl;
        } else {
          setError("Could not play demo video. Please try refreshing the page.");
          setIsLoading(false);
        }
      };
      
      // Set up event handlers
      videoRef.current.addEventListener('canplay', canPlayHandler);
      videoRef.current.addEventListener('error', errorHandler);
      
      // Start loading the video
      videoRef.current.load();
    } else {
      setError("Video player not found");
      setIsLoading(false);
    }
  };

  // Initialize download on component mount or when source changes
  useEffect(() => {
    isMountedRef.current = true;
    retryCountRef.current = 0;
    
    console.log("Source changed, starting new download:", source.url);
    startTorrentDownload();
    
    // Cleanup on unmount or source change
    return () => {
      isMountedRef.current = false;
      clearStatusPolling();
      
      // If we have an infoHash, tell the server we're done with this download
      if (infoHash) {
        fetch(`${TORRENT_API_URL}/download/${infoHash}`, {
          method: 'DELETE'
        }).catch(err => console.error('Error cleaning up download:', err));
      }
    };
  }, [source.url]); // Re-run when source URL changes

  return (
    <div className="w-full rounded-lg overflow-hidden bg-black relative border-4 border-red-500">
      <div className="text-center py-2 bg-red-500 text-white text-sm font-bold">VIDEO PLAYER CONTAINER</div>
      {isLoading ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-80 z-10 p-4">
          <FaSpinner className="animate-spin text-5xl text-primary mb-4" />
          <h3 className="text-white text-xl font-semibold mb-2">
            {progress === 0 ? 'Connecting to Torrent Network' :
             progress < 2 ? 'Initializing Download' :
             'Buffering Video'}
          </h3>
          <p className="text-gray-300 text-center mb-4">
            {progress === 0 
              ? `Searching for ${title} on torrent network...` 
              : progress < 2
                ? `Downloading initial data (${progress}%)... Video will start at 2%`
                : `Loading ${title}... (${progress}%)`}
          </p>
          
          <div className="w-full max-w-md bg-gray-700 rounded-full h-2.5 mb-4">
            <div className="bg-primary h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
          </div>
          
          <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-300">
            {progress > 0 && (
              <div className="flex items-center">
                <FaDownload className="mr-2 text-primary" />
                <span>{downloadedSize} ({progress}%)</span>
              </div>
            )}
            
            <div className="flex items-center">
              <FaUsers className="mr-2 text-primary" />
              <span>{peersCount} {peersCount === 1 ? 'peer' : 'peers'}</span>
            </div>
            
            {downloadSpeed > 0 && (
              <div className="flex items-center">
                <FaDownload className="mr-2 text-primary" />
                <span>{formatSpeed(downloadSpeed)}</span>
              </div>
            )}
          </div>
          
          {/* Progress indicator and threshold markers */}
          {progress > 0 && (
            <div className="w-full max-w-md mt-4 relative">
              <div className="h-6 w-full bg-transparent relative">
                {/* 2% marker */}
                <div className="absolute h-6 left-[2%] border-l border-green-500 z-10">
                  <span className="absolute top-6 left-0 transform -translate-x-1/2 text-xs text-green-500">2%</span>
                </div>
                {/* 5% marker */}
                <div className="absolute h-6 left-[5%] border-l border-green-500 z-10">
                  <span className="absolute top-6 left-0 transform -translate-x-1/2 text-xs text-green-500">5%</span>
                </div>
                {/* 10% marker */}
                <div className="absolute h-6 left-[10%] border-l border-yellow-500 z-10">
                  <span className="absolute top-6 left-0 transform -translate-x-1/2 text-xs text-yellow-500">10%</span>
                </div>
                
                <span className="absolute bottom-8 left-[2%] text-xs text-green-500 transform -translate-x-1/2">
                  Playback Starts
                </span>
                <span className="absolute bottom-8 left-[10%] text-xs text-yellow-500 transform -translate-x-1/2">
                  Smooth Streaming
                </span>
              </div>
            </div>
          )}
          
          {/* Show server connection info */}
          <div className="mt-6 text-xs text-gray-400">
            Connecting to: {TORRENT_API_URL}
          </div>
        </div>
      ) : error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-80 z-10 p-4">
          <FaExclamationTriangle className="text-5xl text-yellow-500 mb-4" />
          <h3 className="text-white text-xl font-semibold mb-2">Playback Error</h3>
          <p className="text-red-400 text-center mb-6 max-w-md">{error}</p>
          
          <div className="flex gap-3 mb-6">
            <button 
              onClick={retryLoadTorrent}
              className="flex items-center gap-2 bg-primary hover:bg-primary/80 text-white px-6 py-2 rounded-md transition-colors"
            >
              <FaRedo /> Retry
            </button>
            
            {/* Link to try different episode or source */}
            {mediaType === 'tv' && (
              <a 
                href={`/tv/${mediaId}`}
                className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-md transition-colors"
              >
                Try Different Episode
              </a>
            )}
            
            {/* New button for demo video */}
            <button 
              onClick={playDemoVideo}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md transition-colors"
            >
              <FaPlay /> Try Demo Video
            </button>
          </div>
          
          <div className="text-gray-400 text-sm mt-2 max-w-md text-center space-y-2">
            <p className="pb-2 border-b border-gray-700">
              <FaInfoCircle className="inline mr-1" /> 
              If the problem persists, try a different source or check your connection.
            </p>
            
            <ul className="text-xs text-left space-y-1 mt-2">
              <li>• Ensure the torrent server is running (npm run server)</li>
              <li>• Make sure the server is accessible at {TORRENT_API_URL}</li>
              <li>• This torrent might not have active peers currently</li>
              <li>• Try refreshing the page or choosing a different source</li>
            </ul>
            
            {/* Debug info */}
            <div className="mt-4 pt-2 border-t border-gray-700 text-xs text-left">
              <p className="font-semibold">Debug info:</p>
              <p>Source: {source.provider || 'Unknown'}</p>
              <p>Info hash: {infoHash || 'Not available'}</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            className="w-full aspect-video"
            controls
            playsInline
          >
            Your browser does not support the video tag.
          </video>
          
          {/* Status overlay */}
          <div className="absolute top-4 right-4 bg-black/70 px-3 py-2 rounded-md text-sm flex gap-2 items-center">
            <div className="flex items-center">
              <FaVideo className="mr-2 text-primary" />
              <span className="text-white mr-2">{title}</span>
            </div>
            
            {progress < 100 && !useDemoVideo && (
              <>
                <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="bg-primary h-2 transition-all duration-300" 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <span className="text-white">{progress}%</span>
              </>
            )}
            
            {useDemoVideo && (
              <span className="text-yellow-400 text-xs">(Demo Video)</span>
            )}
          </div>
          
          {/* Peer and download info overlay */}
          {progress < 100 && !useDemoVideo && (
            <div className="absolute bottom-4 left-4 bg-black/70 px-3 py-2 rounded-md text-sm text-white">
              <div className="flex items-center gap-4">
                <div className="flex items-center">
                  <FaUsers className="mr-1 text-primary" />
                  <span>{peersCount}</span>
                </div>
                <div className="flex items-center">
                  <FaDownload className="mr-1 text-primary" />
                  <span>{formatSpeed(downloadSpeed)}</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      
      {/* Server status indicator */}
      <div className="absolute top-0 left-0 m-1 px-2 py-1 text-xs rounded-md bg-black/70 text-gray-300">
        Torrent server: {infoHash ? 'Connected' : 'Connecting...'}
      </div>
    </div>
  );
};

export default VideoPlayer;
