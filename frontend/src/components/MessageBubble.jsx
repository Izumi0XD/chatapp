import { useState, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import useAuthStore from '../store/authStore.js'
import axios from '../utils/axios.js'
import useChatStore from '../store/chatStore.js'
import toast from 'react-hot-toast'

const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '🔥']

export default function MessageBubble({ message }) {
  const { authUser } = useAuthStore()
  const { updateMessage, removeMessage, updateReactions, setReplyingTo } = useChatStore()
  const [showMenu, setShowMenu] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const menuRef = useRef(null)

  const isMine = message.sender?._id === authUser?._id || message.sender === authUser?._id

  // Close menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false)
        setShowEmojiPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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
    setShowEmojiPicker(false)
    setShowMenu(false)
  }

  const handleReply = () => {
    setReplyingTo(message)
    setShowMenu(false)
  }

  if (message.isDeleted) {
    return (
      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1`}>
        <span className="text-xs text-gray-400 italic px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-2xl">
          Message deleted
        </span>
      </div>
    )
  }

  // Group reactions by emoji
  const groupedReactions = message.reactions?.reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || [])
    acc[r.emoji].push(r.user?._id || r.user)
    return acc
  }, {}) || {}

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1 group`}>

      {/* Avatar */}
      {!isMine && (
        <img
          src={message.sender?.avatar || 'https://ui-avatars.com/api/?name=' + (message.sender?.username || 'U') + '&background=random'}
          className="w-7 h-7 rounded-full object-cover mr-2 mt-auto flex-shrink-0"
        />
      )}

      <div className="max-w-xs lg:max-w-md relative" ref={menuRef}>

        {/* Sender name */}
        {!isMine && (
          <p className="text-xs text-gray-400 mb-0.5 ml-1">{message.sender?.username}</p>
        )}

        {/* Reply preview */}
        {message.replyTo && !message.replyTo.isDeleted && (
          <div className={`mb-1 px-3 py-1.5 rounded-xl border-l-4 border-primary-400 bg-gray-100 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 ${isMine ? 'mr-1' : 'ml-1'}`}>
            <span className="font-medium text-primary-500">{message.replyTo.sender?.username}</span>
            <p className="truncate mt-0.5">
              {message.replyTo.messageType === 'image' ? '📷 Image' : message.replyTo.content}
            </p>
          </div>
        )}

        {/* Bubble */}
        <div
          className={`relative px-4 py-2 rounded-2xl cursor-pointer ${
            isMine
              ? 'bg-primary-500 text-white rounded-br-sm'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-sm'
          }`}
          onClick={() => { setShowMenu(!showMenu); setShowEmojiPicker(false) }}
        >
          {isEditing ? (
            <div className="flex gap-2">
              <input
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEdit()}
                className="bg-transparent outline-none flex-1 text-sm min-w-0"
                autoFocus
              />
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
              {message.content && (
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {message.content}
                  {message.isEdited && <span className="text-xs opacity-60 ml-1">(edited)</span>}
                </p>
              )}
            </>
          )}

          {/* Time + read receipt */}
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

        {/* Reactions display */}
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

        {/* Context menu */}
        {showMenu && (
          <div className={`absolute ${isMine ? 'right-0' : 'left-0'} top-0 -translate-y-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-20 min-w-max`}>

            {/* Emoji reaction row */}
            <div className="flex gap-1 px-3 py-2 border-b border-gray-100 dark:border-gray-700">
              {EMOJI_LIST.map(emoji => (
                <button key={emoji} onClick={() => handleReaction(emoji)}
                  className="text-xl hover:scale-125 transition-transform p-0.5">
                  {emoji}
                </button>
              ))}
            </div>

            {/* Actions */}
            <button onClick={handleReply}
              className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-200">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
              </svg>
              Reply
            </button>

            {isMine && (
              <>
                <button onClick={() => { setIsEditing(true); setShowMenu(false) }}
                  className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-200">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                  Edit
                </button>
                <button onClick={handleDelete}
                  className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm text-red-500">
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
  )
}