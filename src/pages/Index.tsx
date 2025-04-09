
import { Outlet } from "react-router-dom";
import Navbar from "@/components/Navbar";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-grow">
        <Outlet />
      </main>
      <footer className="border-t border-border">
        <div className="container py-6 text-center text-muted-foreground text-sm">
          <p className="mb-2">
            Torrentio Streaming App - For educational purposes only
          </p>
          <p>
            Powered by TMDB API - Not affiliated with any torrent site or Stremio
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
