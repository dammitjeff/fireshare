import React from 'react'
import { Box, Divider, Grid, Stack, Typography } from '@mui/material'
import VideoCards from '../components/admin/VideoCards'
import NewVideoCard from '../components/video/NewVideoCard'
import { VideoService } from '../services'
import LoadingSpinner from '../components/misc/LoadingSpinner'
import { formatDate } from '../common/utils'

import Select from 'react-select'
import SnackbarAlert from '../components/alert/SnackbarAlert'

import selectSortTheme from '../common/reactSelectSortTheme'
import { SORT_OPTIONS } from '../common/constants'

const TestFeed = ({ authenticated, cardSize }) => {
  const [videos, setVideos] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [sortOrder, setSortOrder] = React.useState(SORT_OPTIONS?.[0] || { value: 'newest', label: 'Newest' })
  const [alert, setAlert] = React.useState({ open: false })

  React.useEffect(() => {
    VideoService.getPublicVideos()
      .then((res) => {
        setVideos(res.data.videos)
        setLoading(false)
      })
      .catch((err) => {
        setLoading(false)
        setAlert({
          open: true,
          type: 'error',
          message: typeof err.response?.data === 'string' ? err.response.data : 'Unknown Error',
        })
        console.log(err)
      })
  }, [])

  // Check if sorting by views (no date grouping needed)
  const isSortingByViews = sortOrder.value === 'most_views' || sortOrder.value === 'least_views'

  // Sort videos and group by date
  const sortedAndGroupedVideos = React.useMemo(() => {
    if (!videos) return {}

    const sorted = [...videos].sort((a, b) => {
      if (sortOrder.value === 'most_views') {
        return (b.view_count || 0) - (a.view_count || 0)
      } else if (sortOrder.value === 'least_views') {
        return (a.view_count || 0) - (b.view_count || 0)
      } else {
        const dateA = a.recorded_at ? new Date(a.recorded_at) : new Date(0)
        const dateB = b.recorded_at ? new Date(b.recorded_at) : new Date(0)
        return sortOrder.value === 'newest' ? dateB - dateA : dateA - dateB
      }
    })

    // Skip date grouping when sorting by views
    if (sortOrder.value === 'most_views' || sortOrder.value === 'least_views') {
      return { all: sorted }
    }

    const groups = {}
    sorted.forEach((video) => {
      const dateKey = video.recorded_at
        ? new Date(video.recorded_at).toISOString().split('T')[0]
        : 'unknown'
      if (!groups[dateKey]) groups[dateKey] = []
      groups[dateKey].push(video)
    })
    return groups
  }, [videos, sortOrder])

  return (
    <>
      <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert({ ...alert, open })}>
        {alert.message}
      </SnackbarAlert>
      <Box sx={{ height: '100%' }}>
        <Grid container item justifyContent="center">
          <Grid item xs={12}>
            <Grid container justifyContent="center">
              {videos && videos.length !== 0 && (
                <Grid item xs={11} sm={9} md={7} lg={5} sx={{ mb: 3 }}>
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Select
                      value={sortOrder}
                      options={SORT_OPTIONS}
                      onChange={setSortOrder}
                      styles={selectSortTheme}
                      blurInputOnSelect
                      isSearchable={false}
                    />
                  </Stack>
                </Grid>
              )}
            </Grid>
            <Box sx={{ px: 1 }}>
              {loading && <LoadingSpinner />}
              {!loading && isSortingByViews && sortedAndGroupedVideos.all && (
                <VideoCards
                  CardComponent={NewVideoCard}
                  videos={sortedAndGroupedVideos.all}
                  authenticated={authenticated}
                  feedView={true}
                  size={cardSize}
                />
              )}
              {!loading && !isSortingByViews && Object.entries(sortedAndGroupedVideos).map(([dateKey, dateVideos]) => {
                const formattedDate = dateKey !== 'unknown' ? formatDate(dateKey) : 'Unknown Date'
                return (
                  <Box key={dateKey} sx={{ mb: 4 }}>
                    <Divider sx={{ mb: 2 }} />
                    <Typography
                      sx={{
                        mb: 2,
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#2d7cff',
                      }}
                    >
                      {formattedDate}
                    </Typography>
                    <VideoCards
                      CardComponent={NewVideoCard}
                      videos={dateVideos}
                      authenticated={authenticated}
                      feedView={true}
                      size={cardSize}
                    />
                  </Box>
                )
              })}
              {!loading && Object.keys(sortedAndGroupedVideos).length === 0 && (
                <VideoCards
                  CardComponent={NewVideoCard}
                  authenticated={authenticated}
                  feedView={true}
                  size={cardSize}
                  videos={[]}
                />
              )}
            </Box>
          </Grid>
        </Grid>
      </Box>
    </>
  )
}

export default TestFeed
