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
    onlineUsers = [],
    replyingTo,
    clearReplyingTo,
  } = useChatStore()

  const [text, setText] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const typingTimeoutRef = useRef(null)
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const socket = getSocket()
    if (!socket || !activeConversation) return
    socket.emit('conversation:join', activeConversation._id)
    socket.emit('message:read', { conversationId: activeConversation._id })
    return () => socket.emit('conversation:leave', activeConversation._id)
  }, [activeConversation?._id])

  // Focus textarea when replying
  useEffect(() => {
    if (replyingTo) textareaRef.current?.focus()
  }, [replyingTo])

  const otherUser = activeConversation?.isGroup
    ? null
    : activeConversation?.participants?.find(p => p._id !== authUser?._id)

  const isOtherOnline = otherUser ? onlineUsers.includes(otherUser._id) : false
  const currentTyping = typingUsers?.[activeConversation?._id] || []

  const handleTextChange = (e) => {
    setText(e.target.value)
    const socket = getSocket()
    if (!socket || !activeConversation) return
    socket.emit('typing:start', { conversationId: activeConversation._id })
    clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing:stop', { conversationId: activeConversation._id })
    }, 2000)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  const handleSend = async () => {
    const trimmed = text.trim()
    if (!trimmed || !activeConversation) return
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    const socket = getSocket()
    socket?.emit('typing:stop', { conversationId: activeConversation._id })
    clearTimeout(typingTimeoutRef.current)
    await sendMessage({
      conversationId: activeConversation._id,
      content: trimmed,
      messageType: 'text',
      replyTo: replyingTo?._id || null,
    })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !activeConversation) return
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await axios.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await sendMessage({
        conversationId: activeConversation._id,
        content: '',
        messageType: 'image',
        mediaUrl: data.url,
        replyTo: replyingTo?._id || null,
      })
    } catch { toast.error('Image upload failed') }
    finally { setIsUploading(false); e.target.value = '' }
  }

  if (!activeConversation) return null

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">

      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3 flex-shrink-0">
        <button onClick={onOpenSidebar} className="md:hidden p-1 text-gray-500">←</button>
        <div className="relative">
          <img
            src={
              activeConversation.isGroup
                ? (activeConversation.groupAvatar || 'https://ui-avatars.com/api/?name=' + activeConversation.groupName + '&background=random')
                : (otherUser?.avatar || 'https://ui-avatars.com/api/?name=' + otherUser?.username + '&background=random')
            }
            className="w-9 h-9 rounded-full object-cover"
          />
          {isOtherOnline && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"/>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm text-gray-900 dark:text-white truncate">
            {activeConversation.isGroup ? activeConversation.groupName : otherUser?.username}
          </h2>
          <p className="text-xs text-gray-400">
            {activeConversation.isGroup
              ? activeConversation.participants?.length + ' members'
              : isOtherOnline ? 'Online' : 'Offline'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5">
        {isLoadingMessages ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"/>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-400 py-12 text-sm">No messages yet 👋</div>
        ) : (
          messages.map(msg => <MessageBubble key={msg._id} message={msg} />)
        )}
        <TypingIndicator typingUsers={currentTyping.filter(u => u.userId !== authUser?._id)} />
        <div ref={bottomRef} />
      </div>

      {/* Reply preview bar */}
      {replyingTo && (
        <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
          <div className="flex-1 border-l-4 border-primary-400 pl-3">
            <p className="text-xs font-medium text-primary-500">{replyingTo.sender?.username}</p>
            <p className="text-xs text-gray-500 truncate">
              {replyingTo.messageType === 'image' ? '📷 Image' : replyingTo.content}
            </p>
          </div>
          <button onClick={clearReplyingTo} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none">×</button>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex items-end gap-2 flex-shrink-0">
        <button onClick={() => fileInputRef.current?.click()} disabled={isUploading}
          className="p-2 rounded-xl text-gray-400 hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload}/>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="flex-1 px-4 py-2.5 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none overflow-hidden"
        />

        <button onClick={handleSend} disabled={!text.trim()}
          className="p-2.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-40 text-white rounded-2xl flex-shrink-0 transition-colors">
          <svg className="w-5 h-5 rotate-90" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>
  )
}