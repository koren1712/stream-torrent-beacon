
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

const Navbar = () => {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <nav className="sticky top-0 z-50 w-full backdrop-blur-lg bg-background/80 border-b border-border">
      <div className="container flex h-16 items-center justify-between py-4">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold text-gradient">Torrentio</span>
          </Link>
          <div className="hidden md:flex gap-6">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
              Home
            </Link>
            <Link to="/movies" className="text-muted-foreground hover:text-foreground transition-colors">
              Movies
            </Link>
            <Link to="/tv" className="text-muted-foreground hover:text-foreground transition-colors">
              TV Shows
            </Link>
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex-1 max-w-md mx-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search movies, TV shows..."
              className="pl-10 bg-secondary"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </form>

        <div className="flex items-center gap-2">
          <Link to="/favorites">
            <Button variant="ghost" className="hidden sm:flex">
              Favorites
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
