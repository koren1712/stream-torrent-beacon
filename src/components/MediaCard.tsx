
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { MediaItem, isMovie, isTVShow } from "@/types";
import { api } from "@/lib/api";

interface MediaCardProps {
  media: MediaItem;
}

const MediaCard = ({ media }: MediaCardProps) => {
  const title = isMovie(media) ? media.title : media.name;
  const year = isMovie(media) 
    ? media.release_date?.substring(0, 4) 
    : media.first_air_date?.substring(0, 4);
  const route = isMovie(media) ? `/movie/${media.id}` : `/tv/${media.id}`;
  
  return (
    <Link to={route}>
      <Card className="overflow-hidden h-full transition-all duration-200 hover:scale-105 hover:shadow-lg">
        <div className="aspect-[2/3] relative overflow-hidden">
          <img 
            src={api.getPosterUrl(media.poster_path)} 
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
            <div className="flex justify-between items-end">
              <div>
                <h3 className="font-semibold text-white line-clamp-1">{title}</h3>
                {year && <p className="text-xs text-muted-foreground">{year}</p>}
              </div>
              <div className="flex items-center gap-1 bg-black/60 text-xs px-2 py-1 rounded-full">
                <span className="text-yellow-400">★</span>
                <span>{media.vote_average?.toFixed(1) || "N/A"}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
};

export default MediaCard;
