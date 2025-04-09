
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Movie, TorrentSource } from "@/types";
import { Button } from "@/components/ui/button";
import TorrentList from "@/components/TorrentList";
import VideoPlayer from "@/components/VideoPlayer";

const MovieDetails = () => {
  const { id } = useParams<{ id: string }>();
  const movieId = parseInt(id || "0");
  
  const [movie, setMovie] = useState<Movie | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [torrentSources, setTorrentSources] = useState<TorrentSource[]>([]);
  const [isLoadingTorrents, setIsLoadingTorrents] = useState(false);
  const [selectedSource, setSelectedSource] = useState<TorrentSource | null>(null);

  useEffect(() => {
    const fetchMovie = async () => {
      if (!movieId) return;
      
      setIsLoading(true);
      try {
        const data = await api.getMovieDetails(movieId);
        setMovie(data);
        
        // Fetch torrent sources once we have the movie details
        if (data) {
          setIsLoadingTorrents(true);
          const sources = await api.getTorrentSources(movieId, "movie");
          setTorrentSources(sources);
          setIsLoadingTorrents(false);
        }
      } catch (error) {
        console.error("Error fetching movie details:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMovie();
  }, [movieId]);

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

  if (!movie) {
    return (
      <div className="container py-8">
        <div className="text-center py-16">
          <h1 className="text-3xl font-bold mb-4">Movie not found</h1>
          <p className="text-muted-foreground">The movie you're looking for doesn't exist or has been removed.</p>
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
          src={api.getBackdropUrl(movie.backdrop_path)} 
          alt={movie.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-0 left-0 w-full p-8">
          <div className="container">
            <h1 className="text-4xl font-bold">{movie.title}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span>{movie.release_date?.substring(0, 4)}</span>
              <span className="flex items-center">
                <span className="text-yellow-400 mr-1">★</span>
                {movie.vote_average?.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left Column - Movie Info */}
          <div className="md:col-span-1">
            <img 
              src={api.getPosterUrl(movie.poster_path)} 
              alt={movie.title}
              className="w-full h-auto rounded-lg shadow-lg"
            />
            
            <div className="mt-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Overview</h3>
                <p className="text-muted-foreground">{movie.overview}</p>
              </div>
            </div>
          </div>
          
          {/* Right Column - Torrent Sources and Player */}
          <div className="md:col-span-2">
            {selectedSource && (
              <div id="player-section" className="mb-8">
                <h2 className="text-2xl font-bold mb-4">Now Playing</h2>
                <VideoPlayer
<<<<<<< HEAD
                  title={movie.title}
                  source={selectedSource}
                  mediaType="movie"
                  mediaId={movieId}
=======
                  title={`${movie.title} (${selectedSource.quality})`}
                  source={selectedSource.provider}
>>>>>>> f233d878d245d5ed6f02951a3a51afa377c5bb4c
                />
              </div>
            )}
            
            <h2 className="text-2xl font-bold mb-4">Torrent Sources</h2>
            <TorrentList
              sources={torrentSources}
              isLoading={isLoadingTorrents}
              onSelectSource={handleSelectSource}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MovieDetails;
