import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, PlusCircle, BarChart2, User } from 'lucide-react'
import { useOpenTab } from '../hooks/useNavigation'

const links = [
  { to: '/',         icon: LayoutDashboard, label: 'Today'    },
  { to: '/log',      icon: PlusCircle,      label: 'Log'      },
  { to: '/progress', icon: BarChart2,       label: 'Progress' },
  { to: '/profile',  icon: User,            label: 'Profile'  },
]

// Standard bottom tab bar: full width, attached to the edge. Pages leave
// room for it with the `pb-nav` padding below.
// Tabs are siblings: switching never adds to the history, so back goes to Today
// and then out. Tapping the tab already open scrolls it back to the top.
export default function Navbar() {
  const { pathname } = useLocation()
  const openTab = useOpenTab()
  const select = (e, to) => {
    e.preventDefault()
    if (pathname === to) window.scrollTo({ top: 0, behavior: 'smooth' })
    else openTab(to)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface-card border-t border-surface-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex max-w-lg mx-auto h-14">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'} onClick={(e) => select(e, to)}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-1 ${isActive ? 'text-brand-light' : 'text-text-muted'}`}>
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 2.25 : 1.75} />
                <span className={`text-xs leading-none ${isActive ? 'font-semibold' : 'font-medium'}`}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
