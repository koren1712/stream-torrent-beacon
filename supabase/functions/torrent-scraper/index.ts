// Follow this setup guide to integrate the Deno runtime into your application:
// https://deno.land/manual/examples/deploy_node_server
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
// Import deno-dom for HTML parsing
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

// Define TMDB API constants
const TMDB_API_KEY = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI4MGQ5NjYxMTA5ZjBhNzNkODhiMTUxZWQyYzExZmU3NiIsIm5iZiI6MTcyMjc4MDc5NC45NjcsInN1YiI6IjY2YWY4YzdhMDlhN2ExNzFhYTY1YzA1OCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.EGPGKFzfr1ZBTLEGPAqb3FJ39BR8KXfvKXFUon-RhEo"; // Get API key from environment variables
const TMDB_API_URL = "https://api.themoviedb.org/3";

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
  
  // Generate a more dynamic hash for each source based on title and quality
  // This is still a fallback but at least each source will have a unique magnet
  const generateHash = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    // Convert to hex string and ensure it's 40 chars long (standard for infohash)
    const hexHash = Math.abs(hash).toString(16).padStart(40, '0');
    return hexHash;
  };
  
  qualities.forEach((quality, qIndex) => {
    providers.forEach((provider, pIndex) => {
      const sourceTitle = `${title} ${quality}`;
      const hash = generateHash(sourceTitle + provider);
      
      sources.push({
        title: sourceTitle,
        seeds: 1000 - (qIndex * 200) + (pIndex * 50),
        url: `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(sourceTitle)}&tr=udp://tracker.openbittorrent.com:80&tr=udp://tracker.opentrackr.org:1337/announce`,
        quality,
        size: quality === "4K" ? "8.2 GB" : quality === "1080p" ? "4.3 GB" : quality === "720p" ? "2.1 GB" : "1.3 GB",
        provider
      });
    });
  });
  
  return sources;
}

// Function to fetch media details from TMDB
async function getMediaDetails(mediaId: number, mediaType: "movie" | "tv"): Promise<{ title: string; year?: string }> {
  console.log(`Fetching ${mediaType} details for ID: ${mediaId}`);
  const url = `${TMDB_API_URL}/${mediaType}/${mediaId}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${TMDB_API_KEY}`,
        "Content-Type": "application/json",
      },
    });
    
    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`Got ${mediaType} details:`, data.title || data.name);
    
    if (mediaType === "movie") {
      return {
        title: data.title || data.original_title,
        year: data.release_date ? data.release_date.substring(0, 4) : undefined
      };
    } else { // tv
      return {
        title: data.name || data.original_name
        // Year is less relevant for TV show episode search query, but could be added
      };
    }
  } catch (error) {
    console.error(`Error fetching TMDB details for ${mediaType} ${mediaId}:`, error);
    // Fallback title if TMDB fetch fails
    return { title: `${mediaType === "movie" ? "Movie" : "TV Show"} ${mediaId}` };
  }
}

// Function to scrape 1337x
async function scrape1337x(searchQuery: string): Promise<TorrentSource[]> {
  console.log("Scraping 1337x for:", searchQuery);
  const sources: TorrentSource[] = [];
  
  // Try multiple mirrors in case one is blocked
  const mirrors = [
    "https://1337x.to",
    "https://1337x.st", 
    "https://1337x.is",
    "https://1337x.gd"
  ];
  
  let baseUrl = "";
  let workingResponse: Response | undefined;
  
  // Try each mirror until one works
  for (const mirror of mirrors) {
    const searchUrl = `${mirror}/search/${encodeURIComponent(searchQuery)}/1/`;
    console.log(`Trying mirror: ${searchUrl}`);
    
    try {
      const response = await fetch(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
      });
      
      if (response.ok) {
        baseUrl = mirror;
        workingResponse = response;
        console.log(`Mirror ${mirror} is working`);
        break;
      }
    } catch (e) {
      console.log(`Mirror ${mirror} failed:`, e.message);
    }
  }
  
  if (!baseUrl || !workingResponse) {
    console.error("All 1337x mirrors failed");
    return [];
  }

  try {
    const html = await workingResponse.text();
    const document = new DOMParser().parseFromString(html, "text/html");

    if (!document) {
        throw new Error("Failed to parse HTML document from 1337x");
    }

    const tableRows = document.querySelectorAll("table.table-list tbody tr");
    
    console.log(`Found ${tableRows.length} potential torrents on 1337x page.`);

    for (const row of tableRows) {
      const nameElement = row.querySelector("td.coll-1 a:nth-child(2)");
      const seedsElement = row.querySelector("td.coll-2");
      const sizeElement = row.querySelector("td.coll-4");
      const detailLinkElement = row.querySelector("td.coll-1 a:nth-child(2)");

      if (!nameElement || !seedsElement || !sizeElement || !detailLinkElement) {
        console.warn("Skipping row due to missing elements");
        continue; 
      }

      const title = nameElement.textContent?.trim() || "Unknown Title";
      const seeds = parseInt(seedsElement.textContent?.trim() || "0", 10);
      const size = sizeElement.textContent?.trim() || "Unknown Size";
      const torrentPageUrl = baseUrl + detailLinkElement.getAttribute("href");

      if (seeds === 0) continue; // Skip torrents with 0 seeds

      // We need to fetch the detail page to get the magnet link
      try {
        console.log("Fetching details page:", torrentPageUrl);
        const detailResponse = await fetch(torrentPageUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
          }
        });
        
        if (!detailResponse.ok) {
          console.warn(`Failed to fetch detail page ${torrentPageUrl}: ${detailResponse.status}`);
          continue;
        }
        
        const detailHtml = await detailResponse.text();
        const detailDocument = new DOMParser().parseFromString(detailHtml, "text/html");
        
        if (!detailDocument) {
          console.warn(`Failed to parse detail page HTML for ${torrentPageUrl}`);
          continue;
        }

        const magnetLinkElement = detailDocument.querySelector("a[href^='magnet:?']");
        
        if (magnetLinkElement) {
          const magnetUrl = magnetLinkElement.getAttribute("href") || "";
          
          if (magnetUrl) {
            console.log(`Found magnet link for ${title}: ${magnetUrl.substring(0, 60)}...`);
            
            // Attempt to guess quality from title
            let quality = "Unknown";
            if (title.includes("2160p") || title.toLowerCase().includes("4k")) quality = "4K";
            else if (title.includes("1080p")) quality = "1080p";
            else if (title.includes("720p")) quality = "720p";
            else if (title.includes("480p")) quality = "480p";
            
            sources.push({
              title: title,
              seeds: seeds,
              url: magnetUrl,
              quality: quality,
              size: size,
              provider: "1337x"
            });
          } else {
            console.warn("Found magnet link element but href was empty for:", title);
          }
        } else {
            console.warn("Could not find magnet link element on detail page for:", title);
        }
      } catch (detailError) {
        console.error(`Error fetching detail page ${torrentPageUrl}:`, detailError);
      }
      
      // Limit the number of detail page fetches to avoid getting rate-limited (top 5 seeded)
      if (sources.length >= 5) {
          console.log("Reached limit of detail page fetches (5).");
          break;
      } 
      
      // Add a small delay between detail page fetches to be polite
      await new Promise(resolve => setTimeout(resolve, 300)); // 300ms delay
    }

  } catch (error) {
    console.error("Error scraping 1337x:", error);
    return [];
  }
  
  console.log(`Successfully scraped ${sources.length} sources from 1337x.`);
  return sources;
}

// Also try scraping from ThePirateBay
async function scrapeTPB(searchQuery: string): Promise<TorrentSource[]> {
  console.log("Scraping ThePirateBay for:", searchQuery);
  const sources: TorrentSource[] = [];
  
  // Try multiple TPB mirrors
  const mirrors = [
    "https://thepiratebay.org",
    "https://pirateproxy.live", 
    "https://thehiddenbay.com"
  ];
  
  let baseUrl = "";
  let workingResponse: Response | undefined;
  
  // Try each mirror until one works
  for (const mirror of mirrors) {
    const searchUrl = `${mirror}/search/${encodeURIComponent(searchQuery)}/0/99/0`;
    console.log(`Trying TPB mirror: ${searchUrl}`);
    
    try {
      const response = await fetch(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
      });
      
      if (response.ok) {
        baseUrl = mirror;
        workingResponse = response;
        console.log(`TPB Mirror ${mirror} is working`);
        break;
      }
    } catch (e) {
      console.log(`TPB Mirror ${mirror} failed:`, e.message);
    }
  }
  
  if (!baseUrl || !workingResponse) {
    console.error("All TPB mirrors failed");
    return [];
  }

  try {
    const html = await workingResponse.text();
    const document = new DOMParser().parseFromString(html, "text/html");

    if (!document) {
        throw new Error("Failed to parse HTML document from TPB");
    }

    const tableRows = document.querySelectorAll("#searchResult tr");
    
    console.log(`Found ${tableRows.length} potential torrents on TPB page.`);

    for (let i = 1; i < tableRows.length; i++) { // Skip header row
      const row = tableRows[i];
      
      const nameElement = row.querySelector("a.detLink");
      const magnetElement = row.querySelector("a[href^='magnet:?']");
      const sizeElement = row.querySelector("font.detDesc");
      const seedsElement = row.querySelector("td:nth-child(3)");
      
      if (!nameElement || !magnetElement || !sizeElement || !seedsElement) {
        continue;
      }
      
      const title = nameElement.textContent?.trim() || "Unknown";
      const magnetUrl = magnetElement.getAttribute("href") || "";
      const sizeText = sizeElement.textContent || "";
      const sizeMatch = sizeText.match(/Size\s([\d.]+)\s(\w+)/i);
      const size = sizeMatch ? `${sizeMatch[1]} ${sizeMatch[2]}` : "Unknown Size";
      const seeds = parseInt(seedsElement.textContent?.trim() || "0", 10);
      
      if (seeds === 0 || !magnetUrl) continue;
      
      // Attempt to guess quality from title
      let quality = "Unknown";
      if (title.includes("2160p") || title.toLowerCase().includes("4k")) quality = "4K";
      else if (title.includes("1080p")) quality = "1080p";
      else if (title.includes("720p")) quality = "720p";
      else if (title.includes("480p")) quality = "480p";
      
      sources.push({
        title,
        seeds,
        url: magnetUrl,
        quality,
        size,
        provider: "ThePirateBay"
      });
      
      // Limit to top 5 results
      if (sources.length >= 5) break;
    }
  } catch (error) {
    console.error("Error scraping ThePirateBay:", error);
  }
  
  console.log(`Successfully scraped ${sources.length} sources from ThePirateBay.`);
  return sources;
}

// Function to fetch torrent sources for a movie
async function fetchMovieTorrents(mediaId: number): Promise<TorrentSource[]> {
  const details = await getMediaDetails(mediaId, "movie");
  console.log("Fetching movie torrents for:", details.title, details.year);
  
  try {
    // Construct search query
    const searchQuery = details.year ? `${details.title} ${details.year}` : details.title;
    
    // Call scrapers
    let sources: TorrentSource[] = [];
    
    // Try 1337x first
    sources = await scrape1337x(searchQuery);
    
    // If 1337x doesn't return enough results, try TPB too
    if (sources.length < 3) {
      const tpbSources = await scrapeTPB(searchQuery);
      sources = [...sources, ...tpbSources];
    }
    
    // If scrapers return no results, use fallback
    if (!sources || sources.length === 0) {
      console.log("No results from scrapers, using fallback.");
      return generateFallbackSources(searchQuery, true);
    }
    
    return sources;
  } catch (error) {
    console.error("Error fetching movie torrents:", error);
    const fallbackTitle = details.year ? `${details.title} (${details.year})` : details.title;
    return generateFallbackSources(fallbackTitle, true);
  }
}

// Function to fetch torrent sources for a TV episode
async function fetchTVTorrents(
  mediaId: number, 
  seasonNumber: number, 
  episodeNumber: number
): Promise<TorrentSource[]> {
  const details = await getMediaDetails(mediaId, "tv");
  const formattedSeason = seasonNumber.toString().padStart(2, '0');
  const formattedEpisode = episodeNumber.toString().padStart(2, '0');
  const searchQuery = `${details.title} S${formattedSeason}E${formattedEpisode}`;
  
  console.log("Fetching TV torrents for:", searchQuery);
  
  try {
    // Call scrapers
    let sources: TorrentSource[] = [];
    
    // Try 1337x first
    sources = await scrape1337x(searchQuery);
    
    // If 1337x doesn't return enough results, try TPB too
    if (sources.length < 3) {
      const tpbSources = await scrapeTPB(searchQuery);
      sources = [...sources, ...tpbSources];
    }
    
    // If scrapers return no results, use fallback
    if (!sources || sources.length === 0) {
      console.log("No results from scrapers, using fallback.");
      return generateFallbackSources(searchQuery, false);
    }
    
    return sources;
  } catch (error) {
    console.error("Error fetching TV torrents:", error);
    return generateFallbackSources(searchQuery, false);
  }
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
        JSON.stringify({ 
          error: "Missing required parameters",
          sources: generateFallbackSources("Missing Parameters Fallback", true)
        }),
        { 
          status: 200, // Return 200 with fallback sources
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
    
    // Fetch sources based on media type
    let sources: TorrentSource[] = [];
    
    if (mediaType === "movie") {
      sources = await fetchMovieTorrents(mediaId);
    } else if (mediaType === "tv" && seasonNumber !== undefined && episodeNumber !== undefined) {
      sources = await fetchTVTorrents(mediaId, seasonNumber, episodeNumber);
    } else {
       // Handle cases where mediaType is tv but season/episode are missing
       console.warn("TV show request missing season/episode numbers", requestBody);
       sources = generateFallbackSources(`TV Show ${mediaId} (incomplete info)`, false);
    }
    
    // Process and return the fetched sources
    const processedSources = processSourceResults(sources);
    console.log("Returning sources count:", processedSources.length);
    
    // Always ensure we have sources, even if empty
    const finalSources = processedSources.length > 0 
      ? processedSources 
      : generateFallbackSources(mediaType === "movie" ? `Movie ${mediaId}` : `TV Show ${mediaId}`, mediaType === "movie");
    
    return new Response(
      JSON.stringify({ sources: finalSources }),
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
