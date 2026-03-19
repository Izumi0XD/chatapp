// frontend/src/components/MessageBubble.jsx
import { useState } from 'react'
import { format } from 'date-fns'
import useAuthStore from '../store/authStore.js'
import axios from '../utils/axios.js'
import useChatStore from '../store/chatStore.js'
import toast from 'react-hot-toast'

export default function MessageBubble({ message }) {
  const { authUser } = useAuthStore()
  const { updateMessage, removeMessage } = useChatStore()
  const [showMenu, setShowMenu] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)

  const isMine = message.sender?._id === authUser?._id || message.sender === authUser?._id

  const handleDelete = async () => {
    try {
      await axios.delete('/messages/' + message._id)
      removeMessage({ messageId: message._id })
    } catch {
      toast.error('Failed to delete message')
    }
    setShowMenu(false)
  }

  const handleEdit = async () => {
    if (!editContent.trim()) return
    try {
      const { data } = await axios.put('/messages/' + message._id, { content: editContent })
      updateMessage(data)
      setIsEditing(false)
    } catch {
      toast.error('Failed to edit message')
    }
  }

  const handleReaction = async (emoji) => {
    try {
      await axios.post('/messages/' + message._id + '/reaction', { emoji })
    } catch {
      toast.error('Failed to add reaction')
    }
  }

  if (message.isDeleted) {
    return (
      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1`}>
        <span className="text-xs text-gray-400 dark:text-gray-500 italic px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-2xl">
          Message deleted
        </span>
      </div>
    )
  }

  return (
    <div
      className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1 group animate-slide-in`}
      onMouseLeave={() => setShowMenu(false)}
    >
      {/* Avatar for other users */}
      {!isMine && (
        <img
          src={message.sender?.avatar || 'https://ui-avatars.com/api/?name=' + (message.sender?.username || 'U') + '&background=random'}
          alt={message.sender?.username}
          className="w-7 h-7 rounded-full object-cover mr-2 mt-auto flex-shrink-0"
        />
      )}

      <div className="max-w-xs lg:max-w-md relative">
        {/* Sender name in group chats */}
        {!isMine && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 ml-1">
            {message.sender?.username}
          </p>
        )}

        {/* Message bubble */}
        <div
          className={`relative px-4 py-2 rounded-2xl ${
            isMine
              ? 'bg-primary-500 text-white rounded-br-sm'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-sm'
          }`}
          onClick={() => isMine && setShowMenu(!showMenu)}
        >
          {isEditing ? (
            <div className="flex gap-2">
              <input
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEdit()}
                className="bg-transparent outline-none flex-1 text-sm"
                autoFocus
              />
              <button onClick={handleEdit} className="text-xs opacity-70 hover:opacity-100">Save</button>
              <button onClick={() => setIsEditing(false)} className="text-xs opacity-70 hover:opacity-100">Cancel</button>
            </div>
          ) : (
            <>
              {/* Image message */}
              {message.messageType === 'image' && message.mediaUrl && (
                <img
                  src={message.mediaUrl}
                  alt="media"
                  className="rounded-xl max-w-full mb-1 cursor-pointer"
                  onClick={() => window.open(message.mediaUrl, '_blank')}
                />
              )}
              {/* Text content */}
              {message.content && (
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {message.content}
                  {message.isEdited && (
                    <span className="text-xs opacity-60 ml-1">(edited)</span>
                  )}
                </p>
              )}
            </>
          )}

          {/* Timestamp + read receipt */}
          <div className={`flex items-center justify-end gap-1 mt-1 ${isMine ? 'text-blue-100' : 'text-gray-400'}`}>
            <span className="text-xs opacity-70">
              {format(new Date(message.createdAt), 'HH:mm')}
            </span>
            {isMine && (
              <svg className="w-3.5 h-3.5 opacity-70" fill="currentColor" viewBox="0 0 16 16">
                {message.readBy?.length > 1
                  ? <path d="M1 8l3 3 9-9M5 8l3 3 9-9" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                  : <path d="M2 8l4 4 8-8" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                }
              </svg>
            )}
          </div>
        </div>

        {/* Reactions */}
        {message.reactions?.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
            {Object.entries(
              message.reactions.reduce((acc, r) => {
                acc[r.emoji] = (acc[r.emoji] || 0) + 1
                return acc
              }, {})
            ).map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                className="text-sm bg-gray-100 dark:bg-gray-700 rounded-full px-2 py-0.5 hover:scale-110 transition-transform"
              >
                {emoji} {count > 1 && <span className="text-xs text-gray-500">{count}</span>}
              </button>
            ))}
          </div>
        )}

        {/* Context menu (mine only) */}
        {showMenu && isMine && (
          <div className="absolute right-0 top-0 -translate-y-full bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden z-10 text-sm">
            <button
              onClick={() => { setIsEditing(true); setShowMenu(false) }}
              className="block w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="block w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}