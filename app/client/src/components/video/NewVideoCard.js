import React from 'react'
import { Box, Typography, Avatar } from '@mui/material'
import { getServedBy, getUrl, toHHMMSS, getVideoUrl } from '../../common/utils'
import GameService from '../../services/GameService'
import _ from 'lodash'

const URL = getUrl()
const SERVED_BY = getServedBy()

const textStyle = (fontSize, color, extra = {}) => ({
  fontSize,
  color,
  lineHeight: 1.4,
  ...extra,
})

const fadeInAnimation = {
  opacity: 0,
  animation: 'fadeIn 1.5s both',
}

const NewVideoCard = ({
  video,
  openVideoHandler,
  cardWidth,
}) => {
  const [hover, setHover] = React.useState(false)
  const [game, setGame] = React.useState(null)

  // Fetch linked game data
  React.useEffect(() => {
    GameService.getVideoGame(video.video_id)
      .then((response) => {
        if (response.data) {
          setGame(response.data)
        }
      })
      .catch(() => {
        // No linked game
      })
  }, [video.video_id])

  // Debounced hover (same pattern as CompactVideoCard)
  const debouncedMouseEnter = React.useRef(
    _.debounce(() => {
      setHover(true)
    }, 750),
  ).current

  const handleMouseLeave = () => {
    debouncedMouseEnter.cancel()
    setHover(false)
  }

  const previewVideoHeight =
    video.info?.width && video.info?.height ? cardWidth * (video.info.height / video.info.width) : cardWidth / 1.77

  const getPreviewVideoUrl = () => {
    const has720p = video.info?.has_720p
    const has1080p = video.info?.has_1080p

    if (has720p) {
      return getVideoUrl(video.video_id, '720p', video.extension)
    }
    if (has1080p) {
      return getVideoUrl(video.video_id, '1080p', video.extension)
    }
    return getVideoUrl(video.video_id, 'original', video.extension)
  }

  const posterUrl = SERVED_BY === 'nginx'
    ? `${URL}/_content/derived/${video.video_id}/poster.jpg`
    : `${URL}/api/video/poster?id=${video.video_id}`

  return (
    <Box
      sx={{
        width: cardWidth,
        cursor: 'pointer',
      }}
      onClick={() => openVideoHandler(video.video_id)}
    >
      {/* Thumbnail container */}
      <Box
        sx={{ position: 'relative', lineHeight: 0 }}
        onMouseEnter={debouncedMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <img
          src={posterUrl}
          alt=""
          style={{
            width: cardWidth,
            minHeight: previewVideoHeight,
            borderRadius: '5px',
            background: 'repeating-linear-gradient(45deg,#606dbc,#606dbc 10px,#465298 10px,#465298 20px)',
            objectFit: 'cover',
          }}
        />

        {/* Hover video preview */}
        {hover && (
          <video
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              borderRadius: '2px',
              ...fadeInAnimation,
            }}
            width={cardWidth}
            height={previewVideoHeight}
            src={getPreviewVideoUrl()}
            muted
            autoPlay
            disablePictureInPicture
          />
        )}

        {/* Duration badge - bottom right */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 6,
            right: 6,
            bgcolor: 'rgba(0, 0, 0, 0.8)',
            borderRadius: '2px',
            px: 0.5,
            py: 0.25,
          }}
        >
          <Typography
            sx={{
              fontSize: 15,
              fontWeight: 500,
              fontFamily: 'Inter, sans-serif',
              color: 'white',
              lineHeight: 1.2,
            }}
          >
            {toHHMMSS(video.info?.duration || 0)}
          </Typography>
        </Box>
      </Box>

      {/* Metadata row: game icon + title + game name */}
      <Box sx={{ display: 'flex', gap: 1.5, mt: 1.5, alignItems: 'flex-start' }}>
        {game?.icon_url ? (
          <Avatar
            src={game.icon_url}
            sx={{
              width: 40,
              height: 40,
              flexShrink: 0,
              '& img': {
                objectFit: 'contain',
              },
            }}
          />
        ) : (
          <Box sx={{ width: 40, height: 40, flexShrink: 0 }} />
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={textStyle(18, 'white', {
              fontWeight: 700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            })}
          >
            {video.info?.title || 'Untitled'}
          </Typography>
          {game && (
            <Typography sx={textStyle(16, 'rgba(255, 255, 255, 0.7)')}>
              {game.name}
            </Typography>
          )}
          <Typography sx={textStyle(16, 'rgba(255, 255, 255, 0.5)')}>
            {video.view_count || 0} {video.view_count === 1 ? 'view' : 'views'}
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}

export default NewVideoCard
