export const SORT_OPTIONS = [
  {
    value: 'updated_at desc',
    label: 'Newest',
  },
  {
    value: 'updated_at asc',
    label: 'Oldest',
  },
  {
    value: 'video_info.title asc',
    label: 'A-Z',
  },
  {
    value: 'video_info.title desc',
    label: 'Z-A',
  },
  {
    value: 'views desc',
    label: 'Most Views',
  },
  {
    value: 'views asc',
    label: 'Least Views',
  },
]

export const AUTH_REQUIRED_PAGES = ['/', '/settings']
