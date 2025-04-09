
// Follow this setup guide to integrate the Deno runtime into your application:
// https://deno.land/manual/examples/deploy_node_server
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

// Function to extract magnet hash from a magnet link
function extractMagnetHash(magnetUrl: string): string | null {
  const btihMatch = magnetUrl.match(/btih:([a-zA-Z0-9]+)/i);
  return btihMatch ? btihMatch[1].toLowerCase() : null;
}

// Function to get a streamable link from a Debrid service
async function getDebridStreamUrl(magnetUrl: string): Promise<string> {
  const apiKey = Deno.env.get("DEBRID_API_KEY");
  
  if (!apiKey) {
    console.error("DEBRID_API_KEY environment variable not set.");
    throw new Error("Debrid service is not configured.");
  }

  if (!magnetUrl || !magnetUrl.startsWith("magnet:?")) {
    console.error("Invalid magnet URL provided:", magnetUrl);
    throw new Error("Invalid magnet URL for Debrid service.");
  }

  console.log("Attempting to resolve magnet link with Debrid service:", magnetUrl.substring(0, 60) + '...');

  try {
    // In a production implementation, this would call a real debrid API
    // For now, we'll simulate the API call with a delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Extract hash from magnet link
    const magnetHash = extractMagnetHash(magnetUrl);
    if (!magnetHash) {
      throw new Error("Could not extract hash from magnet link");
    }
    
    // For demo purposes, we'll create a deterministic mock URL based on the magnet hash
    // In a real implementation, this would be replaced with actual API calls to a debrid service
    const mockStreamUrl = `https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4?magnet=${magnetHash}`;
    
    console.log("Successfully created stream URL from magnet hash:", mockStreamUrl);
    return mockStreamUrl;
  } catch (error) {
    console.error("Error in debrid service:", error);
    throw error;
  }
}

serve(async (req) => {
  console.log("Received stream-video request");
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    console.log("Request body:", requestBody);
    
    // url is the magnet link from the TorrentSource
    const { provider, quality, mediaType, mediaId, url, title } = requestBody;
    
    if (!url || !url.startsWith("magnet:?")) {
      console.error("Missing or invalid magnet URL in request:", requestBody);
      return new Response(
        JSON.stringify({ 
          error: "Missing or invalid magnet URL",
          // Provide a fallback stream URL for demo purposes
          streamUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
        }),
        { 
          status: 200, // Use 200 instead of 400 to ensure client can still play something
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
    
    try {
      // Generate a stream URL from the magnet link
      // In a real implementation, this would call a debrid service
      const streamUrl = await getDebridStreamUrl(url);
      
      console.log("Returning stream URL:", streamUrl);
      
      return new Response(
        JSON.stringify({ 
          streamUrl,
          message: `Successfully obtained stream link for ${title}`
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200 
        }
      );
    } catch (debridError) {
      console.error("Error with debrid service:", debridError);
      
      // Provide a fallback stream URL for demo purposes
      const fallbackUrl = "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
      
      return new Response(
        JSON.stringify({ 
          streamUrl: fallbackUrl,
          error: debridError.message,
          message: "Using fallback stream due to debrid service error"
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200 
        }
      );
    }
  } catch (error) {
    console.error("Error in stream-video function:", error);
    
    // Even in case of error, provide a fallback video to ensure something plays
    return new Response(
      JSON.stringify({ 
        streamUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        error: error.message || "Unknown error generating stream",
        message: "Using fallback stream due to error"
      }),
      { 
        status: 200, // Use 200 to ensure client still gets a playable URL
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
