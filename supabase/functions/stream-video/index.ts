
// Follow this setup guide to integrate the Deno runtime into your application:
// https://deno.land/manual/examples/deploy_node_server
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

// Simple cache to store magnet links to streamable URLs
// In a real app, you'd use a database or proper caching system
const streamCache = new Map<string, { url: string, expires: number }>();

// Function to extract magnet hash from a magnet link
function extractMagnetHash(magnetUrl: string): string | null {
  const btihMatch = magnetUrl.match(/btih:([a-zA-Z0-9]+)/i);
  return btihMatch ? btihMatch[1].toLowerCase() : null;
}

// Function to simulate debrid service transformation
// In a real app, this would connect to RealDebrid, AllDebrid, or similar services
async function getMagnetStreamUrl(magnetUrl: string, quality: string): Promise<string> {
  const hash = extractMagnetHash(magnetUrl);
  
  if (!hash) {
    throw new Error("Invalid magnet URL");
  }
  
  // Check cache first
  const cacheKey = `${hash}-${quality}`;
  const cached = streamCache.get(cacheKey);
  
  if (cached && cached.expires > Date.now()) {
    return cached.url;
  }
  
  // In a real implementation, this would call a debrid service API
  // For demonstration, we're using sample videos based on quality
  let streamUrl = "";
  
  // Select different sample videos based on quality for demonstration
  switch (quality) {
    case "4K":
      streamUrl = "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4";
      break;
    case "1080p":
      streamUrl = "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
      break;
    case "720p":
      streamUrl = "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
      break;
    default:
      streamUrl = "https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4";
  }
  
  // Cache the result (expires in 1 hour)
  streamCache.set(cacheKey, {
    url: streamUrl,
    expires: Date.now() + 3600000 // 1 hour
  });
  
  return streamUrl;
}

// Function to handle directplay from providers like YTS
async function getDirectStreamUrl(url: string, provider: string, quality: string): Promise<string> {
  // For YTS, try to get the direct download link
  if (provider === "YTS") {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (response.ok) {
        const html = await response.text();
        
        // Try to extract the direct download link
        const regex = new RegExp(`href="(https://[^"]+${quality}[^"]+)"`);
        const match = html.match(regex);
        
        if (match && match[1]) {
          return match[1];
        }
      }
    } catch (error) {
      console.error("Error getting direct stream:", error);
    }
  }
  
  // Fallback to debrid-like streaming
  return getMagnetStreamUrl(url, quality);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { provider, quality, mediaType, mediaId, url } = await req.json();
    
    if (!provider || !quality || !mediaType || !mediaId || !url) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
    
    // Get a streamable URL based on the source
    let streamUrl;
    
    if (url.startsWith("magnet:")) {
      // Process magnet link through debrid-like service
      streamUrl = await getMagnetStreamUrl(url, quality);
    } else {
      // Try direct streaming for supported providers
      streamUrl = await getDirectStreamUrl(url, provider, quality);
    }
    
    return new Response(
      JSON.stringify({ 
        streamUrl,
        message: `Successfully generated stream from ${provider} in ${quality}`
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});
