import { MediaItem, Movie, TVShow, Season, Episode, TorrentSource } from "@/types";
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-supabase-url.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const TMDB_API_KEY = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI4MGQ5NjYxMTA5ZjBhNzNkODhiMTUxZWQyYzExZmU3NiIsIm5iZiI6MTcyMjc4MDc5NC45NjcsInN1YiI6IjY2YWY4YzdhMDlhN2ExNzFhYTY1YzA1OCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.EGPGKFzfr1ZBTLEGPAqb3FJ39BR8KXfvKXFUon-RhEo";
const TMDB_API_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_URL = "https://image.tmdb.org/t/p";

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
        return [];
      }

      return data.sources || [];
    } catch (error) {
      console.error("Error fetching torrent sources:", error);
      return [];
    }
  },

  async getStreamUrl(source: TorrentSource, mediaType: "movie" | "tv", mediaId: number, title: string): Promise<string> {
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
        throw new Error("Failed to generate stream URL");
      }

      return data.streamUrl;
    } catch (error) {
      console.error("Error generating stream:", error);
      throw new Error("Failed to generate stream URL");
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
