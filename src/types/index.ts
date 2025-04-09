
export interface Movie {
  id: number;
  title: string;
  poster_path: string;
  backdrop_path: string;
  overview: string;
  release_date: string;
  vote_average: number;
  vote_count: number;
  media_type: "movie";
}

export interface TVShow {
  id: number;
  name: string;
  poster_path: string;
  backdrop_path: string;
  overview: string;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  media_type: "tv";
}

export interface Season {
  id: number;
  name: string;
  overview: string;
  poster_path: string;
  season_number: number;
  episode_count: number;
}

export interface Episode {
  id: number;
  name: string;
  overview: string;
  still_path: string;
  episode_number: number;
  season_number: number;
  air_date: string;
}

export interface TorrentSource {
  title: string;
  seeds: number;
  url: string;
  quality: string;
  size?: string;
  provider: string;
}

export type MediaItem = Movie | TVShow;

export function isMovie(media: MediaItem): media is Movie {
  return media.media_type === "movie";
}

export function isTVShow(media: MediaItem): media is TVShow {
  return media.media_type === "tv";
}
