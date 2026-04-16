import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useMonthVerses(year, month, ageGroupId) {
  const [verses, setVerses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!year || !month || !ageGroupId) return
    setLoading(true)

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]

    supabase
      .from('memory_verses')
      .select('id, verse_date, verse_reference, verse_text, age_group_id, bible_translation')
      .eq('age_group_id', ageGroupId)
      .eq('is_active', true)
      .gte('verse_date', startDate)
      .lte('verse_date', endDate)
      .order('verse_date')
      .then(({ data, error }) => {
        if (error) setError(error)
        else setVerses(data || [])
        setLoading(false)
      })
  }, [year, month, ageGroupId])

  return { verses, loading, error }
}

export function useVerse(id) {
  const [verse, setVerse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!id) return
    supabase
      .from('memory_verses')
      .select('*, age_groups(slug, label, color_hex)')
      .eq('id', id)
      .eq('is_active', true)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error)
        else setVerse(data)
        setLoading(false)
      })
  }, [id])

  return { verse, loading, error }
}
