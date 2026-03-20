import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore.js'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { authUser, updateProfile, isUpdatingProfile, logout } = useAuthStore()

  const [form, setForm] = useState({
    username: authUser?.username || '',
    bio: authUser?.bio || '',
    avatar: authUser?.avatar || '',
  })
  const [preview, setPreview] = useState(authUser?.avatar || '')
  const [avatarFile, setAvatarFile] = useState(null)
  const fileRef = useRef(null)

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const ok = await updateProfile({
      username: form.username,
      bio: form.bio,
      avatar: form.avatar,
      avatarFile,
    })
    if (ok) navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">

        {/* Header */}
        <div className="bg-primary-500 px-6 py-8 text-center relative">
          <button onClick={() => navigate('/')}
            className="absolute top-4 left-4 p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>

          {/* Avatar */}
          <div className="relative inline-block mb-3">
            <img
              src={preview || 'https://ui-avatars.com/api/?name=' + form.username + '&background=random&size=128'}
              className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
            />
            <button onClick={() => fileRef.current?.click()}
              className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-gray-50 transition-colors">
              <svg className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange}/>
          </div>

          <h1 className="text-white font-semibold text-lg">{authUser?.username}</h1>
          <p className="text-blue-100 text-sm">{authUser?.email}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
            <input
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              required minLength={3}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bio</label>
            <textarea
              value={form.bio}
              onChange={e => setForm({ ...form, bio: e.target.value })}
              maxLength={150} rows={3}
              placeholder="Tell people about yourself..."
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm resize-none"
            />
            <p className="text-xs text-gray-400 text-right mt-1">{form.bio.length}/150</p>
          </div>

          <button type="submit" disabled={isUpdatingProfile}
            className="w-full py-2.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-medium rounded-xl transition-colors text-sm">
            {isUpdatingProfile ? 'Saving...' : 'Save changes'}
          </button>

          <button type="button" onClick={logout}
            className="w-full py-2.5 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 font-medium rounded-xl transition-colors text-sm">
            Sign out
          </button>
          <button
  type="button"
  onClick={async () => {
    if (!confirm('Delete your account permanently? This cannot be undone.')) return
    try {
      await axios.delete('/users/account')
      localStorage.removeItem('token')
      window.location.href = '/login'
    } catch { toast.error('Failed to delete account') }
  }}
  className="w-full py-2.5 border border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 font-medium rounded-xl transition-colors text-sm mt-2"
>
  Delete account permanently
</button>
        </form>
      </div>
    </div>
  )
}
