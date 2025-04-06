
import { useState } from "react";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Season, Episode } from "@/types";
import { api } from "@/lib/api";

interface EpisodeListProps {
  tvId: number;
  seasons: Season[];
  onSelectEpisode: (season: number, episode: number) => void;
}

const EpisodeList = ({ tvId, seasons, onSelectEpisode }: EpisodeListProps) => {
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);

  const handleSelectSeason = async (seasonNumber: number) => {
    if (selectedSeason === seasonNumber) return;
    
    setSelectedSeason(seasonNumber);
    setIsLoadingEpisodes(true);
    
    try {
      const fetchedEpisodes = await api.getEpisodes(tvId, seasonNumber);
      setEpisodes(fetchedEpisodes);
    } catch (error) {
      console.error("Error fetching episodes:", error);
    } finally {
      setIsLoadingEpisodes(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Seasons & Episodes</h3>
      
      <Accordion type="single" collapsible className="w-full">
        {seasons.map((season) => (
          <AccordionItem key={season.id} value={`season-${season.season_number}`}>
            <AccordionTrigger 
              onClick={() => handleSelectSeason(season.season_number)}
              className="hover:bg-secondary/50 px-4 rounded-md"
            >
              <div className="flex items-center gap-3">
                {season.poster_path && (
                  <img 
                    src={api.getPosterUrl(season.poster_path, "w92")} 
                    alt={season.name}
                    className="w-10 h-14 object-cover rounded"
                  />
                )}
                <div className="text-left">
                  <p className="font-medium">{season.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {season.episode_count} episodes
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {isLoadingEpisodes && selectedSeason === season.season_number ? (
                <div className="py-6 flex justify-center">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <div className="space-y-3 p-2">
                  {episodes.map((episode) => (
                    <div 
                      key={episode.id} 
                      className="flex items-center gap-3 p-2 hover:bg-secondary/50 rounded-md"
                    >
                      <div className="w-24 h-16 relative flex-shrink-0">
                        <img 
                          src={episode.still_path ? api.getPosterUrl(episode.still_path, "w185") : "/placeholder.svg"} 
                          alt={episode.name}
                          className="w-full h-full object-cover rounded"
                        />
                        <div className="absolute bottom-1 left-1 bg-black/70 text-xs px-1 rounded">
                          E{episode.episode_number}
                        </div>
                      </div>
                      <div className="flex-grow">
                        <p className="font-medium">{episode.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {episode.overview || "No description available"}
                        </p>
                      </div>
                      <Button 
                        size="sm"
                        variant="secondary"
                        onClick={() => onSelectEpisode(season.season_number, episode.episode_number)}
                      >
                        Watch
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};

export default EpisodeList;
