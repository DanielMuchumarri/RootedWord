import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Plus, Pencil, Trash2, GripVertical, Eye, EyeOff, Image } from 'lucide-react'
import toast from 'react-hot-toast'

export default function HeroVerseList() {
  const navigate = useNavigate()
  const [slides, setSlides] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    const { data } = await supabase
      .from('hero_verses')
      .select(`
        id, verse_reference, bible_translation, background_image_url,
        overlay_color, is_active, sort_order, created_at,
        hero_verse_translations(
          verse_text, bible_translation_id,
          bible_translations(code, languages(code))
        )
      `)
      .order('sort_order')
    setSlides(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggleActive(slide) {
    const { error } = await supabase
      .from('hero_verses')
      .update({ is_active: !slide.is_active })
      .eq('id', slide.id)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(slide.is_active ? 'Slide hidden' : 'Slide shown')
      setSlides((prev) =>
        prev.map((s) => s.id === slide.id ? { ...s, is_active: !s.is_active } : s)
      )
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.from('hero_verses').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Slide deleted')
      setSlides((prev) => prev.filter((s) => s.id !== deleteTarget.id))
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
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-dark)' }}>Hero Slides</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage the carousel shown at the top of the public page</p>
        </div>
        <button
          onClick={() => navigate('/admin/hero-verses/new')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--green-mid)' }}
        >
          <Plus size={16} />
          Add Slide
        </button>
      </div>

      {/* Slides list */}
      {slides.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <span className="text-4xl mb-3 block">🌅</span>
          <p className="text-gray-500 mb-4">No hero slides yet.</p>
          <button
            onClick={() => navigate('/admin/hero-verses/new')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold"
            style={{ backgroundColor: 'var(--green-mid)' }}
          >
            <Plus size={15} />
            Add First Slide
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {slides.map((slide) => {
            // Which versions have translations
            const availableTranslations = slide.hero_verse_translations
              ?.map((t) => t.bible_translations?.code)
              .filter(Boolean) || []

            return (
              <div
                key={slide.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex"
              >
                {/* Sort handle + preview strip */}
                <div
                  className="w-24 sm:w-32 flex-shrink-0 relative overflow-hidden"
                  style={{ minHeight: 80 }}
                >
                  {slide.background_image_url ? (
                    <img
                      src={slide.background_image_url}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg,#1B4332,#2D6A4F)' }}
                    >
                      <Image size={20} className="text-green-200 opacity-60" />
                    </div>
                  )}
                  <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.35)' }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">#{slide.sort_order}</span>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 px-4 py-3 flex flex-col justify-between min-w-0">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className="font-semibold text-sm truncate"
                        style={{ color: 'var(--text-dark)' }}
                      >
                        {slide.verse_reference}
                      </p>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* Active badge */}
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{
                            backgroundColor: slide.is_active ? 'rgba(45,106,79,0.1)' : 'rgba(156,163,175,0.15)',
                            color: slide.is_active ? 'var(--green-mid)' : '#9CA3AF',
                          }}
                        >
                          {slide.is_active ? 'Visible' : 'Hidden'}
                        </span>
                      </div>
                    </div>

                    {/* Preview text from ESV */}
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2 italic">
                      {slide.hero_verse_translations?.find(
                        (t) => t.bible_translations?.code === 'ESV'
                      )?.verse_text || '—'}
                    </p>
                  </div>

                  {/* Bottom row: version chips + actions */}
                  <div className="flex items-center justify-between mt-2 gap-2">
                    <div className="flex flex-wrap gap-1">
                      {availableTranslations.map((code) => (
                        <span
                          key={code}
                          className="text-xs px-1.5 py-0.5 rounded font-semibold"
                          style={{
                            backgroundColor: 'rgba(27,67,50,0.08)',
                            color: 'var(--green-deep)',
                          }}
                        >
                          {code}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleActive(slide)}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                        title={slide.is_active ? 'Hide slide' : 'Show slide'}
                      >
                        {slide.is_active ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                      <button
                        onClick={() => navigate(`/admin/hero-verses/${slide.id}/edit`)}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                        title="Edit"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(slide)}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--text-dark)' }}>
              Delete Slide?
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              "{deleteTarget.verse_reference}" will be permanently removed along with all its translations.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
