import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import path from 'path'
import { fileURLToPath } from 'url'
import torrentApi from './torrentApi.js'

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Create express app
const app = express()
const PORT = process.env.PORT || 3001

// Configure CORS with specific options
const corsOptions = {
  origin: ['http://localhost:8080', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}

// Middleware
app.use(cors(corsOptions))
app.use(bodyParser.json({ limit: '10mb' })) // Increase limit for large magnet URIs
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }))

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} [${req.method}] ${req.url}`)
  next()
})

// API routes
app.use('/api/torrent', torrentApi)

// Basic API health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Torrent server is running',
    timestamp: new Date().toISOString()
  })
})

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../dist')))
  
  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../dist/index.html'))
  })
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack)
  res.status(500).json({
    error: 'Server error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
  })
})

// Handle 404 errors
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `The requested resource at ${req.url} was not found`
  })
})

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Torrent API available at http://localhost:${PORT}/api/torrent`)
  console.log(`Health check at http://localhost:${PORT}/api/health`)
})

// Handle shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...')
  
  // Close the HTTP server
  server.close(() => {
    console.log('HTTP server closed.')
    
    // Clean up torrent downloader
    const torrentDownloaderCleanup = async () => {
      try {
        const torrentDownloader = await import('./torrentDownloader.js')
        torrentDownloader.default.destroy()
        console.log('Torrent downloader resources cleaned up.')
      } catch (err) {
        console.error('Error cleaning up torrent downloader:', err)
      }
    }
    
    torrentDownloaderCleanup().then(() => {
      console.log('Graceful shutdown completed.')
      process.exit(0)
    })
  })
  
  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    console.error('Forcing shutdown after timeout...')
    process.exit(1)
  }, 10000)
})

export default app 