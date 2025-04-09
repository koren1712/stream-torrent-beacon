
import { useState } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import { TorrentSource } from "@/types";

interface TorrentListProps {
  sources: TorrentSource[];
  isLoading: boolean;
  onSelectSource: (source: TorrentSource) => void;
}

const TorrentList = ({ sources, isLoading, onSelectSource }: TorrentListProps) => {
  const [sortField, setSortField] = useState<keyof TorrentSource>("seeds");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const handleSort = (field: keyof TorrentSource) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedSources = [...sources].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    if (typeof aValue === "number" && typeof bValue === "number") {
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    }
    
    if (typeof aValue === "string" && typeof bValue === "string") {
      return sortDirection === "asc" 
        ? aValue.localeCompare(bValue) 
        : bValue.localeCompare(aValue);
    }
    
    return 0;
  });

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <div className="p-8 flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-muted-foreground">Loading torrent sources...</p>
        </div>
      </div>
    );
  }

  if (sources.length === 0) {
    return (
      <div className="rounded-md border">
        <div className="p-8 text-center">
          <p className="text-muted-foreground">No torrent sources found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead 
              className="cursor-pointer hover:text-primary"
              onClick={() => handleSort("title")}
            >
              Title
              {sortField === "title" && (
                <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>
              )}
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:text-primary"
              onClick={() => handleSort("quality")}
            >
              Quality
              {sortField === "quality" && (
                <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>
              )}
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:text-primary text-right"
              onClick={() => handleSort("seeds")}
            >
              Seeds
              {sortField === "seeds" && (
                <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>
              )}
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:text-primary"
              onClick={() => handleSort("size")}
            >
              Size
              {sortField === "size" && (
                <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>
              )}
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:text-primary"
              onClick={() => handleSort("provider")}
            >
              Provider
              {sortField === "provider" && (
                <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>
              )}
            </TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedSources.map((source, index) => (
            <TableRow key={index}>
              <TableCell className="font-medium">{source.title}</TableCell>
              <TableCell>
                <span className="inline-block px-2 py-1 bg-secondary rounded text-xs">
                  {source.quality}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <span className={`font-medium ${source.seeds > 1000 ? 'text-green-500' : source.seeds > 500 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                  {source.seeds}
                </span>
              </TableCell>
              <TableCell>{source.size}</TableCell>
              <TableCell>{source.provider}</TableCell>
              <TableCell>
                <Button 
                  size="sm" 
                  onClick={() => onSelectSource(source)}
                  className="flex items-center gap-1"
                >
                  <Play className="h-4 w-4" />
                  Play
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default TorrentList;
