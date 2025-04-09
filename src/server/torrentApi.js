import express from 'express'
import fs from 'fs'
import path from 'path'
import torrentDownloader from './torrentDownloader.js'

const router = express.Router()

// Start downloading a torrent
router.post('/download', async (req, res) => {
  try {
    const { magnetUri } = req.body
    
    if (!magnetUri) {
      return res.status(400).json({ error: 'Magnet URI is required' })
    }
    
    console.log(`Received download request for: ${magnetUri.substring(0, 60)}...`)
    
    const downloadInfo = await torrentDownloader.downloadTorrent(magnetUri)
    
    console.log(`Download started for: ${downloadInfo.name} (${downloadInfo.infoHash})`)
    
    res.json({
      success: true,
      data: downloadInfo
    })
  } catch (error) {
    console.error('Error starting download:', error)
    res.status(500).json({ error: 'Failed to start torrent download', message: error.message })
  }
})

// Get info about a specific download
router.get('/status/:infoHash', (req, res) => {
  const { infoHash } = req.params
  
  const downloadInfo = torrentDownloader.getDownloadInfo(infoHash)
  
  if (!downloadInfo) {
    return res.status(404).json({ error: 'Download not found' })
  }
  
  res.json({
    success: true,
    data: downloadInfo
  })
})

// List all active downloads
router.get('/list', (req, res) => {
  const downloads = torrentDownloader.listDownloads()
  
  res.json({
    success: true,
    data: downloads,
    count: downloads.length
  })
})

// Stream a file from a torrent
router.get('/stream/:infoHash', (req, res) => {
  const { infoHash } = req.params
  
  console.log(`Stream request for torrent: ${infoHash}`)
  
  const downloadInfo = torrentDownloader.getDownloadInfo(infoHash)
  
  if (!downloadInfo) {
    console.log(`Download not found for infoHash: ${infoHash}`)
    return res.status(404).json({ error: 'Download not found' })
  }
  
  const filePath = downloadInfo.videoFile.path
  console.log(`File path for streaming: ${filePath}`)
  
  // Verify the file path exists and is accessible
  try {
    fs.accessSync(filePath, fs.constants.R_OK)
    console.log(`File exists and is readable: ${filePath}`)
  } catch (accessErr) {
    console.error(`File access error: ${accessErr.message}`)
    
    // Try to create the directory and an empty file if it doesn't exist
    try {
      const dirPath = path.dirname(filePath)
      fs.ensureDirSync(dirPath)
      console.log(`Directory created/verified: ${dirPath}`)
      
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, Buffer.alloc(0))
        console.log(`Created empty placeholder file at ${filePath}`)
      }
    } catch (createErr) {
      console.error(`Error creating file/directory: ${createErr.message}`)
      return res.status(500).json({ 
        error: 'File not accessible',
        message: 'Cannot access or create the video file',
        details: createErr.message
      })
    }
  }
  
  // Get file stats (size)
  let stat
  try {
    stat = fs.statSync(filePath)
    console.log(`File stats: size=${formatBytes(stat.size)}, isFile=${stat.isFile()}, permissions=${stat.mode.toString(8)}`)
  } catch (err) {
    console.error(`Error getting file stats: ${err.message}`)
    return res.status(500).json({ error: 'Error getting file stats', details: err.message })
  }
  
  // Get the file size from the download info or actual file
  const fileSize = downloadInfo.videoFile.length || stat.size || 0
  
  // Use our getMimeType function to better support various video formats
  const contentType = getMimeType(downloadInfo.videoFile.name)
  console.log(`Using MIME type ${contentType} for file ${downloadInfo.videoFile.name}`)
  
  console.log(`Preparing to stream file: ${downloadInfo.videoFile.name}`)
  console.log(`Content type: ${contentType}, Total file size: ${formatBytes(fileSize)}`)
  console.log(`Current download progress: ${downloadInfo.progress}%, actually downloaded: ${downloadInfo.downloaded}`)
  
  // Calculate how much of the file is available
  const progress = typeof downloadInfo.progress === 'number' ? downloadInfo.progress : 0
  const downloadedBytes = Math.max(Math.floor(fileSize * (progress / 100)), stat.size)
  console.log(`Calculated available data: ${formatBytes(downloadedBytes)} bytes (${progress}%)`)
  
  // Parse range request
  const range = req.headers.range
  console.log(`Range request header: ${range}`)
  
  if (range) {
    // Parse range header
    const parts = range.replace(/bytes=/, '').split('-')
    const start = parseInt(parts[0], 10)
    const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 1024 * 1024, fileSize - 1) // Limit chunk size
    
    // Check if the file has any data we can stream
    if (stat.size === 0) {
      console.log('File exists but is empty, cannot stream yet')
      return res.status(404).json({ 
        error: 'File not ready yet',
        progress: progress,
        message: 'The file is being downloaded but no data is available yet'
      })
    }
    
    // Calculate the actual end point based on what's available
    const availableEnd = Math.min(end, stat.size - 1)
    
    console.log(`Requested range: ${start}-${end}, available: 0-${stat.size-1}, serving: ${start}-${availableEnd}`)
    
    // Check if the requested range is beyond what we have
    if (start >= stat.size) {
      console.log(`Requested range exceeds available data (${start} >= ${stat.size})`)
      return res.status(416).json({ 
        error: 'Range Not Satisfiable',
        message: 'Requested range not available yet, file is still downloading',
        progress: progress
      })
    }
    
    // Calculate chunk size
    const chunkSize = availableEnd - start + 1
    
    console.log(`Serving range request: bytes ${start}-${availableEnd}/${fileSize} (${formatBytes(chunkSize)})`)
    
    try {
      // Set HTTP headers for streaming
      const headers = {
        'Content-Range': `bytes ${start}-${availableEnd}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Connection': 'keep-alive'
      }
      
      // 206 Partial Content
      res.writeHead(206, headers)
      
      // Create the stream with error handling
      const fileStream = fs.createReadStream(filePath, { start, end: availableEnd })
      
      fileStream.on('error', (err) => {
        console.error(`Stream error: ${err.message}`)
        if (!res.headersSent) {
          res.status(500).json({ error: 'Streaming error', details: err.message })
        } else {
          res.end()
        }
      })
      
      fileStream.on('end', () => {
        console.log(`Successfully streamed ${formatBytes(chunkSize)} from ${filePath}`)
      })
      
      // Pipe the file to the response
      fileStream.pipe(res)
    } catch (err) {
      console.error(`Error creating read stream: ${err.message}`)
      return res.status(500).json({ error: 'Error streaming file', details: err.message })
    }
  } else {
    // No range requested, send file info
    console.log(`Initial request (no range) for: ${downloadInfo.videoFile.name}`)
    
    if (stat.size === 0) {
      console.log('File exists but is empty, returning metadata only')
      const headers = {
        'Content-Length': 0,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes'
      }
      res.writeHead(200, headers)
      res.end()
      return
    }
    
    try {
      // Just send headers and a small part of the beginning
      const headers = {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
      
      res.writeHead(200, headers)
      
      // Send a small part of the file to help the player initialize
      const initialChunkSize = Math.min(64 * 1024, stat.size) // 64KB or file size if smaller
      const initialStream = fs.createReadStream(filePath, { start: 0, end: initialChunkSize - 1 })
      
      initialStream.on('error', (err) => {
        console.error(`Initial stream error: ${err.message}`)
        res.end()
      })
      
      initialStream.on('end', () => {
        console.log(`Sent initial ${formatBytes(initialChunkSize)} chunk to initialize player`)
        res.end()
      })
      
      initialStream.pipe(res)
    } catch (err) {
      console.error(`Error handling initial request: ${err.message}`)
      res.status(500).json({ error: 'Error preparing stream', details: err.message })
    }
  }
})

// Delete a download
router.delete('/download/:infoHash', (req, res) => {
  const { infoHash } = req.params
  
  try {
    torrentDownloader.removeDownload(infoHash)
    
    res.json({
      success: true,
      message: 'Download removed'
    })
  } catch (error) {
    console.error(`Error removing download: ${error.message}`)
    res.status(500).json({ error: 'Failed to remove download' })
  }
})

// Format bytes to human-readable format
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

// Function to get MIME type from file extension
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase()
  
  switch (ext) {
    case '.mp4':
      return 'video/mp4'
    case '.webm':
      return 'video/webm'
    case '.mkv':
      // Most browsers don't support MKV natively, so use octet-stream
      // Some browsers like Chrome can still play it if the codec is supported
      return 'application/octet-stream'
    case '.avi':
      return 'video/x-msvideo'
    case '.mov':
      return 'video/quicktime'
    case '.m4v':
      return 'video/mp4'
    case '.mpg':
    case '.mpeg':
      return 'video/mpeg'
    default:
      return 'application/octet-stream'
  }
}

// Add ffprobe helper (if available) to detect video codec info
// This is just for debugging and not required
function detectVideoCodec(filePath, callback) {
  try {
    const { execFile } = require('child_process')
    
    execFile('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_name,width,height',
      '-of', 'json',
      filePath
    ], (error, stdout) => {
      if (error) {
        console.log('FFprobe not available or error:', error.message)
        callback(null)
        return
      }
      
      try {
        const info = JSON.parse(stdout)
        console.log('Video codec info:', info)
        callback(info)
      } catch (e) {
        console.log('Error parsing ffprobe output:', e.message)
        callback(null)
      }
    })
  } catch (e) {
    console.log('FFprobe detection error:', e.message)
    callback(null)
  }
}

export default router 