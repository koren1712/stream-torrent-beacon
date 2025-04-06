
// Follow this setup guide to integrate the Deno runtime into your application:
// https://deno.land/manual/examples/deploy_node_server
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface TorrentSource {
  title: string;
  seeds: number;
  url: string;
  quality: string;
  size: string;
  provider: string;
}

const MOCK_PROVIDERS = [
  "YTS", "EZTV", "RARBG", "1337x", "ThePirateBay", "KickassTorrents", 
  "TorrentGalaxy", "MagnetDL", "HorribleSubs", "NyaaSi", "TokyoTosho"
];

// In a real implementation, this would connect to actual torrent sites
// For demonstration purposes, we're generating mock data
function generateMockTorrentSources(
  mediaType: string,
  mediaId: number,
  seasonNumber?: number,
  episodeNumber?: number
): TorrentSource[] {
  // Generate different qualities
  const qualities = ["4K", "1080p", "720p", "480p"];
  const providers = [...MOCK_PROVIDERS].sort(() => Math.random() - 0.5).slice(0, 4);
  
  return qualities.map((quality, index) => {
    const sizeMap: Record<string, string> = {
      "4K": "15.4 GB",
      "1080p": "4.2 GB",
      "720p": "1.8 GB",
      "480p": "950 MB"
    };
    
    // Generate title based on media type
    let title = `${quality} ${providers[index]}`;
    if (mediaType === "tv" && seasonNumber && episodeNumber) {
      title += ` S${seasonNumber.toString().padStart(2, '0')}E${episodeNumber.toString().padStart(2, '0')}`;
    }
    
    return {
      title,
      seeds: Math.floor(Math.random() * 2000) + 100,
      url: "#",
      quality,
      size: sizeMap[quality],
      provider: providers[index]
    };
  });
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  try {
    const { mediaType, mediaId, seasonNumber, episodeNumber } = await req.json();
    
    // Validate required parameters
    if (!mediaType || !mediaId) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
    
    // In a real implementation, this would connect to actual torrent sites
    // For demonstration, we generate mock data
    const sources = generateMockTorrentSources(
      mediaType, 
      mediaId, 
      seasonNumber, 
      episodeNumber
    );
    
    // Return the fetched sources
    return new Response(
      JSON.stringify({ sources }),
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
