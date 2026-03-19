import { useEffect, useState, useRef } from 'react'
import { format } from 'date-fns'
import useAuthStore from '../store/authStore.js'
import useChatStore from '../store/chatStore.js'
import axios from '../utils/axios.js'
import toast from 'react-hot-toast'

export default function Sidebar() {
  const { authUser, logout } = useAuthStore()
  const {
    conversations = [],
    activeConversation,
    setActiveConversation,
    fetchMessages,
    onlineUsers = [], // ✅ safe default
    openOrCreateConversation,
  } = useChatStore()

  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem('theme') === 'dark'
  )

  const debounceRef = useRef(null)

  // ✅ Apply saved theme
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  // ✅ Toggle dark mode with persistence
  const toggleDark = () => {
    const newMode = !darkMode
    setDarkMode(newMode)
    localStorage.setItem('theme', newMode ? 'dark' : 'light')
  }

  // ✅ Debounced search (FIXES API SPAM)
  const handleSearch = (e) => {
    const q = e.target.value
    setSearch(q)

    clearTimeout(debounceRef.current)

    if (q.trim().length < 1) {
      setSearchResults([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const { data } = await axios.get(`/users/search?q=${q}`)
        setSearchResults(data)
      } catch {
        toast.error('Search failed')
      } finally {
        setIsSearching(false)
      }
    }, 400) // ✅ debounce
  }

  // ✅ Cleanup debounce
  useEffect(() => {
    return () => clearTimeout(debounceRef.current)
  }, [])

  // ✅ Select user safely
  const handleSelectUser = async (user) => {
    try {
      setSearch('')
      setSearchResults([])

      const conv = await openOrCreateConversation(user._id)

      if (conv) {
        setActiveConversation(conv)
        await fetchMessages(conv._id)
      }
    } catch {
      toast.error('Failed to open chat')
    }
  }

  const handleSelectConversation = async (conv) => {
    try {
      setActiveConversation(conv)
      await fetchMessages(conv._id)
    } catch {
      toast.error('Failed to load messages')
    }
  }

  // ✅ Optimized helpers (no repeated find)
  const getOtherUser = (conv) =>
    conv.participants?.find((p) => p._id !== authUser?._id)

  const getConvName = (conv) =>
    conv.isGroup ? conv.groupName : getOtherUser(conv)?.username || 'Unknown'

  const getConvAvatar = (conv) => {
    if (conv.isGroup) return conv.groupAvatar
    const other = getOtherUser(conv)
    return (
      other?.avatar ||
      `https://ui-avatars.com/api/?name=${getConvName(conv)}`
    )
  }

  const isConvOnline = (conv) => {
    if (conv.isGroup) return false
    const other = getOtherUser(conv)
    return other ? onlineUsers.includes(other._id) : false
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">

      {/* HEADER */}
      <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img
            src={
              authUser?.avatar ||
              `https://ui-avatars.com/api/?name=${authUser?.username}`
            }
            className="w-9 h-9 rounded-full"
          />
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {authUser?.username}
          </span>
        </div>

        <div className="flex gap-2">
          <button onClick={toggleDark}>🌓</button>
          <button onClick={logout}>🚪</button>
        </div>
      </div>

      {/* SEARCH */}
      <div className="p-3">
        <input
          value={search}
          onChange={handleSearch}
          placeholder="Search users..."
          className="w-full p-2 rounded bg-gray-100 dark:bg-gray-800"
        />
      </div>

      {/* SEARCH RESULTS */}
      {searchResults.length > 0 && (
        <div className="px-2 border-b">
          {searchResults.map((user) => (
            <button
              key={user._id}
              onClick={() => handleSelectUser(user)}
              className="flex items-center gap-2 w-full p-2 hover:bg-gray-200 dark:hover:bg-gray-800"
            >
              <img
                src={
                  user.avatar ||
                  `https://ui-avatars.com/api/?name=${user.username}`
                }
                className="w-8 h-8 rounded-full"
              />
              <span>{user.username}</span>
            </button>
          ))}
        </div>
      )}

      {/* CONVERSATIONS */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <p className="text-center text-gray-400 mt-10">
            No conversations
          </p>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv._id}
              onClick={() => handleSelectConversation(conv)}
              className={`flex w-full items-center gap-3 p-3 ${
                activeConversation?._id === conv._id
                  ? 'bg-gray-200 dark:bg-gray-800'
                  : ''
              }`}
            >
              <img
                src={getConvAvatar(conv)}
                className="w-10 h-10 rounded-full"
              />

              <div className="flex-1 text-left">
                <p>{getConvName(conv)}</p>

                <p className="text-xs text-gray-400">
                  {conv.lastMessage
                    ? conv.lastMessage.messageType === 'image'
                      ? '📷 Image'
                      : conv.lastMessage.content
                    : 'No messages'}
                </p>
              </div>

              {conv.updatedAt && (
                <span className="text-xs text-gray-400">
                  {format(new Date(conv.updatedAt), 'HH:mm')}
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}