import { GraduationCap, User, Users, ShieldAlert } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle.tsx';

interface NavbarProps {
  currentView: 'student' | 'parent' | 'admin';
  onSelectView: (view: 'student' | 'parent' | 'admin') => void;
}

export function Navbar({ currentView, onSelectView }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600 dark:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20 shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
              Arrival Check-in
            </h1>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 hidden xs:block">
              School Arrival &amp; Departure Portal
            </p>
          </div>
        </div>

        {/* Navigation & Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* View Switchers */}
          <nav className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300">
            <button
              type="button"
              onClick={() => onSelectView('student')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
                currentView === 'student'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Student</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectView('parent')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
                currentView === 'parent'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Parent</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectView('admin')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
                currentView === 'admin'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Admin</span>
            </button>
          </nav>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
