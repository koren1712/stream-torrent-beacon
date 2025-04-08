
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { TVShow, Season, TorrentSource } from "@/types";
import { Button } from "@/components/ui/button";
import TorrentList from "@/components/TorrentList";
import VideoPlayer from "@/components/VideoPlayer";
import EpisodeList from "@/components/EpisodeList";

const TVDetails = () => {
  const { id } = useParams<{ id: string }>();
  const tvId = parseInt(id || "0");
  
  const [tvShow, setTVShow] = useState<TVShow | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null);
  const [torrentSources, setTorrentSources] = useState<TorrentSource[]>([]);
  const [isLoadingTorrents, setIsLoadingTorrents] = useState(false);
  const [selectedSource, setSelectedSource] = useState<TorrentSource | null>(null);

  useEffect(() => {
    const fetchTVShow = async () => {
      if (!tvId) return;
      
      setIsLoading(true);
      try {
        const data = await api.getTVShowDetails(tvId);
        setTVShow(data);
        
        if (data) {
          const seasonsData = await api.getSeasons(tvId);
          setSeasons(seasonsData.filter(season => season.season_number > 0));
        }
      } catch (error) {
        console.error("Error fetching TV show details:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTVShow();
  }, [tvId]);

  useEffect(() => {
    // When both season and episode are selected, fetch torrent sources
    const fetchTorrentSources = async () => {
      if (!tvId || selectedSeason === null || selectedEpisode === null) return;
      
      setIsLoadingTorrents(true);
      try {
        const sources = await api.getTorrentSources(
          tvId, 
          "tv", 
          selectedSeason, 
          selectedEpisode
        );
        setTorrentSources(sources);
      } catch (error) {
        console.error("Error fetching torrent sources:", error);
      } finally {
        setIsLoadingTorrents(false);
      }
    };
    
    fetchTorrentSources();
  }, [tvId, selectedSeason, selectedEpisode]);

  const handleSelectEpisode = (season: number, episode: number) => {
    setSelectedSeason(season);
    setSelectedEpisode(episode);
    setSelectedSource(null);
    
    // Scroll to torrent section
    setTimeout(() => {
      document.getElementById("torrent-section")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleSelectSource = (source: TorrentSource) => {
    setSelectedSource(source);
    // Scroll to player
    setTimeout(() => {
      document.getElementById("player-section")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  if (isLoading) {
    return (
      <div className="container py-8 flex justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!tvShow) {
    return (
      <div className="container py-8">
        <div className="text-center py-16">
          <h1 className="text-3xl font-bold mb-4">TV Show not found</h1>
          <p className="text-muted-foreground">The TV show you're looking for doesn't exist or has been removed.</p>
          <Button className="mt-4" asChild>
            <a href="/">Back to Home</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Hero Section with Backdrop */}
      <div className="relative w-full h-[50vh] min-h-[400px]">
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/20"></div>
        <img 
          src={api.getBackdropUrl(tvShow.backdrop_path)} 
          alt={tvShow.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-0 left-0 w-full p-8">
          <div className="container">
            <h1 className="text-4xl font-bold">{tvShow.name}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span>{tvShow.first_air_date?.substring(0, 4)}</span>
              <span className="flex items-center">
                <span className="text-yellow-400 mr-1">★</span>
                {tvShow.vote_average?.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left Column - TV Show Info */}
          <div className="md:col-span-1">
            <img 
              src={api.getPosterUrl(tvShow.poster_path)} 
              alt={tvShow.name}
              className="w-full h-auto rounded-lg shadow-lg"
            />
            
            <div className="mt-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Overview</h3>
                <p className="text-muted-foreground">{tvShow.overview}</p>
              </div>
              
              {selectedSeason !== null && selectedEpisode !== null && (
                <div className="p-3 bg-secondary rounded-md">
                  <p className="text-sm font-medium">Currently selected:</p>
                  <p className="text-lg font-bold">
                    Season {selectedSeason}, Episode {selectedEpisode}
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* Right Column - Episodes, Torrent Sources and Player */}
          <div className="md:col-span-2">
            {selectedSource && (
              <div id="player-section" className="mb-8">
                <h2 className="text-2xl font-bold mb-4">Now Playing</h2>
                <VideoPlayer
                  title={`${tvShow.name} S${selectedSeason}E${selectedEpisode} (${selectedSource.quality})`}
                  source={selectedSource.provider}
                />
              </div>
            )}
            
            {selectedSeason !== null && selectedEpisode !== null && (
              <div id="torrent-section" className="mb-8">
                <h2 className="text-2xl font-bold mb-4">
                  Torrent Sources for S{selectedSeason}E{selectedEpisode}
                </h2>
                <TorrentList
                  sources={torrentSources}
                  isLoading={isLoadingTorrents}
                  onSelectSource={handleSelectSource}
                />
              </div>
            )}
            
            <EpisodeList
              tvId={tvId}
              seasons={seasons}
              onSelectEpisode={handleSelectEpisode}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TVDetails;
