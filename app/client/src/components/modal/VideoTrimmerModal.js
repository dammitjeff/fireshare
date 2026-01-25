import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Modal,
  Paper,
  Slide,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import ContentCutIcon from '@mui/icons-material/ContentCut'
import { getUrl, getServedBy, getVideoUrl, toHHMMSS } from '../../common/utils'
import { VideoService } from '../../services'
import SnackbarAlert from '../alert/SnackbarAlert'

const URL = getUrl()
const SERVED_BY = getServedBy()

const THUMBNAIL_COUNT = 10
const THUMBNAIL_HEIGHT = 50
const THUMBNAIL_QUALITY = 0.5

const VideoTrimmerModal = ({ open, onClose, video, onTrimComplete }) => {
  const [thumbnails, setThumbnails] = useState([])
  const [loading, setLoading] = useState(true)
  const [trimming, setTrimming] = useState(false)
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [saveAsNew, setSaveAsNew] = useState(false)
  const [alert, setAlert] = useState({ open: false })
  const [dragging, setDragging] = useState(null) // 'start', 'end', or null

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const timelineRef = useRef(null)
  const duration = video?.info?.duration || 0

  // Generate thumbnails from video
  const generateThumbnails = useCallback(async () => {
    if (!video || !duration) return

    const videoEl = videoRef.current
    const canvas = canvasRef.current
    if (!videoEl || !canvas) return

    const ctx = canvas.getContext('2d')
    const thumbs = []
    const interval = duration / THUMBNAIL_COUNT

    // Set canvas size based on video aspect ratio
    const aspectRatio = videoEl.videoWidth / videoEl.videoHeight
    canvas.width = Math.round(THUMBNAIL_HEIGHT * aspectRatio)
    canvas.height = THUMBNAIL_HEIGHT

    for (let i = 0; i < THUMBNAIL_COUNT; i++) {
      const time = i * interval
      videoEl.currentTime = time

      await new Promise((resolve) => {
        const onSeeked = () => {
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height)
          thumbs.push({
            time,
            dataUrl: canvas.toDataURL('image/jpeg', THUMBNAIL_QUALITY),
          })
          videoEl.removeEventListener('seeked', onSeeked)
          resolve()
        }
        videoEl.addEventListener('seeked', onSeeked)
      })
    }

    setThumbnails(thumbs)
    setLoading(false)
    videoEl.currentTime = 0
  }, [video, duration])

  // Initialize when video changes
  useEffect(() => {
    if (open && video && duration > 0) {
      setStartTime(0)
      setEndTime(duration)
      setCurrentTime(0)
      setLoading(true)
      setThumbnails([])
      setSaveAsNew(false)
    }
  }, [open, video, duration])

  // Handle video loaded
  const handleVideoLoaded = () => {
    generateThumbnails()
  }

  // Preview playback - only play selected range
  useEffect(() => {
    const videoEl = videoRef.current
    if (!videoEl || !isPlaying) return

    const handleTimeUpdate = () => {
      setCurrentTime(videoEl.currentTime)
      if (videoEl.currentTime >= endTime) {
        videoEl.pause()
        videoEl.currentTime = startTime
        setIsPlaying(false)
        setCurrentTime(startTime)
      }
    }

    videoEl.addEventListener('timeupdate', handleTimeUpdate)
    return () => videoEl.removeEventListener('timeupdate', handleTimeUpdate)
  }, [isPlaying, startTime, endTime])

  const togglePlayback = () => {
    const videoEl = videoRef.current
    if (!videoEl) return

    if (isPlaying) {
      videoEl.pause()
      setIsPlaying(false)
    } else {
      videoEl.currentTime = startTime
      videoEl.play()
      setIsPlaying(true)
    }
  }

  // Calculate position percentage from time
  const timeToPercent = (time) => (time / duration) * 100

  // Calculate time from position
  const percentToTime = (percent) => (percent / 100) * duration

  // Handle timeline click/drag
  const handleTimelineMouseDown = (e, handle) => {
    e.preventDefault()
    setDragging(handle)
  }

  const handleTimelineMouseMove = useCallback(
    (e) => {
      if (!dragging || !timelineRef.current) return

      const rect = timelineRef.current.getBoundingClientRect()
      const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
      const time = percentToTime(percent)

      if (dragging === 'start') {
        setStartTime(Math.min(time, endTime - 0.5))
      } else if (dragging === 'end') {
        setEndTime(Math.max(time, startTime + 0.5))
      }
    },
    [dragging, startTime, endTime, duration]
  )

  const handleTimelineMouseUp = useCallback(() => {
    setDragging(null)
  }, [])

  // Add global mouse listeners for dragging
  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleTimelineMouseMove)
      window.addEventListener('mouseup', handleTimelineMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleTimelineMouseMove)
        window.removeEventListener('mouseup', handleTimelineMouseUp)
      }
    }
  }, [dragging, handleTimelineMouseMove, handleTimelineMouseUp])

  // Handle trim submission
  const handleTrim = async () => {
    if (trimming) return

    setTrimming(true)
    try {
      const result = await VideoService.trimVideo(video.video_id, startTime, endTime, saveAsNew)
      setAlert({
        type: 'success',
        message: saveAsNew ? 'New trimmed clip created!' : 'Video trimmed successfully!',
        open: true,
      })

      // Wait a moment for user to see success message
      setTimeout(() => {
        onTrimComplete && onTrimComplete(result.data, saveAsNew)
        onClose()
      }, 1500)
    } catch (err) {
      console.error('Trim error:', err)
      setAlert({
        type: 'error',
        message: err.response?.data || 'Failed to trim video',
        open: true,
      })
      setTrimming(false)
    }
  }

  const getPosterUrl = () => {
    if (!video) return ''
    if (SERVED_BY === 'nginx') {
      return `${URL}/_content/derived/${video.video_id}/poster.jpg`
    }
    return `${URL}/api/video/poster?id=${video.video_id}`
  }

  const getVideoSrc = (forThumbnails = false) => {
    if (!video) return ''
    // Use 720p for thumbnail generation if available (much faster to seek)
    if (forThumbnails && video.info?.has_720p) {
      return getVideoUrl(video.video_id, '720p', video.extension)
    }
    return getVideoUrl(video.video_id, 'original', video.extension)
  }

  const trimDuration = endTime - startTime

  if (!video) return null

  return (
    <>
      <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert({ ...alert, open })}>
        {alert.message}
      </SnackbarAlert>
      <Modal open={open} onClose={trimming ? undefined : onClose} closeAfterTransition disableAutoFocus>
        <Slide in={open}>
          <Paper
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: { xs: '95%', sm: '90%', md: '80%' },
              maxWidth: 900,
              maxHeight: '90vh',
              overflow: 'auto',
              background: '#1a1a2e',
              borderRadius: 2,
              p: 3,
            }}
          >
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ContentCutIcon /> Trim Video
              </Typography>
              <IconButton onClick={onClose} disabled={trimming} sx={{ color: 'white' }}>
                <CloseIcon />
              </IconButton>
            </Box>

            {/* Hidden video for thumbnail generation */}
            <video
              ref={videoRef}
              src={getVideoSrc(true)}
              poster={getPosterUrl()}
              onLoadedData={handleVideoLoaded}
              crossOrigin="anonymous"
              muted
              playsInline
              style={{ display: loading ? 'none' : 'block', width: '100%', borderRadius: 8 }}
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Loading state */}
            {loading && (
              <Box
                sx={{
                  height: 300,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                }}
              >
                <CircularProgress />
                <Typography variant="body2" color="text.secondary">
                  Loading video thumbnails...
                </Typography>
              </Box>
            )}

            {/* Timeline with thumbnails */}
            {!loading && (
              <Box sx={{ mt: 2 }}>
                {/* Time display */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="primary">
                    Start: {toHHMMSS(startTime)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Duration: {toHHMMSS(trimDuration)}
                  </Typography>
                  <Typography variant="body2" color="error">
                    End: {toHHMMSS(endTime)}
                  </Typography>
                </Box>

                {/* Thumbnail timeline */}
                <Box
                  ref={timelineRef}
                  sx={{
                    position: 'relative',
                    height: THUMBNAIL_HEIGHT + 20,
                    borderRadius: 1,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  {/* Thumbnails */}
                  <Box sx={{ display: 'flex', height: THUMBNAIL_HEIGHT }}>
                    {thumbnails.map((thumb, i) => (
                      <Box
                        key={i}
                        sx={{
                          flex: 1,
                          backgroundImage: `url(${thumb.dataUrl})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}
                      />
                    ))}
                  </Box>

                  {/* Darkened areas outside selection */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: `${timeToPercent(startTime)}%`,
                      height: THUMBNAIL_HEIGHT,
                      background: 'rgba(0, 0, 0, 0.7)',
                      pointerEvents: 'none',
                    }}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: `${100 - timeToPercent(endTime)}%`,
                      height: THUMBNAIL_HEIGHT,
                      background: 'rgba(0, 0, 0, 0.7)',
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Selection border */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: `${timeToPercent(startTime)}%`,
                      width: `${timeToPercent(endTime) - timeToPercent(startTime)}%`,
                      height: THUMBNAIL_HEIGHT,
                      border: '2px solid #1976d2',
                      borderRadius: 0.5,
                      boxSizing: 'border-box',
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Start handle */}
                  <Box
                    onMouseDown={(e) => handleTimelineMouseDown(e, 'start')}
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: `${timeToPercent(startTime)}%`,
                      transform: 'translateX(-50%)',
                      width: 16,
                      height: THUMBNAIL_HEIGHT + 20,
                      background: '#1976d2',
                      borderRadius: 1,
                      cursor: 'ew-resize',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      '&:hover': { background: '#1565c0' },
                      '&::after': {
                        content: '""',
                        width: 4,
                        height: 20,
                        background: 'rgba(255,255,255,0.5)',
                        borderRadius: 2,
                      },
                    }}
                  />

                  {/* End handle */}
                  <Box
                    onMouseDown={(e) => handleTimelineMouseDown(e, 'end')}
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: `${timeToPercent(endTime)}%`,
                      transform: 'translateX(-50%)',
                      width: 16,
                      height: THUMBNAIL_HEIGHT + 20,
                      background: '#d32f2f',
                      borderRadius: 1,
                      cursor: 'ew-resize',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      '&:hover': { background: '#c62828' },
                      '&::after': {
                        content: '""',
                        width: 4,
                        height: 20,
                        background: 'rgba(255,255,255,0.5)',
                        borderRadius: 2,
                      },
                    }}
                  />

                  {/* Current time indicator (during playback) */}
                  {isPlaying && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: `${timeToPercent(currentTime)}%`,
                        width: 2,
                        height: THUMBNAIL_HEIGHT,
                        background: '#fff',
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                </Box>

                {/* Controls */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                    onClick={togglePlayback}
                    disabled={trimming}
                  >
                    {isPlaying ? 'Pause' : 'Preview'}
                  </Button>

                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={saveAsNew}
                        onChange={(e) => setSaveAsNew(e.target.checked)}
                        disabled={trimming}
                      />
                    }
                    label="Save as new clip (keep original)"
                  />
                </Box>

                {/* Trim button */}
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  size="large"
                  startIcon={trimming ? <CircularProgress size={20} color="inherit" /> : <ContentCutIcon />}
                  onClick={handleTrim}
                  disabled={trimming || trimDuration < 0.5}
                  sx={{ mt: 2 }}
                >
                  {trimming ? 'Trimming...' : `Trim to ${toHHMMSS(trimDuration)}`}
                </Button>

                {trimDuration < 0.5 && (
                  <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
                    Minimum trim duration is 0.5 seconds
                  </Typography>
                )}
              </Box>
            )}
          </Paper>
        </Slide>
      </Modal>
    </>
  )
}

export default VideoTrimmerModal
