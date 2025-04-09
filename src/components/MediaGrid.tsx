
import { MediaItem } from "@/types";
import MediaCard from "./MediaCard";

interface MediaGridProps {
  title?: string;
  items: MediaItem[];
  isLoading?: boolean;
}

const MediaGrid = ({ title, items, isLoading = false }: MediaGridProps) => {
  return (
    <div className="mt-6">
      {title && (
        <h2 className="text-2xl font-bold mb-4">{title}</h2>
      )}
      
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-md bg-muted animate-pulse-slow"></div>
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {items.map((item) => (
            <MediaCard key={`${item.id}-${item.media_type}`} media={item} />
          ))}
        </div>
      ) : (
        <div className="text-center py-10">
          <p className="text-muted-foreground">No items found</p>
        </div>
      )}
    </div>
  );
};

export default MediaGrid;
