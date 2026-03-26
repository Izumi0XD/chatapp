import { useState, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import useAuthStore from '../store/authStore.js'
import axios from '../utils/axios.js'
import useChatStore from '../store/chatStore.js'
import toast from 'react-hot-toast'
import ProfileModal from './ProfileModal.jsx'

const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '🔥']



export default function MessageBubble({ message }) {
  const { authUser } = useAuthStore()
  const { updateMessage, removeMessage, updateReactions, setReplyingTo, conversations } = useChatStore()
  const [showMenu, setShowMenu] = useState(false)
  const [showForwardModal, setShowForwardModal] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [profileUser, setProfileUser] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const menuRef = useRef(null)

  const isMine = message.sender?._id === authUser?._id || message.sender === authUser?._id

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleAvatarClick = async (e) => {
    e.stopPropagation()
    if (!message.sender?._id) return
    try {
      const { data } = await axios.get('/users/' + message.sender._id)
      setProfileUser(data)
      setShowProfile(true)
    } catch { toast.error('Could not load profile') }
  }

  const handleDelete = async () => {
    try {
      await axios.delete('/messages/' + message._id)
      removeMessage({ messageId: message._id })
    } catch { toast.error('Failed to delete') }
    setShowMenu(false)
  }

  const handleEdit = async () => {
    if (!editContent.trim()) return
    try {
      const { data } = await axios.put('/messages/' + message._id, { content: editContent })
      updateMessage(data)
      setIsEditing(false)
    } catch { toast.error('Failed to edit') }
  }

  const handleReaction = async (emoji) => {
    try {
      const { data } = await axios.post('/messages/' + message._id + '/reaction', { emoji })
      updateReactions({ messageId: message._id, reactions: data.reactions })
    } catch { toast.error('Failed to react') }
    setShowMenu(false)
  }

  const handleReply = () => { setReplyingTo(message); setShowMenu(false) }

  const handleForward = async (conv) => {
    try {
      await axios.post('/messages', {
        conversationId: conv._id,
        content: message.content || '',
        messageType: message.messageType === 'image' ? 'image' : 'text',
        mediaUrl: message.mediaUrl || '',
      })
      toast.success('Message forwarded!')
    } catch { toast.error('Failed to forward') }
    setShowForwardModal(false)
    setShowMenu(false)
  }

  if (message.messageType === 'system') {
    return (
      <div className="flex justify-center my-3">
        <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-4 py-1.5 rounded-full">
          {message.content}
        </span>
      </div>
    )
  }

  if (message.isDeleted) {
    return (
      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1`}>
        <span className="text-xs text-gray-400 italic px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-2xl">Message deleted</span>
      </div>
    )
  }

  const groupedReactions = message.reactions?.reduce((acc, r) => {
    acc[r.emoji] = acc[r.emoji] || []
    acc[r.emoji].push(r.user?._id || r.user)
    return acc
  }, {}) || {}

  return (
    <>
      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1 group`}>
        {!isMine && (
          <img
            src={message.sender?.avatar || 'https://ui-avatars.com/api/?name=' + (message.sender?.username || 'U') + '&background=random'}
            className="w-7 h-7 rounded-full object-cover mr-2 mt-auto flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={handleAvatarClick}
          />
        )}

        <div className="max-w-xs lg:max-w-md relative" ref={menuRef}>
          {!isMine && (
            <p
              className="text-xs text-gray-400 mb-0.5 ml-1 cursor-pointer hover:text-primary-500 transition-colors"
              onClick={handleAvatarClick}
            >
              {message.sender?.username}
            </p>
          )}

          {message.replyTo && !message.replyTo.isDeleted && (
            <div className={`mb-1 px-3 py-1.5 rounded-xl border-l-4 border-primary-400 bg-gray-100 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 ${isMine ? 'mr-1' : 'ml-1'}`}>
              <span className="font-medium text-primary-500">{message.replyTo.sender?.username}</span>
              <p className="truncate mt-0.5">{message.replyTo.messageType === 'image' ? '📷 Image' : message.replyTo.content}</p>
            </div>
          )}

          <div
            className={`relative px-4 py-2 rounded-2xl cursor-pointer ${
              isMine ? 'bg-primary-500 text-white rounded-br-sm' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-sm'
            }`}
            onClick={() => setShowMenu(!showMenu)}
          >
            {isEditing ? (
              <div className="flex gap-2">
                <input value={editContent} onChange={e => setEditContent(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleEdit()}
                  className="bg-transparent outline-none flex-1 text-sm min-w-0" autoFocus/>
                <button onClick={handleEdit} className="text-xs opacity-70 hover:opacity-100 whitespace-nowrap">Save</button>
                <button onClick={() => setIsEditing(false)} className="text-xs opacity-70 hover:opacity-100">✕</button>
              </div>
            ) : (
              <>
                {message.messageType === 'image' && message.mediaUrl && (
                  <img src={message.mediaUrl} alt="media"
                    className="rounded-xl max-w-full mb-1 cursor-pointer"
                    onClick={e => { e.stopPropagation(); window.open(message.mediaUrl, '_blank') }}
                  />
                )}
                {message.messageType === 'gif' && message.mediaUrl && (
                  <img src={message.mediaUrl} alt="gif" className="rounded-xl max-w-full mb-1"/>
                )}
                {message.content && (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {message.content}
                    {message.isEdited && <span className="text-xs opacity-60 ml-1">(edited)</span>}
                  </p>
                )}
              </>
            )}

            <div className={`flex items-center justify-end gap-1 mt-1 ${isMine ? 'text-blue-100' : 'text-gray-400'}`}>
              <span className="text-xs opacity-70">{format(new Date(message.createdAt), 'HH:mm')}</span>
              {isMine && (
                <svg className="w-3.5 h-3.5 opacity-70" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 16 16">
                  {message.readBy?.length > 1
                    ? <path d="M1 8l3 3 7-7M5 8l3 3 7-7" strokeLinecap="round" strokeLinejoin="round"/>
                    : <path d="M2 8l4 4 8-8" strokeLinecap="round" strokeLinejoin="round"/>
                  }
                </svg>
              )}
            </div>
          </div>

          {Object.keys(groupedReactions).length > 0 && (
            <div className={`flex flex-wrap gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
              {Object.entries(groupedReactions).map(([emoji, users]) => {
                const iReacted = users.includes(authUser?._id)
                return (
                  <button key={emoji} onClick={() => handleReaction(emoji)}
                    className={`text-sm rounded-full px-2 py-0.5 transition-all border ${
                      iReacted
                        ? 'bg-primary-100 dark:bg-primary-900/40 border-primary-300 dark:border-primary-700'
                        : 'bg-gray-100 dark:bg-gray-700 border-transparent hover:scale-110'
                    }`}>
                    {emoji}{users.length > 1 && <span className="text-xs ml-0.5 text-gray-500">{users.length}</span>}
                  </button>
                )
              })}
            </div>
          )}

          {showMenu && (
            <div className={`absolute ${isMine ? 'right-0' : 'left-0'} top-0 -translate-y-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-20 min-w-max`}>
              <div className="flex gap-1 px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                {EMOJI_LIST.map(emoji => (
                  <button key={emoji} onClick={() => handleReaction(emoji)}
                    className="text-xl hover:scale-125 transition-transform p-0.5">{emoji}</button>
                ))}
              </div>
              <button onClick={handleReply}
                className="flex items-center gap-2 w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-200">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
                </svg>
                Reply
              </button>
              <button onClick={() => { setShowForwardModal(true); setShowMenu(false) }}
                className="flex items-center gap-2 w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-200">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Forward
              </button>
              {isMine && (
                <>
                  <button onClick={() => { setIsEditing(true); setShowMenu(false) }}
                    className="flex items-center gap-2 w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-200">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                    Edit
                  </button>
                  <button onClick={handleDelete}
                    className="flex items-center gap-2 w-full text-left px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm text-red-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                    Delete
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Forward modal */}
      {showForwardModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-sm shadow-xl max-h-[70vh] flex flex-col">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Forward to</h3>
              <button onClick={() => setShowForwardModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="overflow-y-auto flex-1 p-2">
              {conversations.filter(c => c._id !== message.conversation).map(conv => {
                const other = conv.participants?.find(p => p._id !== authUser?._id)
                const name = conv.isGroup ? conv.groupName : other?.username
                const avatar = conv.isGroup
                  ? (conv.groupAvatar || 'https://ui-avatars.com/api/?name=' + conv.groupName)
                  : (other?.avatar || 'https://ui-avatars.com/api/?name=' + other?.username)
                return (
                  <button key={conv._id} onClick={() => handleForward(conv)}
                    className="flex items-center gap-3 w-full px-3 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100">
                    <img src={avatar} className="w-10 h-10 rounded-full object-cover flex-shrink-0"/>
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{name}</span>
                  </button>
                )
              })}
              {conversations.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-8">No other conversations</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Profile modal */}
      {showProfile && <ProfileModal user={profileUser} onClose={() => setShowProfile(false)} />}
    </>
  )
}