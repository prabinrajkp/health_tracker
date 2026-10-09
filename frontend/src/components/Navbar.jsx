import { NavLink } from 'react-router-dom'
import { LayoutDashboard, PlusCircle, BarChart2, User } from 'lucide-react'

const links = [
  { to: '/',         icon: LayoutDashboard, label: 'Today'    },
  { to: '/log',      icon: PlusCircle,      label: 'Log'      },
  { to: '/progress', icon: BarChart2,       label: 'Progress' },
  { to: '/profile',  icon: User,            label: 'Profile'  },
]

export default function Navbar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-5 pt-1 pointer-events-none">
      <div className="flex justify-around items-center h-[62px] max-w-sm mx-auto rounded-3xl border border-surface-border px-3 pointer-events-auto"
        style={{
          background: 'rgb(var(--c-surface-card) / 0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: 'var(--shadow-nav)',
        }}>
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className="flex flex-col items-center gap-0.5 flex-1 py-1"
          >
            {({ isActive }) => (
              <>
                <div
                  className="flex items-center justify-center w-10 h-9 rounded-2xl transition-all duration-200"
                  style={isActive ? {
                    background: 'linear-gradient(135deg, rgb(var(--c-brand)), rgb(var(--c-brand-dark)))',
                    boxShadow: '0 4px 14px rgb(var(--c-brand) / 0.5)',
                  } : {}}
                >
                  <Icon
                    size={18}
                    strokeWidth={isActive ? 2.2 : 1.6}
                    style={{ color: isActive ? '#fff' : 'rgb(var(--c-text-muted))' }}
                  />
                </div>
                <span
                  className="text-[11px] font-semibold leading-none transition-colors duration-200"
                  style={{ color: isActive ? 'rgb(var(--c-brand-light))' : 'rgb(var(--c-text-muted))' }}
                >
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
