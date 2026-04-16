export const AGE_GROUPS = [
  {
    id: 1,
    slug: 'little-roots',
    label: 'Little Roots',
    ageRange: '5–10',
    color: '#40916C',
    accent: '#FFD166',
    iconName: 'seedling',
    description: "Children's Ministry",
  },
  {
    id: 2,
    slug: 'growing-roots',
    label: 'Growing Roots',
    ageRange: '11–17',
    color: '#2D6A4F',
    accent: '#9B59B6',
    iconName: 'sprout',
    description: 'Youth Ministry',
  },
  {
    id: 3,
    slug: 'deep-roots',
    label: 'Deep Roots',
    ageRange: '18+',
    color: '#1B4332',
    accent: '#D4A017',
    iconName: 'tree',
    description: 'Adult Ministry',
  },
]

export const AGE_GROUP_BY_SLUG = Object.fromEntries(
  AGE_GROUPS.map((g) => [g.slug, g])
)

export const AGE_GROUP_BY_ID = Object.fromEntries(
  AGE_GROUPS.map((g) => [g.id, g])
)

export const BIBLE_TRANSLATIONS = ['NIV', 'ESV', 'KJV', 'NLT', 'NASB', 'CSB', 'MSG']

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const COLORS = {
  greenDeep: '#1B4332',
  greenMid: '#2D6A4F',
  greenLight: '#B7E4C7',
  greenPale: '#D8F3DC',
  goldAccent: '#D4A017',
  parchment: '#FDF8F0',
}
