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

// Function to generate fallback/demo torrent sources
function generateFallbackSources(title: string, isMovie: boolean): TorrentSource[] {
  console.log("Generating fallback sources for:", title);
  const qualities = ["4K", "1080p", "720p", "480p"];
  const providers = ["YTS", "RARBG", "1337x", "ThePirateBay"];
  const sources: TorrentSource[] = [];
  
  qualities.forEach((quality, qIndex) => {
    providers.forEach((provider, pIndex) => {
      sources.push({
        title: `${title} ${quality}`,
        seeds: 1000 - (qIndex * 200) + (pIndex * 50),
        url: `magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c&dn=${encodeURIComponent(title)}`,
        quality,
        size: quality === "4K" ? "8.2 GB" : quality === "1080p" ? "4.3 GB" : quality === "720p" ? "2.1 GB" : "1.3 GB",
        provider
      });
    });
  });
  
  return sources;
}

// Function to fetch torrent sources for a movie
async function fetchMovieTorrents(title: string, year: string): Promise<TorrentSource[]> {
  console.log("Fetching movie torrents for:", title, year);
  // Try to fetch real torrent data here
  // For now, return fallback sources to ensure the app functions
  return generateFallbackSources(`${title} (${year})`, true);
}

// Function to fetch torrent sources for a TV episode
async function fetchTVTorrents(
  title: string, 
  seasonNumber: number, 
  episodeNumber: number
): Promise<TorrentSource[]> {
  console.log("Fetching TV torrents for:", title, `S${seasonNumber}E${episodeNumber}`);
  // Try to fetch real torrent data here
  // For now, return fallback sources to ensure the app functions
  const formattedSeason = seasonNumber.toString().padStart(2, '0');
  const formattedEpisode = episodeNumber.toString().padStart(2, '0');
  return generateFallbackSources(`${title} S${formattedSeason}E${formattedEpisode}`, false);
}

// Filter sources to remove duplicates and sort by seeds
function processSourceResults(sources: TorrentSource[]): TorrentSource[] {
  // Remove any source with 0 seeds
  sources = sources.filter(source => source.seeds > 0);
  
  // Sort by seeds (highest first)
  sources.sort((a, b) => b.seeds - a.seeds);
  
  // Keep only the top 10 sources
  return sources.slice(0, 10);
}

serve(async (req) => {
  console.log("Received torrent-scraper request");
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  try {
    const requestBody = await req.json();
    console.log("Request body:", requestBody);
    
    const { mediaType, mediaId, seasonNumber, episodeNumber } = requestBody;
    
    // Validate required parameters
    if (!mediaType || !mediaId) {
      console.error("Missing required parameters:", requestBody);
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
    
    // Fetch sources based on media type
    let sources: TorrentSource[] = [];
    
    if (mediaType === "movie") {
      // For demo purposes, use a hardcoded title and year
      // In a real app, you would fetch this from TMDB API
      const title = `Movie ${mediaId}`;
      const year = "2023";
      sources = await fetchMovieTorrents(title, year);
    } else if (mediaType === "tv" && seasonNumber !== undefined && episodeNumber !== undefined) {
      // For demo purposes, use a hardcoded title
      // In a real app, you would fetch this from TMDB API
      const title = `TV Show ${mediaId}`;
      sources = await fetchTVTorrents(title, seasonNumber, episodeNumber);
    }
    
    // Process and return the fetched sources
    const processedSources = processSourceResults(sources);
    console.log("Returning sources count:", processedSources.length);
    
    // Always ensure we have sources, even if empty
    return new Response(
      JSON.stringify({ sources: processedSources.length > 0 ? processedSources : generateFallbackSources("Fallback Content", mediaType === "movie") }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error) {
    console.error("Error in torrent-scraper function:", error);
    // Even on error, return some fallback sources so the app doesn't break
    return new Response(
      JSON.stringify({ 
        sources: generateFallbackSources("Error Fallback", true),
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 // Return 200 even on error
      }
    );
  }
});
