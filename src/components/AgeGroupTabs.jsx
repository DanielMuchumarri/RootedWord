import { AGE_GROUPS } from '../lib/constants'

export default function AgeGroupTabs({ activeGroupId, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
      {AGE_GROUPS.map((group) => {
        const isActive = activeGroupId === group.id
        return (
          <button
            key={group.id}
            onClick={() => onChange(group.id)}
            className="px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 border-2"
            style={{
              backgroundColor: isActive ? group.color : 'transparent',
              borderColor: group.color,
              color: isActive ? '#fff' : group.color,
              transform: isActive ? 'scale(1.05)' : 'scale(1)',
            }}
          >
            {group.label}
            <span className="ml-1.5 text-xs opacity-75">({group.ageRange})</span>
          </button>
        )
      })}
    </div>
  )
}
