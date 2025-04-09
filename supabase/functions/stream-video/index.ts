// Follow this setup guide to integrate the Deno runtime into your application:
// https://deno.land/manual/examples/deploy_node_server
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

// Function to extract magnet hash from a magnet link (might still be useful)
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

  console.log("Attempting to resolve magnet link with Debrid service:", magnetUrl);

  // --- PLACEHOLDER: Replace with actual Debrid API calls --- 
  // 1. Add the magnet link to your Debrid account (e.g., Real-Debrid API: /torrents/addMagnet)
  // 2. Check the status of the torrent until it's downloaded/cached (e.g., Real-Debrid API: /torrents/info/{id})
  // 3. Once ready, get the direct streaming link(s) (e.g., Real-Debrid API: /torrents/unrestrict/{link})
  
  // Example (Conceptual - NEEDS REAL IMPLEMENTATION based on your chosen service)
  const debridApiEndpoint = "https://api.your-debrid-service.com/api"; // Replace with actual endpoint
  try {
    // Step 1: Add magnet (Example)
    // const addResponse = await fetch(`${debridApiEndpoint}/add`, { 
    //   method: 'POST', 
    //   headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ magnet: magnetUrl })
    // });
    // const addResult = await addResponse.json();
    // if (!addResponse.ok || !addResult.id) throw new Error('Failed to add magnet to Debrid');
    // const torrentId = addResult.id;
    
    // Step 2: Check status (Might need polling or delays)
    // ... polling logic ...
    
    // Step 3: Get stream link (Example - assuming it returns a direct link)
    // const linkResponse = await fetch(`${debridApiEndpoint}/getLink/${torrentId}`, { 
    //    headers: { 'Authorization': `Bearer ${apiKey}` }
    // });
    // const linkResult = await linkResponse.json();
    // if (!linkResponse.ok || !linkResult.streamUrl) throw new Error('Failed to get stream link from Debrid');
    // const streamUrl = linkResult.streamUrl;

    // --- END PLACEHOLDER --- 

    // For now, throw error until placeholder is replaced
    throw new Error("Debrid API call logic not implemented yet."); 
    
    // console.log("Successfully obtained Debrid stream URL:", streamUrl);
    // return streamUrl;

  } catch (error) {
    console.error("Error interacting with Debrid service:", error);
    throw new Error(`Failed to get stream from Debrid service: ${error.message}`);
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
          error: "Missing or invalid magnet URL"
        }),
        { 
          status: 400, // Bad Request
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
    
    // Always attempt to use Debrid for magnet links
    const streamUrl = await getDebridStreamUrl(url);
    
    console.log("Returning stream URL from Debrid:", streamUrl);
    
    return new Response(
      JSON.stringify({ 
        streamUrl, // This should be the direct HTTPS link from Debrid
        message: `Successfully obtained stream link via Debrid`
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error) {
    console.error("Error in stream-video function:", error);
    // Return a specific error message instead of a fallback video
    return new Response(
      JSON.stringify({ 
        error: error.message || "Unknown error generating stream"
      }),
      { 
        // Use 500 for server-side errors, 400 if it was a bad request (e.g., missing key)
        status: error.message.includes("configured") || error.message.includes("Invalid magnet") ? 400 : 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
