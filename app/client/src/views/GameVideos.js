import React from 'react'
import { Box, Divider, Typography } from '@mui/material'
import { useParams } from 'react-router-dom'
import { GameService } from '../services'
import VideoCards from '../components/admin/VideoCards'
import GameVideosHeader from '../components/game/GameVideosHeader'
import LoadingSpinner from '../components/misc/LoadingSpinner'
import { SORT_OPTIONS } from '../common/constants'
import { formatDate } from '../common/utils'

const GameVideos = ({ cardSize, listStyle, authenticated }) => {
  const { gameId } = useParams()
  const [videos, setVideos] = React.useState([])
  const [game, setGame] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const [sortOrder, setSortOrder] = React.useState(SORT_OPTIONS?.[0] || { value: 'newest', label: 'Newest' })

  React.useEffect(() => {
    Promise.all([
      GameService.getGames(),
      GameService.getGameVideos(gameId)
    ])
      .then(([gamesRes, videosRes]) => {
        const foundGame = gamesRes.data.find(g => g.steamgriddb_id === parseInt(gameId))
        setGame(foundGame)
        setVideos(videosRes.data || [])
        setLoading(false)
      })
      .catch((err) => {
        console.error('Error fetching game videos:', err)
        setLoading(false)
      })
  }, [gameId])

  function fetchVideos() {
    GameService.getGameVideos(gameId)
      .then((res) => setVideos(res.data || []))
      .catch((err) => console.error(err))
  }

  const sortedVideos = React.useMemo(() => {
    if (!videos || !Array.isArray(videos)) return []
    return [...videos].sort((a, b) => {
      if (sortOrder.value === 'most_views') {
        return (b.views || 0) - (a.views || 0)
      } else if (sortOrder.value === 'least_views') {
        return (a.views || 0) - (b.views || 0)
      } else {
        const dateA = a.recorded_at ? new Date(a.recorded_at) : new Date(0)
        const dateB = b.recorded_at ? new Date(b.recorded_at) : new Date(0)
        return sortOrder.value === 'newest' ? dateB - dateA : dateA - dateB
      }
    })
  }, [videos, sortOrder])

  const groupedVideos = React.useMemo(() => {
    const groups = {}
    sortedVideos.forEach((video) => {
      // Use just the date part (YYYY-MM-DD) for grouping, not the full timestamp
      const dateKey = video.recorded_at
        ? new Date(video.recorded_at).toISOString().split('T')[0]
        : 'unknown'
      if (!groups[dateKey]) groups[dateKey] = []
      groups[dateKey].push(video)
    })
    return groups
  }, [sortedVideos])

  if (loading) return <LoadingSpinner />

  return (
    <Box>
      <GameVideosHeader
        game={game}
        sortOrder={sortOrder}
        onSortChange={setSortOrder}
      />
      <Box sx={{ p: 3 }}>

        {sortedVideos.length === 0 && (
          <Typography color="text.secondary">No videos found for this game.</Typography>
        )}

        {Object.entries(groupedVideos).map(([dateKey, dateVideos]) => {
          const formattedDate = dateKey !== 'unknown' ? formatDate(dateKey) : 'Unknown Date'

          return (
            <Box key={dateKey} sx={{ mb: 4 }}>
              <Typography
                sx={{
                  mb: 2,
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'rgba(255, 255, 255, 0.7)',
                }}
              >
                {formattedDate}
              </Typography>
              <VideoCards
                videos={dateVideos}
                authenticated={authenticated}
                size={cardSize}
                feedView={false}
                fetchVideos={fetchVideos}
              />
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

export default GameVideos
