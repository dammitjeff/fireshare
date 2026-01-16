import React from 'react'
import { Box } from '@mui/material'
import Select from 'react-select'
import selectSortTheme from '../../common/reactSelectSortTheme'
import { SORT_OPTIONS } from '../../common/constants'

const GameVideosHeader = ({ game, sortOrder, onSortChange, height = 200 }) => (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height,
        overflow: 'hidden',
        mb: 3,
      }}
    >
    {game?.steamgriddb_id && (
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(/api/game/assets/${game.steamgriddb_id}/hero_2.png?fallback=hero_1)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: 0.7,
          pointerEvents: 'none',
        }}
      />
    )}
    <Box
      sx={{
        position: 'relative',
        height: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        px: 3,
      }}
    >
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
      <Select
        value={sortOrder}
        options={SORT_OPTIONS}
        onChange={onSortChange}
        styles={selectSortTheme}
        menuPortalTarget={document.body}
        menuPosition="fixed"
        blurInputOnSelect
        isSearchable={false}
      />
    </Box>
  </Box>
)

export default GameVideosHeader
