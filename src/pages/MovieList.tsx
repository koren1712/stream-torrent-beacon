
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Movie } from "@/types";
import MediaGrid from "@/components/MediaGrid";

const MovieList = () => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMovies = async () => {
      setIsLoading(true);
      try {
        const data = await api.getTrendingMovies();
        setMovies(data);
      } catch (error) {
        console.error("Error fetching movies:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMovies();
  }, []);

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Movies</h1>
      
      <MediaGrid 
        items={movies} 
        isLoading={isLoading} 
      />
    </div>
  );
};

export default MovieList;
