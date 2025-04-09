
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { TVShow } from "@/types";
import MediaGrid from "@/components/MediaGrid";

const TVList = () => {
  const [tvShows, setTVShows] = useState<TVShow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTVShows = async () => {
      setIsLoading(true);
      try {
        const data = await api.getTrendingTVShows();
        setTVShows(data);
      } catch (error) {
        console.error("Error fetching TV shows:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTVShows();
  }, []);

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">TV Shows</h1>
      
      <MediaGrid 
        items={tvShows} 
        isLoading={isLoading} 
      />
    </div>
  );
};

export default TVList;
