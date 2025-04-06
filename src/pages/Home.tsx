
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { MediaItem } from "@/types";
import MediaGrid from "@/components/MediaGrid";

const Home = () => {
  const [trendingMedia, setTrendingMedia] = useState<MediaItem[]>([]);
  const [trendingMovies, setTrendingMovies] = useState<MediaItem[]>([]);
  const [trendingTVShows, setTrendingTVShows] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [media, movies, tvShows] = await Promise.all([
          api.getTrendingMedia(),
          api.getTrendingMovies(),
          api.getTrendingTVShows()
        ]);
        
        setTrendingMedia(media);
        setTrendingMovies(movies);
        setTrendingTVShows(tvShows);
      } catch (error) {
        console.error("Error fetching home data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-2">Welcome to Torrentio</h1>
      <p className="text-muted-foreground mb-8">Stream movies and TV shows from various torrent sources</p>
      
      <MediaGrid 
        title="Trending Now" 
        items={trendingMedia} 
        isLoading={isLoading} 
      />
      
      <MediaGrid 
        title="Popular Movies" 
        items={trendingMovies} 
        isLoading={isLoading} 
      />
      
      <MediaGrid 
        title="Popular TV Shows" 
        items={trendingTVShows} 
        isLoading={isLoading} 
      />
    </div>
  );
};

export default Home;
