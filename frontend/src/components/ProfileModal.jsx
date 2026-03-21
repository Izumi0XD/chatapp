import { format } from 'date-fns'

export default function ProfileModal({ user, onClose }) {
  if (!user) return null
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-sm shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-br from-primary-400 to-primary-600 h-24 relative">
          <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-full bg-black/20 text-white hover:bg-black/30">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
          <img
            src={user.avatar || 'https://ui-avatars.com/api/?name=' + user.username + '&background=random&size=128'}
            className="w-20 h-20 rounded-full object-cover border-4 border-white absolute -bottom-8 left-1/2 -translate-x-1/2 shadow-lg"
          />
        </div>
        <div className="pt-12 pb-6 px-6 text-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{user.username}</h2>
          {user.isOnline
            ? <span className="inline-flex items-center gap-1 text-xs text-green-500 font-medium mt-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full"/>Online</span>
            : <span className="text-xs text-gray-400 mt-1 block">Offline</span>
          }
          {user.bio
            ? <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 leading-relaxed">{user.bio}</p>
            : <p className="text-sm text-gray-400 italic mt-3">No bio yet</p>
          }
          <p className="text-xs text-gray-400 mt-4">
            Joined {user.createdAt ? format(new Date(user.createdAt), 'MMM yyyy') : '—'}
          </p>
        </div>
      </div>
    </div>
  )
}