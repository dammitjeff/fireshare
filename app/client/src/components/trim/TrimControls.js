import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import ContentCutIcon from '@mui/icons-material/ContentCut'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import CloseIcon from '@mui/icons-material/Close'
import { getUrl, getServedBy, getVideoUrl, toHHMMSS } from '../../common/utils'
import { VideoService } from '../../services'

const URL = getUrl()
const SERVED_BY = getServedBy()

const THUMBNAIL_COUNT = 10
const THUMBNAIL_HEIGHT = 50
const THUMBNAIL_QUALITY = 0.5

const TrimControls = ({ video, playerRef, onTrimComplete, onCancel, onAlert }) => {
  const theme = useTheme()
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const thumbnailHeight = isSmallScreen ? 40 : THUMBNAIL_HEIGHT
  const [thumbnails, setThumbnails] = useState([])
  const [loading, setLoading] = useState(true)
  const [trimming, setTrimming] = useState(false)
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [saveAsNew, setSaveAsNew] = useState(false)
  const [dragging, setDragging] = useState(null)

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

    const aspectRatio = videoEl.videoWidth / videoEl.videoHeight
    canvas.width = Math.round(thumbnailHeight * aspectRatio)
    canvas.height = thumbnailHeight

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
  }, [video, duration, thumbnailHeight])

  // Initialize
  useEffect(() => {
    if (video && duration > 0) {
      setStartTime(0)
      setEndTime(duration)
      setCurrentTime(0)
      setLoading(true)
      setThumbnails([])
      setSaveAsNew(false)
    }
  }, [video, duration])

  const handleVideoLoaded = () => {
    generateThumbnails()
  }

  // Always track player position and show playhead
  useEffect(() => {
    const player = playerRef?.current
    if (!player) return

    const handleTimeUpdate = () => {
      const time = player.currentTime()
      setCurrentTime(time)

      // If in preview mode and reached end, stop and reset
      if (isPlaying && time >= endTime) {
        player.pause()
        player.currentTime(startTime)
        setIsPlaying(false)
        setCurrentTime(startTime)
      }
    }

    player.on('timeupdate', handleTimeUpdate)
    return () => player.off('timeupdate', handleTimeUpdate)
  }, [isPlaying, startTime, endTime, playerRef])

  const togglePlayback = () => {
    const player = playerRef?.current
    if (!player) return

    if (isPlaying) {
      player.pause()
      setIsPlaying(false)
    } else {
      player.currentTime(startTime)
      player.play()
      setIsPlaying(true)
    }
  }

  const timeToPercent = (time) => (time / duration) * 100
  const percentToTime = (percent) => (percent / 100) * duration

  const handleTimelineMouseDown = (e, handle) => {
    e.preventDefault()
    setDragging(handle)
  }

  const handleTimelineTouchStart = (e, handle) => {
    e.preventDefault()
    setDragging(handle)
  }

  const handleTimelineMouseMove = useCallback(
    (e) => {
      if (!dragging || !timelineRef.current) return

      if (e.cancelable) e.preventDefault()

      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const rect = timelineRef.current.getBoundingClientRect()
      const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
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

  // Click on timeline to seek
  const handleTimelineClick = (e) => {
    if (dragging || !timelineRef.current) return

    const rect = timelineRef.current.getBoundingClientRect()
    const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    const time = percentToTime(percent)

    const player = playerRef?.current
    if (player) {
      player.currentTime(time)
      setCurrentTime(time)
    }
  }

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleTimelineMouseMove)
      window.addEventListener('mouseup', handleTimelineMouseUp)
      window.addEventListener('touchmove', handleTimelineMouseMove, { passive: false })
      window.addEventListener('touchend', handleTimelineMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleTimelineMouseMove)
        window.removeEventListener('mouseup', handleTimelineMouseUp)
        window.removeEventListener('touchmove', handleTimelineMouseMove)
        window.removeEventListener('touchend', handleTimelineMouseUp)
      }
    }
  }, [dragging, handleTimelineMouseMove, handleTimelineMouseUp])

  const handleTrim = async () => {
    if (trimming) return

    setTrimming(true)
    try {
      const result = await VideoService.trimVideo(video.video_id, startTime, endTime, saveAsNew)
      onAlert?.({
        type: 'success',
        message: saveAsNew ? 'New trimmed clip created!' : 'Video trimmed successfully!',
        open: true,
      })

      setTimeout(() => {
        onTrimComplete?.(result.data, saveAsNew)
      }, 1500)
    } catch (err) {
      console.error('Trim error:', err)
      onAlert?.({
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

  const getVideoSrc = () => {
    if (!video) return ''
    if (video.info?.has_720p) {
      return getVideoUrl(video.video_id, '720p', video.extension)
    }
    return getVideoUrl(video.video_id, 'original', video.extension)
  }

  const trimDuration = endTime - startTime

  if (!video) return null

  return (
    <Box sx={{ width: '100%' }}>
      {/* Hidden video for thumbnail generation */}
      <video
        ref={videoRef}
        src={getVideoSrc()}
        poster={getPosterUrl()}
        onLoadedData={handleVideoLoaded}
        crossOrigin="anonymous"
        muted
        playsInline
        style={{ display: 'none' }}
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Loading state */}
      {loading && (
        <Box
          sx={{
            py: 3,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <CircularProgress size={24} />
          <Typography variant="body2" color="text.secondary">
            Loading trim controls...
          </Typography>
        </Box>
      )}

      {/* Trim controls */}
      {!loading && (
        <Box>
          {/* Time display */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" sx={{ color: '#bbb464' }}>
              Start: {toHHMMSS(startTime)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Duration: {toHHMMSS(trimDuration)}
            </Typography>
            <Typography variant="body2" sx={{ color: '#bbb464' }}>
              End: {toHHMMSS(endTime)}
            </Typography>
          </Box>

          {/* Thumbnail timeline */}
          <Box
            ref={timelineRef}
            onClick={handleTimelineClick}
            sx={{
              position: 'relative',
              height: thumbnailHeight + 20,
              cursor: 'pointer',
              userSelect: 'none',
              touchAction: 'none',
              overscrollBehavior: 'none',
              mx: { xs: 2, sm: 0 },
            }}
          >
            {/* Thumbnails */}
            <Box sx={{ display: 'flex', height: thumbnailHeight }}>
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
                height: thumbnailHeight,
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
                height: thumbnailHeight,
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
                height: thumbnailHeight,
                border: '2px solid #d8db04',
                boxSizing: 'border-box',
                pointerEvents: 'none',
              }}
            />

            {/* Start handle */}
            <Box
              onMouseDown={(e) => handleTimelineMouseDown(e, 'start')}
              onTouchStart={(e) => handleTimelineTouchStart(e, 'start')}
              sx={{
                position: 'absolute',
                top: -10,
                left: `${timeToPercent(startTime)}%`,
                transform: 'translateX(-50%)',
                width: { xs: 16, sm: 8 },
                height: thumbnailHeight + 20,
                background: '#d8db04',
                cursor: 'ew-resize',
                touchAction: 'none',
                '&:hover': { background: '#e8eb34' },
              }}
            />

            {/* End handle */}
            <Box
              onMouseDown={(e) => handleTimelineMouseDown(e, 'end')}
              onTouchStart={(e) => handleTimelineTouchStart(e, 'end')}
              sx={{
                position: 'absolute',
                top: -10,
                left: `${timeToPercent(endTime)}%`,
                transform: 'translateX(-50%)',
                width: { xs: 16, sm: 8 },
                height: thumbnailHeight + 20,
                background: '#d8db04',
                cursor: 'ew-resize',
                touchAction: 'none',
                '&:hover': { background: '#e8eb34' },
              }}
            />

            {/* Current time indicator (playhead) - always visible */}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: `${timeToPercent(currentTime)}%`,
                width: 2,
                height: thumbnailHeight,
                background: '#fff',
                boxShadow: '0 0 4px rgba(0,0,0,0.5)',
                pointerEvents: 'none',
                transition: isPlaying ? 'none' : 'left 0.1s ease-out',
              }}
            />
          </Box>

          {/* Controls row - stacks vertically on mobile */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mt: 2,
            gap: 1,
            flexDirection: { xs: 'column', sm: 'row' },
          }}>
            <Box sx={{
              display: 'flex',
              gap: 1,
              width: { xs: '100%', sm: 'auto' },
              flexDirection: { xs: 'column', sm: 'row' },
            }}>
              <Button
                variant="contained"
                size="small"
                startIcon={isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                onClick={togglePlayback}
                disabled={trimming}
                sx={{
                  width: { xs: '100%', sm: 'auto' },
                  py: { xs: 0.5 },
                  minHeight: { xs: 32 },
                  fontSize: { xs: '0.875rem' },
                }}
              >
                {isPlaying ? 'Pause' : 'Preview'}
              </Button>
              <Button
                variant="contained"
                size="small"
                startIcon={<CloseIcon />}
                onClick={onCancel}
                disabled={trimming}
                sx={{
                  width: { xs: '100%', sm: 'auto' },
                  py: { xs: 0.5 },
                  minHeight: { xs: 32 },
                  fontSize: { xs: '0.875rem' },
                }}
              >
                Cancel
              </Button>
            </Box>

            <FormControlLabel
              sx={{
                width: { xs: '100%', sm: 'auto' },
                display: 'flex',
                justifyContent: { xs: 'center', sm: 'flex-start' },
                mx: 0,
                '& .MuiFormControlLabel-label': {
                  textAlign: { xs: 'center', sm: 'left' },
                },
              }}
              control={
                <Checkbox
                  checked={saveAsNew}
                  onChange={(e) => setSaveAsNew(e.target.checked)}
                  disabled={trimming}
                  size="small"
                />
              }
              label={<Typography variant="body2">Save as new clip</Typography>}
            />
          </Box>

          {/* Trim button */}
          <Button
            fullWidth
            variant="contained"
            color="primary"
            startIcon={trimming ? <CircularProgress size={20} color="inherit" /> : undefined}
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
    </Box>
  )
}

export default TrimControls
