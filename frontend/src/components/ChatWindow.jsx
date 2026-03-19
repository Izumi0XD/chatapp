import { useEffect, useRef, useState } from 'react'
import useAuthStore from '../store/authStore.js'
import useChatStore from '../store/chatStore.js'
import { getSocket } from '../hooks/useSocket.js'
import MessageBubble from './MessageBubble.jsx'
import TypingIndicator from './TypingIndicator.jsx'
import axios from '../utils/axios.js'
import toast from 'react-hot-toast'

export default function ChatWindow({ onOpenSidebar }) {
  const { authUser } = useAuthStore()
  const {
    activeConversation,
    messages,
    isLoadingMessages,
    sendMessage,
    typingUsers,
    onlineUsers = [], // ✅ safe default
  } = useChatStore()

  const [text, setText] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  const typingTimeoutRef = useRef(null)
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)

  // ✅ Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ✅ Join + leave socket rooms properly
  useEffect(() => {
    const socket = getSocket()
    if (!socket || !activeConversation) return

    socket.emit('conversation:join', activeConversation._id)
    socket.emit('message:read', { conversationId: activeConversation._id })

    return () => {
      socket.emit('conversation:leave', activeConversation._id)
    }
  }, [activeConversation, activeConversation._id])

  // ✅ Cleanup typing timeout
  useEffect(() => {
    return () => {
      clearTimeout(typingTimeoutRef.current)
    }
  }, [])

  // ✅ Get other user
  const otherUser = activeConversation?.isGroup
    ? null
    : activeConversation?.participants?.find(
        (p) => p._id !== authUser?._id
      )

  const isOtherOnline = otherUser
    ? onlineUsers.includes(otherUser._id)
    : false

  const currentTyping =
    typingUsers?.[activeConversation?._id] || []

  // ✅ Typing handler
  const handleTextChange = (e) => {
// sourcery skip: use-object-destructuring
    const value = e.target.value
    setText(value)

    const socket = getSocket()
    if (!socket || !activeConversation) return

    socket.emit('typing:start', {
      conversationId: activeConversation._id,
    })

    clearTimeout(typingTimeoutRef.current)

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing:stop', {
        conversationId: activeConversation._id,
      })
    }, 2000)

    // ✅ Auto resize textarea
    e.target.style.height = 'auto'
    e.target.style.height = `${e.target.scrollHeight}px`
  }

  // ✅ Send message
  const handleSend = async () => {
    const trimmed = text.trim()
    if (!trimmed || !activeConversation) return

    setText('')

    const socket = getSocket()
    socket?.emit('typing:stop', {
      conversationId: activeConversation._id,
    })

    clearTimeout(typingTimeoutRef.current)

    try {
      await sendMessage({
        conversationId: activeConversation._id,
        content: trimmed,
        messageType: 'text',
      })
    } catch {
      toast.error('Failed to send message')
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ✅ Image upload FIXED
  const handleImageUpload = async (e) => {
    if (!activeConversation) {
      toast.error('No conversation selected')
      return
    }

    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const { data } = await axios.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      await sendMessage({
        conversationId: activeConversation._id,
        content: '',
        messageType: 'image',
        mediaUrl: data.url,
      })
    } catch {
      toast.error('Image upload failed')
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }

  if (!activeConversation) return null

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      
      {/* HEADER */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="md:hidden p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          ←
        </button>

        <img
          src={
            activeConversation.isGroup
              ? activeConversation.groupAvatar ||
                `https://ui-avatars.com/api/?name=${activeConversation.groupName}`
              : otherUser?.avatar ||
                `https://ui-avatars.com/api/?name=${otherUser?.username}`
          }
          className="w-9 h-9 rounded-full"
        />

        <div className="flex-1">
          <h2 className="text-sm font-semibold text-white">
            {activeConversation.isGroup
              ? activeConversation.groupName
              : otherUser?.username}
          </h2>
          <p className="text-xs text-gray-400">
            {activeConversation.isGroup
              ? `${activeConversation.participants?.length} members`
              : isOtherOnline
              ? 'Online'
              : 'Offline'}
          </p>
        </div>
      </div>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {isLoadingMessages ? (
          <div className="text-center py-6">Loading...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-400">
            No messages yet 👋
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg._id} message={msg} />
          ))
        )}

        <TypingIndicator
          typingUsers={currentTyping.filter(
            (u) => u.userId !== authUser?._id
          )}
        />

        <div ref={bottomRef} />
      </div>

      {/* INPUT */}
      <div className="p-3 border-t border-gray-700 flex gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          📎
        </button>

        <input
          ref={fileInputRef}
          type="file"
          hidden
          accept="image/*"
          onChange={handleImageUpload}
        />

        <textarea
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Type..."
          className="flex-1 resize-none bg-gray-800 text-white p-2 rounded"
        />

        <button
          onClick={handleSend}
          disabled={!text.trim()}
        >
          ➤
        </button>
      </div>
    </div>
  )
}