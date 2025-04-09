
import { useState, useEffect } from "react";
import { MediaItem } from "@/types";
import MediaGrid from "@/components/MediaGrid";

const Favorites = () => {
  // In a real app, this would fetch from localStorage or a backend
  const [favorites, setFavorites] = useState<MediaItem[]>([]);

  useEffect(() => {
    // This is just a stub - in a real app you'd implement favorites functionality
    // For now, we'll show an empty state
  }, []);

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Your Favorites</h1>
      
      {favorites.length > 0 ? (
        <MediaGrid items={favorites} />
      ) : (
        <div className="text-center py-16 border border-dashed rounded-lg">
          <h2 className="text-xl font-semibold mb-2">No favorites yet</h2>
          <p className="text-muted-foreground mb-4">
            Add movies and TV shows to your favorites for quick access
          </p>
        </div>
      )}
    </div>
  );
};

export default Favorites;
