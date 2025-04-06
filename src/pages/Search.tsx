
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { MediaItem } from "@/types";
import MediaGrid from "@/components/MediaGrid";

const Search = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  
  const [results, setResults] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchResults = async () => {
      if (!query) return;
      
      setIsLoading(true);
      try {
        const data = await api.searchMedia(query);
        setResults(data);
      } catch (error) {
        console.error("Error searching media:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchResults();
  }, [query]);

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">
        {query ? `Search results for "${query}"` : "Search"}
      </h1>
      
      <MediaGrid 
        items={results} 
        isLoading={isLoading} 
      />
      
      {!isLoading && results.length === 0 && query && (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-lg">No results found for "{query}"</p>
          <p className="text-sm mt-2">Try different keywords or check your spelling</p>
        </div>
      )}
    </div>
  );
};

export default Search;
