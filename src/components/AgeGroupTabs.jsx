import { AGE_GROUPS } from '../lib/constants'

const ICONS = { seedling: '🌱', sprout: '🌿', tree: '🌳' }

export default function AgeGroupTabs({ activeGroupId, onChange }) {
  const activeIndex = AGE_GROUPS.findIndex((g) => g.id === activeGroupId)
  const activeGroup = AGE_GROUPS[activeIndex]

  return (
    <div className="w-full" style={{ maxWidth: 480 }}>
      {/* ── Sliding pill container ─────────────────── */}
      <div
        className="relative flex w-full rounded-2xl p-1.5"
        style={{
          background: 'rgba(27,67,50,0.08)',
          border: '1.5px solid rgba(27,67,50,0.14)',
        }}
      >
        {/* Sliding active indicator */}
        <div
          className="absolute top-1.5 bottom-1.5 rounded-xl transition-all duration-300 ease-in-out"
          style={{
            width:      `calc(${100 / 3}% - 4px)`,
            left:       `calc(${activeIndex} * ${100 / 3}% + 6px)`,
            background: `linear-gradient(135deg, ${activeGroup.color} 0%, ${activeGroup.color}CC 100%)`,
            boxShadow:  `0 4px 14px ${activeGroup.color}55`,
          }}
        />

        {/* Tab buttons */}
        {AGE_GROUPS.map((group) => {
          const isActive = group.id === activeGroupId
          return (
            <button
              key={group.id}
              onClick={() => onChange(group.id)}
              className="relative z-10 flex-1 flex flex-col items-center justify-center gap-0.5
                         py-2.5 px-1 rounded-xl transition-colors duration-200"
              style={{ cursor: 'pointer', border: 'none', background: 'transparent' }}
            >
              {/* Icon */}
              <span
                className="transition-transform duration-200"
                style={{
                  fontSize: '1.15rem',
                  lineHeight: 1,
                  transform: isActive ? 'scale(1.2)' : 'scale(1)',
                  filter: isActive ? 'drop-shadow(0 1px 3px rgba(0,0,0,0.3))' : 'none',
                }}
              >
                {ICONS[group.iconName]}
              </span>

              {/* Label */}
              <span
                className="font-semibold leading-tight text-center transition-colors duration-200"
                style={{
                  fontSize: 'clamp(0.65rem, 2vw, 0.8rem)',
                  color: isActive ? '#ffffff' : group.color,
                  letterSpacing: '0.01em',
                  whiteSpace: 'nowrap',
                }}
              >
                {group.label}
              </span>

              {/* Age range badge */}
              <span
                className="rounded-full px-1.5 py-0.5 transition-colors duration-200"
                style={{
                  fontSize: '0.6rem',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  lineHeight: 1,
                  background: isActive ? 'rgba(255,255,255,0.22)' : 'rgba(27,67,50,0.10)',
                  color: isActive ? 'rgba(255,255,255,0.90)' : 'var(--text-light)',
                }}
              >
                {group.ageRange}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
