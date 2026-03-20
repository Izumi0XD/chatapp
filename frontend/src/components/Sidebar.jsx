import { useEffect, useState, useRef } from 'react'
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore.js'
import useChatStore from '../store/chatStore.js'
import axios from '../utils/axios.js'
import toast from 'react-hot-toast'

export default function Sidebar({ onSelectConversation }) {
  const navigate = useNavigate()
  const { authUser, logout } = useAuthStore()
  const {
    conversations = [],
    activeConversation,
    setActiveConversation,
    fetchMessages,
    onlineUsers = [],
    openOrCreateConversation,
    createGroupConversation,
    unreadCounts = {},
  } = useChatStore()

  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [darkMode, setDarkMode] = useState(localStorage.getItem('theme') === 'dark')
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupMembers, setGroupMembers] = useState([])
  const [memberSearch, setMemberSearch] = useState('')
  const [memberResults, setMemberResults] = useState([])
  const debounceRef = useRef(null)
  const memberDebounceRef = useRef(null)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  const toggleDark = () => {
    const next = !darkMode
    setDarkMode(next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  const handleSearch = (e) => {
    const q = e.target.value
    setSearch(q)
    clearTimeout(debounceRef.current)
    if (!q.trim()) { setSearchResults([]); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await axios.get('/users/search?q=' + q)
        setSearchResults(data)
      } catch { toast.error('Search failed') }
    }, 400)
  }

  const handleMemberSearch = (e) => {
    const q = e.target.value
    setMemberSearch(q)
    clearTimeout(memberDebounceRef.current)
    if (!q.trim()) { setMemberResults([]); return }
    memberDebounceRef.current = setTimeout(async () => {
      try {
        const { data } = await axios.get('/users/search?q=' + q)
        setMemberResults(data.filter(u => !groupMembers.find(m => m._id === u._id)))
      } catch {}
    }, 400)
  }

  const addMember = (user) => {
    setGroupMembers(prev => [...prev, user])
    setMemberResults([])
    setMemberSearch('')
  }
  const removeMember = (userId) => setGroupMembers(prev => prev.filter(m => m._id !== userId))

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return toast.error('Group name required')
    if (groupMembers.length < 1) return toast.error('Add at least 1 member')
    const conv = await createGroupConversation({ name: groupName, memberIds: groupMembers.map(m => m._id) })
    if (conv) {
      setShowGroupModal(false)
      setGroupName('')
      setGroupMembers([])
      fetchMessages(conv._id)
      onSelectConversation?.()
    }
  }

  const handleSelectUser = async (user) => {
    setSearch('')
    setSearchResults([])
    const conv = await openOrCreateConversation(user._id)
    if (conv) {
      setActiveConversation(conv)
      fetchMessages(conv._id)
      onSelectConversation?.()
    }
  }

  const handleSelectConversation = (conv) => {
    setActiveConversation(conv)
    fetchMessages(conv._id)
    onSelectConversation?.()
  }

  const getOtherUser = (conv) => conv.participants?.find(p => p._id !== authUser?._id)
  const getConvName = (conv) => conv.isGroup ? conv.groupName : getOtherUser(conv)?.username || 'Unknown'
  const getConvAvatar = (conv) => {
    if (conv.isGroup) return conv.groupAvatar || 'https://ui-avatars.com/api/?name=' + conv.groupName + '&background=random'
    const other = getOtherUser(conv)
    return other?.avatar || 'https://ui-avatars.com/api/?name=' + (other?.username || 'U') + '&background=random'
  }
  const isConvOnline = (conv) => {
    if (conv.isGroup) return false
    const other = getOtherUser(conv)
    return other ? onlineUsers.includes(other._id) : false
  }

  return (
    <div className="h-full w-full flex flex-col bg-white dark:bg-gray-900">

      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
        <button
          onClick={() => navigate('/profile')}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity min-w-0"
        >
          <div className="relative flex-shrink-0">
            <img
              src={authUser?.avatar || 'https://ui-avatars.com/api/?name=' + authUser?.username + '&background=random'}
              className="w-10 h-10 rounded-full object-cover"
            />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"/>
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{authUser?.username}</span>
        </button>

        <div className="flex gap-1 items-center flex-shrink-0">
          <button onClick={() => setShowGroupModal(true)}
            className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </button>
          <button onClick={toggleDark} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button onClick={logout} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="p-3">
        <input
          value={search}
          onChange={handleSearch}
          placeholder="Search users..."
          className="w-full px-4 py-2.5 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Search results */}
      {searchResults.length > 0 && (
        <div className="px-2 pb-2 border-b border-gray-100 dark:border-gray-700">
          {searchResults.map(user => (
            <button key={user._id} onClick={() => handleSelectUser(user)}
              className="flex items-center gap-3 w-full px-3 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-700">
              <div className="relative flex-shrink-0">
                <img src={user.avatar || 'https://ui-avatars.com/api/?name=' + user.username + '&background=random'}
                  className="w-10 h-10 rounded-full object-cover"/>
                {onlineUsers.includes(user._id) && (
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"/>
                )}
              </div>
              <div className="text-left min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.username}</p>
                <p className="text-xs text-gray-400 truncate">{user.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto px-2 py-1">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <p className="text-sm">No conversations yet</p>
            <p className="text-xs mt-1">Search for someone above</p>
          </div>
        ) : (
          conversations.map(conv => {
            const unread = unreadCounts[conv._id] || 0
            return (
              <button
                key={conv._id}
                onClick={() => handleSelectConversation(conv)}
                className={`flex w-full items-center gap-3 px-3 py-3 rounded-xl mb-0.5 transition-colors active:bg-gray-100 dark:active:bg-gray-700 ${
                  activeConversation?._id === conv._id
                    ? 'bg-primary-50 dark:bg-primary-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <img src={getConvAvatar(conv)} className="w-12 h-12 rounded-full object-cover"/>
                  {isConvOnline(conv) && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"/>
                  )}
                  {conv.isGroup && (
                    <span className="absolute -bottom-0.5 -right-0.5 text-xs">👥</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex justify-between items-center">
                    <p className={`text-sm truncate pr-2 ${unread > 0 ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-900 dark:text-white'}`}>
                      {getConvName(conv)}
                    </p>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {conv.updatedAt && format(new Date(conv.updatedAt), 'HH:mm')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className={`text-xs truncate pr-2 ${unread > 0 ? 'text-gray-700 dark:text-gray-200 font-medium' : 'text-gray-400'}`}>
                      {conv.lastMessage
                        ? conv.lastMessage.isDeleted ? 'Message deleted'
                          : conv.lastMessage.messageType === 'image' ? '📷 Image'
                          : conv.lastMessage.messageType === 'system' ? conv.lastMessage.content
                          : conv.lastMessage.content
                        : 'No messages yet'}
                    </p>
                    {unread > 0 && (
                      <span className="flex-shrink-0 min-w-[20px] h-5 bg-primary-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1.5">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>

      {/* Group modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-2xl p-6 w-full sm:max-w-sm shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="w-10 h-1 bg-gray-200 dark:bg-gray-600 rounded-full mx-auto mb-4 sm:hidden"/>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">New Group</h2>
            <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Group name"
              className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary-500"/>
            {groupMembers.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {groupMembers.map(m => (
                  <span key={m._id} className="flex items-center gap-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs px-3 py-1.5 rounded-full">
                    {m.username}
                    <button onClick={() => removeMember(m._id)} className="hover:text-red-500 text-base leading-none ml-1">×</button>
                  </span>
                ))}
              </div>
            )}
            <input value={memberSearch} onChange={handleMemberSearch} placeholder="Search people to add..."
              className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-primary-500"/>
            {memberResults.length > 0 && (
              <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden mb-3">
                {memberResults.map(user => (
                  <button key={user._id} onClick={() => addMember(user)}
                    className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-900 dark:text-white active:bg-gray-100">
                    <img src={user.avatar || 'https://ui-avatars.com/api/?name=' + user.username} className="w-8 h-8 rounded-full"/>
                    <div className="text-left">
                      <p className="font-medium">{user.username}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setShowGroupModal(false); setGroupName(''); setGroupMembers([]) }}
                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 active:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleCreateGroup}
                className="flex-1 py-3 rounded-xl bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white text-sm font-medium">
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}