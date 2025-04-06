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

// List of providers we'll attempt to fetch from
const PROVIDERS = [
  "YTS", "EZTV", "RARBG", "1337x", "ThePirateBay", "KickassTorrents", 
  "TorrentGalaxy", "MagnetDL"
];

// Function to convert filesize to human-readable format
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = -1;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return size.toFixed(1) + ' ' + units[unitIndex];
}

// Function to fetch torrent sources for a movie
async function fetchMovieTorrents(title: string, year: string): Promise<TorrentSource[]> {
  const sources: TorrentSource[] = [];
  const searchQuery = `${encodeURIComponent(title)} ${year}`;
  
  try {
    // 1337x search
    const response1337x = await fetch(`https://1337x.to/search/${searchQuery}/1/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (response1337x.ok) {
      const html = await response1337x.text();
      
      // Extract torrents using regex (in a real app, use a proper HTML parser)
      const regex = /<a href="\/torrent\/([^"]+)">([^<]+)<\/a>.*?<td class="coll-2 seeds">(\d+)<\/td>.*?<td class="coll-4 size mobil">([^<]+)<\/td>/gs;
      
      let match;
      while ((match = regex.exec(html)) !== null) {
        const [, path, rawTitle, seeds, size] = match;
        
        // Determine quality based on title
        let quality = "Unknown";
        if (rawTitle.includes("2160p") || rawTitle.includes("4K")) quality = "4K";
        else if (rawTitle.includes("1080p")) quality = "1080p";
        else if (rawTitle.includes("720p")) quality = "720p";
        else if (rawTitle.includes("480p")) quality = "480p";
        
        sources.push({
          title: rawTitle,
          seeds: parseInt(seeds),
          url: `https://1337x.to/torrent/${path}`,
          quality,
          size,
          provider: "1337x"
        });
      }
    }
    
    // YTS API (they have a public API)
    try {
      const ytsResponse = await fetch(`https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(title)}`);
      
      if (ytsResponse.ok) {
        const data = await ytsResponse.json();
        
        if (data.data.movies && data.data.movies.length > 0) {
          // Filter by year if possible
          const movies = data.data.movies.filter((m: any) => m.year.toString() === year);
          
          if (movies.length > 0) {
            // Take the first match
            const movie = movies[0];
            
            // Add each torrent as a source
            movie.torrents.forEach((torrent: any) => {
              sources.push({
                title: `${movie.title_long} ${torrent.quality}`,
                seeds: torrent.seeds,
                url: torrent.url,
                quality: torrent.quality,
                size: torrent.size,
                provider: "YTS"
              });
            });
          }
        }
      }
    } catch (error) {
      console.error("Error fetching from YTS:", error);
    }
    
  } catch (error) {
    console.error("Error fetching movie torrents:", error);
  }
  
  return sources;
}

// Function to fetch torrent sources for a TV episode
async function fetchTVTorrents(
  title: string, 
  seasonNumber: number, 
  episodeNumber: number
): Promise<TorrentSource[]> {
  const sources: TorrentSource[] = [];
  const formattedSeason = seasonNumber.toString().padStart(2, '0');
  const formattedEpisode = episodeNumber.toString().padStart(2, '0');
  const searchQuery = `${encodeURIComponent(title)} S${formattedSeason}E${formattedEpisode}`;
  
  try {
    // EZTV search
    try {
      const eztvResponse = await fetch(`https://eztv.re/search/${encodeURIComponent(searchQuery)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (eztvResponse.ok) {
        const html = await eztvResponse.text();
        
        // Extract torrents with regex
        const regex = /<a class="magnet"[^>]*href="([^"]+)"[^>]*>.*?<a[^>]*>([^<]+)<\/a>.*?<td[^>]*>([^<]+)<\/td>.*?<td[^>]*>([\d,]+)<\/td>/gs;
        
        let match;
        while ((match = regex.exec(html)) !== null) {
          const [, magnetUrl, rawTitle, size, seeds] = match;
          
          // Determine quality based on title
          let quality = "Unknown";
          if (rawTitle.includes("2160p") || rawTitle.includes("4K")) quality = "4K";
          else if (rawTitle.includes("1080p")) quality = "1080p";
          else if (rawTitle.includes("720p")) quality = "720p";
          else if (rawTitle.includes("480p")) quality = "480p";
          
          sources.push({
            title: rawTitle,
            seeds: parseInt(seeds.replace(/,/g, '')),
            url: magnetUrl,
            quality,
            size,
            provider: "EZTV"
          });
        }
      }
    } catch (error) {
      console.error("Error fetching from EZTV:", error);
    }
    
    // 1337x search for TV shows
    const response1337x = await fetch(`https://1337x.to/search/${searchQuery}/1/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (response1337x.ok) {
      const html = await response1337x.text();
      
      // Extract torrents using regex
      const regex = /<a href="\/torrent\/([^"]+)">([^<]+)<\/a>.*?<td class="coll-2 seeds">(\d+)<\/td>.*?<td class="coll-4 size mobil">([^<]+)<\/td>/gs;
      
      let match;
      while ((match = regex.exec(html)) !== null) {
        const [, path, rawTitle, seeds, size] = match;
        
        // Determine quality based on title
        let quality = "Unknown";
        if (rawTitle.includes("2160p") || rawTitle.includes("4K")) quality = "4K";
        else if (rawTitle.includes("1080p")) quality = "1080p";
        else if (rawTitle.includes("720p")) quality = "720p";
        else if (rawTitle.includes("480p")) quality = "480p";
        
        sources.push({
          title: rawTitle,
          seeds: parseInt(seeds),
          url: `https://1337x.to/torrent/${path}`,
          quality,
          size,
          provider: "1337x"
        });
      }
    }
    
  } catch (error) {
    console.error("Error fetching TV torrents:", error);
  }
  
  return sources;
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
    
    // Fetch sources based on media type
    let sources: TorrentSource[] = [];
    
    if (mediaType === "movie") {
      // First get movie details from TMDB
      const tmdbAPIKey = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI4MGQ5NjYxMTA5ZjBhNzNkODhiMTUxZWQyYzExZmU3NiIsIm5iZiI6MTcyMjc4MDc5NC45NjcsInN1YiI6IjY2YWY4YzdhMDlhN2ExNzFhYTY1YzA1OCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.EGPGKFzfr1ZBTLEGPAqb3FJ39BR8KXfvKXFUon-RhEo";
      const tmdbResponse = await fetch(
        `https://api.themoviedb.org/3/movie/${mediaId}`,
        {
          headers: {
            Authorization: `Bearer ${tmdbAPIKey}`,
            "Content-Type": "application/json",
          },
        }
      );
      
      if (tmdbResponse.ok) {
        const movieData = await tmdbResponse.json();
        const year = movieData.release_date?.substring(0, 4) || "";
        
        // Fetch torrents using the movie title and year
        sources = await fetchMovieTorrents(movieData.title, year);
      }
    } else if (mediaType === "tv" && seasonNumber && episodeNumber) {
      // First get TV show details from TMDB
      const tmdbAPIKey = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI4MGQ5NjYxMTA5ZjBhNzNkODhiMTUxZWQyYzExZmU3NiIsIm5iZiI6MTcyMjc4MDc5NC45NjcsInN1YiI6IjY2YWY4YzdhMDlhN2ExNzFhYTY1YzA1OCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.EGPGKFzfr1ZBTLEGPAqb3FJ39BR8KXfvKXFUon-RhEo";
      const tmdbResponse = await fetch(
        `https://api.themoviedb.org/3/tv/${mediaId}`,
        {
          headers: {
            Authorization: `Bearer ${tmdbAPIKey}`,
            "Content-Type": "application/json",
          },
        }
      );
      
      if (tmdbResponse.ok) {
        const tvData = await tmdbResponse.json();
        
        // Fetch torrents using the TV show name and episode details
        sources = await fetchTVTorrents(tvData.name, seasonNumber, episodeNumber);
      }
    }
    
    // Process and return the fetched sources
    const processedSources = processSourceResults(sources);
    
    // Return the fetched sources
    return new Response(
      JSON.stringify({ sources: processedSources }),
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
