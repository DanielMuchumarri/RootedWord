import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { AGE_GROUPS, BIBLE_TRANSLATIONS } from '../../lib/constants'
import toast from 'react-hot-toast'
import { ArrowLeft, Save } from 'lucide-react'

const EMPTY = {
  verse_date: '',
  age_group_id: 1,
  verse_reference: '',
  verse_text: '',
  reflection: '',
  bible_translation: 'NIV',
  is_active: true,
}

export default function VerseForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isEdit = Boolean(id)

  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [dupWarning, setDupWarning] = useState(false)

  useEffect(() => {
    if (!isEdit) return
    supabase
      .from('memory_verses')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setForm({ ...data })
        setLoading(false)
      })
  }, [id, isEdit])

  // Duplicate check when date or group changes
  useEffect(() => {
    if (!form.verse_date || !form.age_group_id) return
    supabase
      .from('memory_verses')
      .select('id')
      .eq('verse_date', form.verse_date)
      .eq('age_group_id', form.age_group_id)
      .neq('id', id ?? '00000000-0000-0000-0000-000000000000')
      .then(({ data }) => {
        setDupWarning((data?.length ?? 0) > 0)
      })
  }, [form.verse_date, form.age_group_id])

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)

    const payload = {
      ...form,
      age_group_id: Number(form.age_group_id),
      ...(isEdit
        ? { updated_by: profile?.id }
        : { created_by: profile?.id }),
    }

    let error
    if (isEdit) {
      ;({ error } = await supabase.from('memory_verses').update(payload).eq('id', id))
    } else {
      ;({ error } = await supabase.from('memory_verses').insert(payload))
    }

    setSaving(false)
    if (error) {
      if (error.code === '23505') {
        toast.error('A verse already exists for this date and age group.')
      } else {
        toast.error(error.message)
      }
    } else {
      toast.success(isEdit ? 'Verse updated!' : 'Verse created!')
      navigate('/admin/verses')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-4xl animate-bounce">🌿</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/admin/verses')}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-dark)' }}>
          {isEdit ? 'Edit Verse' : 'Add New Verse'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        {/* Date + Age Group row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Verse Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={form.verse_date}
              onChange={(e) => set('verse_date', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Age Group <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={form.age_group_id}
              onChange={(e) => set('age_group_id', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
            >
              {AGE_GROUPS.map((g) => (
                <option key={g.id} value={g.id}>{g.label} ({g.ageRange})</option>
              ))}
            </select>
          </div>
        </div>

        {dupWarning && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
            ⚠️ A verse already exists for this date and age group. Saving will overwrite or fail.
          </div>
        )}

        {/* Verse Reference */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Verse Reference <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. John 3:16"
            value={form.verse_reference}
            onChange={(e) => set('verse_reference', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
          />
        </div>

        {/* Verse Text */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Verse Text <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            rows={4}
            placeholder="Enter the full scripture text…"
            value={form.verse_text}
            onChange={(e) => set('verse_text', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 resize-y"
          />
        </div>

        {/* Reflection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reflection / Insight <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            rows={4}
            placeholder="Write a short devotional reflection or insight for this verse…"
            value={form.reflection}
            onChange={(e) => set('reflection', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 resize-y"
          />
        </div>

        {/* Translation + Active row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bible Translation
            </label>
            <select
              value={form.bible_translation}
              onChange={(e) => set('bible_translation', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
            >
              {BIBLE_TRANSLATIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={form.is_active}
                  onChange={(e) => set('is_active', e.target.checked)}
                />
                <div
                  className={`w-11 h-6 rounded-full transition-colors ${form.is_active ? '' : 'bg-gray-200'}`}
                  style={{ backgroundColor: form.is_active ? 'var(--green-mid)' : undefined }}
                />
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm font-medium text-gray-700">Active (visible publicly)</span>
            </label>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60 transition-opacity"
            style={{ backgroundColor: 'var(--green-mid)' }}
          >
            <Save size={16} />
            {saving ? 'Saving…' : isEdit ? 'Update Verse' : 'Create Verse'}
          </button>
        </div>
      </form>
    </div>
  )
}
