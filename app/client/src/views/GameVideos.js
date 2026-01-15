import React from 'react'
import { Box, Divider, FormControl, InputLabel, MenuItem, Select, Typography } from '@mui/material'
import { useParams } from 'react-router-dom'
import { GameService } from '../services'
import VideoCards from '../components/admin/VideoCards'
import VideoList from '../components/admin/VideoList'
import LoadingSpinner from '../components/misc/LoadingSpinner'

const GameVideos = ({ cardSize, listStyle, authenticated }) => {
  console.log('GameVideos render - props:', { cardSize, listStyle, authenticated })
  const { gameId } = useParams()
  console.log('GameVideos - gameId:', gameId)
  const [videos, setVideos] = React.useState([])
  const [game, setGame] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const [sortOrder, setSortOrder] = React.useState('newest')

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
    console.log('GameVideos - computing sortedVideos, videos:', videos)
    if (!videos || !Array.isArray(videos)) return []
    return [...videos].sort((a, b) => {
      const dateA = a.recorded_at ? new Date(a.recorded_at) : new Date(0)
      const dateB = b.recorded_at ? new Date(b.recorded_at) : new Date(0)
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB
    })
  }, [videos, sortOrder])

  const groupedVideos = React.useMemo(() => {
    console.log('GameVideos - computing groupedVideos, sortedVideos:', sortedVideos)
    const groups = {}
    sortedVideos.forEach((video) => {
      const date = video.recorded_at
        ? new Date(video.recorded_at).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : 'Unknown Date'
      if (!groups[date]) groups[date] = []
      groups[date].push(video)
    })
    console.log('GameVideos - groupedVideos result:', groups)
    return groups
  }, [sortedVideos])

  console.log('GameVideos - about to render, loading:', loading, 'game:', game)

  if (loading) return <LoadingSpinner />

  console.log('GameVideos - rendering main content')

  return (
    <Box>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          {game?.logo_url && (
            <Box
              component="img"
              src={game.logo_url}
              sx={{
                maxHeight: 80,
                maxWidth: 300,
                objectFit: 'contain',
              }}
            />
          )}
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px' }}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
        </Box>
        <Divider sx={{ mb: 3 }} />

        {sortedVideos.length === 0 && (
          <Typography color="text.secondary">No videos found for this game.</Typography>
        )}

        {Object.entries(groupedVideos).map(([date, dateVideos]) => (
          <Box key={date} sx={{ mb: 4 }}>
            <Typography
              variant="h6"
              sx={{
                mb: 2,
                color: 'text.secondary',
                fontWeight: 500,
              }}
            >
              {date}
            </Typography>
            <VideoCards
              videos={dateVideos}
              authenticated={authenticated}
              size={cardSize}
              feedView={false}
              fetchVideos={fetchVideos}
            />
          </Box>
        ))}
      </Box>
    </Box>
  )
}

export default GameVideos
