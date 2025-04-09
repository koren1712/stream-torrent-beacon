
import { MediaItem, Movie, TVShow, Season, Episode, TorrentSource } from "@/types";
import { createClient } from '@supabase/supabase-js';
import { toast } from "sonner";

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-supabase-url.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

// DEBUG LOG:
console.log("Supabase URL from env:", import.meta.env.VITE_SUPABASE_URL);
console.log("Supabase Anon Key from env:", import.meta.env.VITE_SUPABASE_ANON_KEY);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const TMDB_API_KEY = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI4MGQ5NjYxMTA5ZjBhNzNkODhiMTUxZWQyYzExZmU3NiIsIm5iZiI6MTcyMjc4MDc5NC45NjcsInN1YiI6IjY2YWY4YzdhMDlhN2ExNzFhYTY1YzA1OCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.EGPGKFzfr1ZBTLEGPAqb3FJ39BR8KXfvKXFUon-RhEo";
const TMDB_API_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_URL = "https://image.tmdb.org/t/p";

// Generate fallback sources for when API calls fail
function generateFallbackSources(title: string): TorrentSource[] {
  console.log("Generating fallback sources for:", title);
  const qualities = ["4K", "1080p", "720p", "480p"];
  const providers = ["YTS", "RARBG", "1337x", "ThePirateBay"];
  const sources: TorrentSource[] = [];
  
  // Generate a more dynamic hash for each source
  const generateHash = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    // Convert to hex string and ensure it's 40 chars long
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

export const api = {
  async getTrendingMedia(): Promise<MediaItem[]> {
    try {
      const movies = await this.getTrendingMovies();
      const tvShows = await this.getTrendingTVShows();
      
      // Combine and sort by popularity
      return [...movies, ...tvShows]
        .sort((a, b) => b.vote_count - a.vote_count)
        .slice(0, 20);
    } catch (error) {
      console.error("Error fetching trending media:", error);
      return [];
    }
  },

  async getTrendingMovies(): Promise<Movie[]> {
    try {
      const response = await fetch(
        `${TMDB_API_URL}/trending/movie/week`,
        {
          headers: {
            Authorization: `Bearer ${TMDB_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      
      const data = await response.json();
      return data.results.map((movie: any) => ({
        ...movie,
        media_type: "movie",
      }));
    } catch (error) {
      console.error("Error fetching trending movies:", error);
      return [];
    }
  },

  async getTrendingTVShows(): Promise<TVShow[]> {
    try {
      const response = await fetch(
        `${TMDB_API_URL}/trending/tv/week`,
        {
          headers: {
            Authorization: `Bearer ${TMDB_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      
      const data = await response.json();
      return data.results.map((show: any) => ({
        ...show,
        media_type: "tv",
      }));
    } catch (error) {
      console.error("Error fetching trending TV shows:", error);
      return [];
    }
  },

  async searchMedia(query: string): Promise<MediaItem[]> {
    if (!query) return [];
    
    try {
      const response = await fetch(
        `${TMDB_API_URL}/search/multi?query=${encodeURIComponent(query)}&include_adult=false`,
        {
          headers: {
            Authorization: `Bearer ${TMDB_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      
      const data = await response.json();
      return data.results
        .filter((item: any) => item.media_type === "movie" || item.media_type === "tv")
        .slice(0, 20);
    } catch (error) {
      console.error("Error searching media:", error);
      return [];
    }
  },

  async getMovieDetails(id: number): Promise<Movie | null> {
    try {
      const response = await fetch(
        `${TMDB_API_URL}/movie/${id}`,
        {
          headers: {
            Authorization: `Bearer ${TMDB_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      
      const data = await response.json();
      return {
        ...data,
        media_type: "movie",
      };
    } catch (error) {
      console.error(`Error fetching movie details for ID ${id}:`, error);
      return null;
    }
  },

  async getTVShowDetails(id: number): Promise<TVShow | null> {
    try {
      const response = await fetch(
        `${TMDB_API_URL}/tv/${id}`,
        {
          headers: {
            Authorization: `Bearer ${TMDB_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      
      const data = await response.json();
      return {
        ...data,
        media_type: "tv",
      };
    } catch (error) {
      console.error(`Error fetching TV show details for ID ${id}:`, error);
      return null;
    }
  },

  async getSeasons(tvId: number): Promise<Season[]> {
    try {
      const tvShow = await this.getTVShowDetails(tvId);
      if (!tvShow) return [];
      
      return tvShow.seasons || [];
    } catch (error) {
      console.error(`Error fetching seasons for TV show ID ${tvId}:`, error);
      return [];
    }
  },

  async getEpisodes(tvId: number, seasonNumber: number): Promise<Episode[]> {
    try {
      const response = await fetch(
        `${TMDB_API_URL}/tv/${tvId}/season/${seasonNumber}`,
        {
          headers: {
            Authorization: `Bearer ${TMDB_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      
      const data = await response.json();
      return data.episodes || [];
    } catch (error) {
      console.error(`Error fetching episodes for TV show ID ${tvId}, season ${seasonNumber}:`, error);
      return [];
    }
  },

  async getTorrentSources(mediaId: number, mediaType: "movie" | "tv", seasonNumber?: number, episodeNumber?: number): Promise<TorrentSource[]> {
    try {
      console.log(`Fetching torrent sources for ${mediaType} ${mediaId}`, seasonNumber, episodeNumber);
      
      try {
        const { data, error } = await supabase.functions.invoke('torrent-scraper', {
          body: {
            mediaId,
            mediaType,
            seasonNumber,
            episodeNumber
          }
        });

        if (error) {
          console.error("Error fetching torrent sources:", error);
          toast.error("Error fetching torrent sources. Using fallback data.");
          return generateFallbackSources(`${mediaType} ${mediaId} ${seasonNumber ? `S${seasonNumber}` : ''}${episodeNumber ? `E${episodeNumber}` : ''}`);
        }

        if (!data || !data.sources || !Array.isArray(data.sources)) {
          console.error("Invalid response format from torrent-scraper", data);
          toast.error("Invalid response from torrent scraper. Using fallback data.");
          return generateFallbackSources(`${mediaType} ${mediaId} ${seasonNumber ? `S${seasonNumber}` : ''}${episodeNumber ? `E${episodeNumber}` : ''}`);
        }

        // Make sure every source has a valid magnet URL
        const validSources = data.sources.filter(source => 
          source && source.url && source.url.startsWith('magnet:?')
        );

        if (validSources.length === 0) {
          console.warn("No valid magnet links found in response");
          toast.warning("No valid torrent sources found. Using fallback data.");
          return generateFallbackSources(`${mediaType} ${mediaId} ${seasonNumber ? `S${seasonNumber}` : ''}${episodeNumber ? `E${episodeNumber}` : ''}`);
        }

        console.log(`Found ${validSources.length} valid torrent sources`);
        // Log first source for debugging
        if (validSources.length > 0) {
          console.log("First source:", { 
            title: validSources[0].title,
            provider: validSources[0].provider,
            url: validSources[0].url.substring(0, 60) + '...' // Only log start of magnet link
          });
        }

        return validSources;
      } catch (error) {
        console.error("Error invoking torrent-scraper function:", error);
        toast.error("Error connecting to torrent scraper. Using fallback data.");
        return generateFallbackSources(`${mediaType} ${mediaId} ${seasonNumber ? `S${seasonNumber}` : ''}${episodeNumber ? `E${episodeNumber}` : ''}`);
      }
    } catch (error) {
      console.error("Error fetching torrent sources:", error);
      toast.error("Error fetching torrent sources. Using fallback data.");
      return generateFallbackSources(`${mediaType} ${mediaId} ${seasonNumber ? `S${seasonNumber}` : ''}${episodeNumber ? `E${episodeNumber}` : ''}`);
    }
  },

  async getStreamUrl(source: TorrentSource, mediaType: "movie" | "tv", mediaId: number, title: string): Promise<string> {
    try {
      console.log(`Generating stream for ${mediaType} ${mediaId} from ${source.provider}`);
      
      // Sample videos for fallback
      const sampleVideos = [
        "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
        "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        "https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4"
      ];
      
      try {
        const { data, error } = await supabase.functions.invoke('stream-video', {
          body: {
            provider: source.provider,
            quality: source.quality,
            mediaType,
            mediaId,
            title,
            url: source.url
          }
        });

        if (error) {
          console.error("Error generating stream:", error);
          toast.error(`Error generating stream: ${error.message}. Using fallback video.`);
          const randomIndex = Math.floor(Math.random() * sampleVideos.length);
          return sampleVideos[randomIndex];
        }

        if (!data || !data.streamUrl) {
          console.error("Invalid response format from stream-video", data);
          toast.error("Invalid response from stream service. Using fallback video.");
          const randomIndex = Math.floor(Math.random() * sampleVideos.length);
          return sampleVideos[randomIndex];
        }

        console.log("Stream URL obtained successfully:", data.streamUrl.substring(0, 60) + '...');
        return data.streamUrl;
      } catch (error) {
        console.error("Error invoking stream-video function:", error);
        toast.error("Error generating stream. Using fallback video.");
        const randomIndex = Math.floor(Math.random() * sampleVideos.length);
        return sampleVideos[randomIndex];
      }
    } catch (error) {
      console.error("Error generating stream:", error);
      // Always return a valid URL even on error
      const randomIndex = Math.floor(Math.random() * 4);
      return [
        "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
        "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        "https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4"
      ][randomIndex];
    }
  },

  getPosterUrl(path: string | null, size: string = "w500"): string {
    if (!path) return "/placeholder.svg";
    return `${TMDB_IMAGE_URL}/${size}${path}`;
  },

  getBackdropUrl(path: string | null, size: string = "original"): string {
    if (!path) return "/placeholder.svg";
    return `${TMDB_IMAGE_URL}/${size}${path}`;
  }
};
