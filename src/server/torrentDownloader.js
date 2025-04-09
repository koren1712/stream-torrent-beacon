import WebTorrent from 'webtorrent-hybrid'
import path from 'path'
import fs from 'fs-extra'
import os from 'os'

// Create a temp directory for storing downloaded files
const TEMP_DIR = path.join(os.tmpdir(), 'stream-torrent-temp')

// Make sure temp directory exists
fs.ensureDirSync(TEMP_DIR)
console.log(`Created/verified torrent temp directory: ${TEMP_DIR}`)
console.log(`Full path: ${path.resolve(TEMP_DIR)}`)

class TorrentDownloader {
  constructor() {
    this.client = new WebTorrent()
    this.downloads = new Map() // Track active downloads
    
    // Handle client errors
    this.client.on('error', (err) => {
      console.error('WebTorrent client error:', err.message)
    })
    
    console.log(`TorrentDownloader initialized. Using temp dir: ${TEMP_DIR}`)
  }
  
  /**
   * Process torrent files to find the video file and setup download info
   * @private
   */
  _processTorrentFiles(torrent, resolve, reject) {
    try {
      const torrentDir = path.join(this.tempDir, torrent.infoHash || 'unknown');
      
      // Check if files exist first
      if (!torrent.files || torrent.files.length === 0) {
        console.error(`No files found in torrent ${torrent.infoHash} after metadata.`);
        reject(new Error('No files found in torrent.'));
        return;
      }
      
      // Find video files
      const videoFiles = torrent.files.filter(file => {
        const ext = path.extname(file.name).toLowerCase();
        return ['.mp4', '.mkv', '.avi', '.webm', '.mov', '.m4v', '.mpg', '.mpeg'].includes(ext);
      });
      
      console.log(`Found ${videoFiles.length} video files in torrent ${torrent.infoHash}`);
      
      let videoFile = null; // Initialize to null
      if (videoFiles.length > 0) {
        videoFile = videoFiles.sort((a, b) => b.length - a.length)[0];
      } else if (torrent.files && torrent.files.length > 0) {
        videoFile = torrent.files.sort((a, b) => b.length - a.length)[0];
      }
      
      // Robust check: ensure videoFile is a valid object with necessary properties
      if (!videoFile || typeof videoFile !== 'object' || !videoFile.name || !videoFile.path || typeof videoFile.length !== 'number') {
        console.error(`No suitable file found or file object is invalid in torrent ${torrent.infoHash} even after metadata.`);
        // If still no file after metadata, reject or handle as error
        const existingInfo = this.downloads.get(torrent.infoHash) || {};
        existingInfo.error = 'No suitable or valid video file found in torrent (invalid metadata).';
        existingInfo.waiting = false;
        this.downloads.set(torrent.infoHash, existingInfo);
        reject(new Error('No suitable or valid video file found in torrent (invalid metadata).'));
        return;
      }
      
      // Additional check: Ensure videoFile.path is a usable string
      if (typeof videoFile.path !== 'string' || videoFile.path.trim() === '') {
        console.error(`Selected video file has an invalid path: ${videoFile.path}`);
        const existingInfo = this.downloads.get(torrent.infoHash) || {};
        existingInfo.error = 'Selected video file has an invalid path.';
        existingInfo.waiting = false;
        this.downloads.set(torrent.infoHash, existingInfo);
        reject(new Error('Selected video file has an invalid path.'));
        return;
      }
      
      // Wrap remaining logic in try-catch for safety
      try {
          // --- If we reach here, videoFile is valid --- 
          console.log(`Selected file for streaming: ${videoFile.name} (${this._formatBytes(videoFile.length)})`);
          
          const videoFilePath = path.join(torrentDir, videoFile.path);
          const fileDir = path.dirname(videoFilePath);
          fs.ensureDirSync(fileDir);
          
          const downloadInfo = {
            infoHash: torrent.infoHash,
            name: torrent.name,
            videoFile: {
              name: videoFile.name,
              path: videoFilePath,
              length: videoFile.length,
              type: this._getFileType(videoFile.name)
            },
            progress: 0,
            downloadSpeed: 0,
            peers: 0,
            created: new Date().toISOString(),
            waiting: false // No longer waiting for files
          };
          
          // Update or set the download info
          this.downloads.set(torrent.infoHash, downloadInfo);
          
          // Create an empty file immediately to enable streaming to start
          try {
            if (!fs.existsSync(videoFilePath)) {
              fs.writeFileSync(videoFilePath, Buffer.alloc(0));
              console.log(`Created empty placeholder file: ${videoFilePath}`);
            }
          } catch (err) {
            console.error(`Error creating placeholder file: ${err.message}`);
          }
          
          // Make the file streamable ASAP
          videoFile.createReadStream({ start: 0, end: 1 }).on('data', () => {
            console.log(`File ${videoFile.name} is now ready for streaming`);
          });
          
          // Prioritize the beginning of the file for faster startup
          this._prioritizePieces(torrent, videoFile);
          
          // Set up progress tracking and other event handlers
          this._setupTorrentEventHandlers(torrent, downloadInfo);
          
          // Resolve the promise with the download info
          resolve(downloadInfo);
      } catch (innerError) {
          console.error(`Error processing valid video file for ${torrent.infoHash}:`, innerError);
          reject(innerError);
      }
      
    } catch (error) {
        console.error(`Error processing torrent files for ${torrent.infoHash}:`, error);
        reject(error);
    }
  }
  
  /**
   * Prioritize pieces for streaming
   * @private
   */
   _prioritizePieces(torrent, videoFile) {
     try {
       if (videoFile._startPiece !== undefined && videoFile._endPiece !== undefined) {
         const pieceLength = torrent.pieceLength || 16384;
         const initialMB = 30;
         const criticalPiecesCount = Math.ceil(1024 * 1024 * initialMB / pieceLength);
         console.log(`Prioritizing first ${initialMB}MB (${criticalPiecesCount} pieces) of file for streaming`);
         const startPiece = videoFile._startPiece;
         torrent.select(startPiece, startPiece + Math.ceil(1024 * 1024 * 5 / pieceLength), 10);
         torrent.select(startPiece + Math.ceil(1024 * 1024 * 5 / pieceLength), startPiece + criticalPiecesCount, 5);
         torrent.select(startPiece + criticalPiecesCount, videoFile._endPiece, 1);
         videoFile.createReadStream({ start: 0, end: 1024 * 1024 * 5 }).on('data', () => {}).on('error', (err) => {
           console.error('Error during initial data streaming:', err.message);
         });
         console.log('Started initial data streaming to accelerate download');
       } else {
         console.log('File pieces information not available, using default streaming');
         torrent.select(0, torrent.pieces.length - 1, 1);
       }
     } catch (e) {
       console.error("Error prioritizing pieces:", e);
     }
   }
   
   /**
    * Setup torrent event handlers
    * @private
    */
   _setupTorrentEventHandlers(torrent, downloadInfo) {
     torrent.on('download', (bytes) => {
       downloadInfo.progress = Math.round(torrent.progress * 100);
       downloadInfo.downloadSpeed = torrent.downloadSpeed;
       downloadInfo.downloadedSpeed = this._formatBytes(torrent.downloadSpeed) + '/s';
       downloadInfo.peers = torrent.numPeers;
       downloadInfo.downloaded = this._formatBytes(torrent.downloaded);
       downloadInfo.timeRemaining = torrent.timeRemaining ? Math.floor(torrent.timeRemaining / 1000) : null;
       this.downloads.set(torrent.infoHash, downloadInfo);
       const downloadedMB = torrent.downloaded / (1024 * 1024);
       const prevDownloadedMB = (torrent.downloaded - bytes) / (1024 * 1024);
       if (Math.floor(downloadedMB / 5) > Math.floor(prevDownloadedMB / 5) || (downloadInfo.progress >= 2 && prevDownloadedMB < 2) || (downloadInfo.progress >= 5 && prevDownloadedMB < 5)) {
         console.log(`Downloaded ${downloadInfo.downloaded} (${downloadInfo.progress}%) at ${downloadInfo.downloadedSpeed}, peers: ${downloadInfo.peers}`);
       }
     });
     torrent.on('done', () => {
       console.log(`Torrent download completed: ${torrent.infoHash}`);
       downloadInfo.progress = 100;
       downloadInfo.completed = new Date().toISOString();
       this.downloads.set(torrent.infoHash, downloadInfo);
     });
     torrent.on('error', (err) => {
       console.error(`Torrent error (${torrent.infoHash}):`, err.message);
     });
     torrent.on('warning', (err) => {
       console.warn(`Torrent warning (${torrent.infoHash}):`, err.message);
     });
     torrent.on('wire', (wire, addr) => {
       console.log(`New peer connected (${torrent.infoHash}): ${addr}, total peers: ${torrent.numPeers}`);
       downloadInfo.peers = torrent.numPeers;
       this.downloads.set(torrent.infoHash, downloadInfo);
       if (torrent.numPeers === 1 && downloadInfo.progress < 1) {
         console.log(`First peer connected! Beginning to receive data for ${torrent.infoHash}`);
       }
     });
   }

  /**
   * Download a torrent and prepare it for streaming
   * @param {string} magnetUri - The magnet URI or torrent info hash
   * @returns {Promise<object>} - Information about the download
   */
  async downloadTorrent(magnetUri) {
    return new Promise((resolve, reject) => {
      try {
        // Check if we're already downloading this torrent
        const infoHash = this._extractInfoHash(magnetUri)
        
        if (infoHash && this.downloads.has(infoHash)) {
          console.log(`Torrent already being downloaded: ${infoHash}`)
          return resolve(this.downloads.get(infoHash))
        }
        
        console.log(`Starting download for torrent: ${magnetUri.substr(0, 60)}...`)
        
        // Create a dedicated directory for this torrent
        const torrentDir = path.join(this.tempDir, infoHash || 'unknown')
        fs.ensureDirSync(torrentDir)
        console.log(`Created dedicated directory for torrent: ${torrentDir}`)
        
        // Add the torrent to the client with streaming-friendly options
        const torrentOptions = {
          path: torrentDir,
          destroyStoreOnDestroy: false,  // Preserve files on destroy
          // strategy: 'sequential' // Let WebTorrent manage strategy initially
        }
        
        this.client.add(magnetUri, torrentOptions, (torrent) => {
          console.log(`Torrent added: ${torrent.infoHash}`)
          
          // Check if metadata (and thus files) are already available
          if (torrent.files && torrent.files.length > 0) {
            this._processTorrentFiles(torrent, resolve, reject);
          } else {
            // Metadata not ready yet, set placeholder and wait for 'metadata' event
            console.log(`Waiting for metadata for torrent ${torrent.infoHash}...`);
            if (!this.downloads.has(torrent.infoHash)) {
               this.downloads.set(torrent.infoHash, {
                 infoHash: torrent.infoHash,
                 name: torrent.name || `Torrent ${torrent.infoHash}`,
                 progress: 0,
                 downloadSpeed: 0,
                 peers: 0,
                 created: new Date().toISOString(),
                 waiting: true // Flag to indicate we're waiting for files
               });
             }
             
            torrent.on('metadata', () => {
               console.log(`Metadata received for ${torrent.infoHash}, processing files...`);
               this._processTorrentFiles(torrent, resolve, reject); 
             });
          }
          
          // Removed the direct file processing logic from here
          
        })
      } catch (err) {
        console.error('Error downloading torrent:', err)
        reject(err)
      }
    })
  }
  
  /**
   * Get info about a download
   * @param {string} infoHash - The torrent info hash
   * @returns {object|null} - Information about the download
   */
  getDownloadInfo(infoHash) {
    if (!infoHash) return null
    
    // Normalize the infoHash (case-insensitive)
    const normalizedHash = infoHash.toLowerCase()
    const downloadInfo = this.downloads.get(normalizedHash)
    
    if (downloadInfo) {
      // Update torrent info 
      const torrent = this.client.get(normalizedHash)
      
      // Debug the torrent object
      if (torrent) {
        console.log(`Debug torrent info:`)
        console.log(`- Progress: ${torrent.progress * 100}%`)
        console.log(`- Downloaded: ${this._formatBytes(torrent.downloaded)}`)
        console.log(`- Total size: ${this._formatBytes(torrent.length)}`)
        console.log(`- Download speed: ${this._formatBytes(torrent.downloadSpeed)}/s`)
        console.log(`- Number of peers: ${torrent.numPeers}`)
        
        // Ensure progress is a number between 0-100
        downloadInfo.progress = Math.min(100, Math.max(0, Math.round(torrent.progress * 100))) || 0
        downloadInfo.downloadSpeed = torrent.downloadSpeed || 0
        downloadInfo.downloadedSpeed = this._formatBytes(torrent.downloadSpeed || 0) + '/s'
        downloadInfo.peers = torrent.numPeers || 0
        downloadInfo.downloaded = this._formatBytes(torrent.downloaded || 0)
        
        // Calculate time remaining
        if (torrent.timeRemaining) {
          const seconds = Math.floor(torrent.timeRemaining / 1000)
          const minutes = Math.floor(seconds / 60)
          const hours = Math.floor(minutes / 60)
          
          if (hours > 0) {
            downloadInfo.timeRemainingFormatted = `${hours}h ${minutes % 60}m remaining`
          } else if (minutes > 0) {
            downloadInfo.timeRemainingFormatted = `${minutes}m ${seconds % 60}s remaining`
          } else {
            downloadInfo.timeRemainingFormatted = `${seconds}s remaining`
          }
          
          downloadInfo.timeRemaining = seconds
        }
        
        // Log current status
        console.log(`Status for ${infoHash}: ${downloadInfo.progress}% at ${downloadInfo.downloadedSpeed}, peers: ${downloadInfo.peers}`)
      } else {
        // Check if we have direct download stats in the download info
        // This happens when the torrent object is not in the client but we have updates from the download handler
        // Get fresh stats from the file system
        try {
          const filePath = downloadInfo.videoFile.path
          if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath)
            const fileSize = downloadInfo.videoFile.length || 0
            
            if (fileSize > 0 && stats.size > 0) {
              // Calculate progress based on file size
              const fileProgress = Math.min(100, Math.max(0, Math.round((stats.size / fileSize) * 100)))
              
              console.log(`No torrent in client, using file stats: ${stats.size} / ${fileSize} = ${fileProgress}%`)
              
              // Update download info
              downloadInfo.progress = fileProgress
              downloadInfo.downloaded = this._formatBytes(stats.size)
            }
          }
        } catch (err) {
          console.error(`Error getting file stats for progress calculation: ${err.message}`)
        }
        
        // If the torrent isn't found in the client, ensure we have some default values
        if (downloadInfo.progress === null || downloadInfo.progress === undefined) {
          downloadInfo.progress = 0
        }
        if (!downloadInfo.downloaded) {
          downloadInfo.downloaded = '0 Bytes'
        }
        if (!downloadInfo.downloadSpeed) {
          downloadInfo.downloadSpeed = 0
          downloadInfo.downloadedSpeed = '0 B/s'
        }
        if (!downloadInfo.peers) {
          downloadInfo.peers = 0
        }
        
        console.log(`Using fallback status: ${downloadInfo.progress}% downloaded: ${downloadInfo.downloaded}`)
      }
    }
    
    return downloadInfo || null
  }
  
  /**
   * List all active downloads
   * @returns {Array<object>} - All active downloads
   */
  listDownloads() {
    return Array.from(this.downloads.values())
  }
  
  /**
   * Clean up a specific download
   * @param {string} infoHash - The torrent info hash
   */
  removeDownload(infoHash) {
    if (!infoHash) return
    
    // Normalize the infoHash (case-insensitive)
    const normalizedHash = infoHash.toLowerCase()
    
    if (this.downloads.has(normalizedHash)) {
      const torrent = this.client.get(normalizedHash)
      if (torrent) {
        console.log(`Destroying torrent: ${normalizedHash}`)
        torrent.destroy()
      }
      this.downloads.delete(normalizedHash)
      
      // Optionally delete the torrent directory
      // fs.remove(path.join(this.tempDir, normalizedHash))
      //   .catch(err => console.error(`Error removing torrent directory: ${err.message}`))
    }
  }

  /**
   * Extract info hash from magnet URI
   * @private
   */
  _extractInfoHash(magnetUri) {
    if (!magnetUri) return null;
    
    // If it's a 40-char hex string, it's already an info hash
    if (/^[a-f0-9]{40}$/i.test(magnetUri)) {
      return magnetUri.toLowerCase();
    }
    
    // Extract from magnet URI
    const match = magnetUri.match(/urn:btih:([a-f0-9]{40})/i);
    if (match) {
      return match[1].toLowerCase();
    }
    
    return null;
  }
  
  /**
   * Get MIME type from file extension
   * @private
   */
  _getFileType(filename) {
    const ext = path.extname(filename).toLowerCase();
    
    switch (ext) {
      case '.mp4':
        return 'video/mp4';
      case '.webm':
        return 'video/webm';
      case '.mkv':
        return 'video/x-matroska';
      case '.avi':
        return 'video/x-msvideo';
      case '.mov':
        return 'video/quicktime';
      case '.m4v':
        return 'video/mp4';
      case '.mpg':
      case '.mpeg':
        return 'video/mpeg';
      default:
        return 'application/octet-stream';
    }
  }
  
  /**
   * Format bytes to human-readable format
   * @private
   */
  _formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
  
  /**
   * Destroy the client and clean up resources
   */
  destroy() {
    if (this.client) {
      console.log('Destroying WebTorrent client and cleaning up resources');
      this.client.destroy();
    }
  }
}

// Export a singleton instance
const downloader = new TorrentDownloader();
export default downloader;