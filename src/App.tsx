
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Home from "./pages/Home";
import Search from "./pages/Search";
import MovieList from "./pages/MovieList";
import TVList from "./pages/TVList";
import MovieDetails from "./pages/MovieDetails";
import TVDetails from "./pages/TVDetails";
import Favorites from "./pages/Favorites";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />}>
            <Route index element={<Home />} />
            <Route path="search" element={<Search />} />
            <Route path="movies" element={<MovieList />} />
            <Route path="tv" element={<TVList />} />
            <Route path="movie/:id" element={<MovieDetails />} />
            <Route path="tv/:id" element={<TVDetails />} />
            <Route path="favorites" element={<Favorites />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
