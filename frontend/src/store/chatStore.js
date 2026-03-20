import { create } from 'zustand'
import axios from '../utils/axios.js'
import toast from 'react-hot-toast'

// Show browser push notification
const showNotification = (title, body, icon) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    if (document.hidden) { // only when tab is not active
      new Notification(title, { body, icon: icon || '/favicon.ico' })
    }
  }
}

const useChatStore = create((set, get) => ({
  conversations: [],
  activeConversation: null,
  messages: [],
  onlineUsers: [],
  typingUsers: {},
  isLoadingMessages: false,
  isSendingMessage: false,
  replyingTo: null,
  searchQuery: '',
  searchResults: [],
  isSearchingMessages: false,
  unreadCounts: {}, // { conversationId: count }

  fetchConversations: async () => {
    try {
      const { data } = await axios.get('/conversations')
      set({ conversations: data })
    } catch {
      toast.error('Failed to load conversations')
    }
  },

  setActiveConversation: (conversation) => {
    // Clear unread count when opening a conversation
    if (conversation) {
      set(state => ({
        activeConversation: conversation,
        messages: [],
        replyingTo: null,
        unreadCounts: { ...state.unreadCounts, [conversation._id]: 0 },
      }))
    } else {
      set({ activeConversation: conversation, messages: [], replyingTo: null })
    }
  },

  openOrCreateConversation: async (recipientId) => {
    try {
      const { data } = await axios.post('/conversations', { recipientId })
      const exists = get().conversations.find(c => c._id === data._id)
      if (!exists) set({ conversations: [data, ...get().conversations] })
      set({ activeConversation: data })
      return data
    } catch {
      toast.error('Failed to open conversation')
    }
  },

  createGroupConversation: async ({ name, memberIds }) => {
    try {
      const { data } = await axios.post('/conversations/group', { name, memberIds })
      set({ conversations: [data, ...get().conversations], activeConversation: data })
      toast.success('Group created!')
      return data
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create group')
    }
  },

  fetchMessages: async (conversationId) => {
    set({ isLoadingMessages: true })
    try {
      const { data } = await axios.get('/messages/' + conversationId)
      set({ messages: data.messages })
    } catch {
      toast.error('Failed to load messages')
    } finally {
      set({ isLoadingMessages: false })
    }
  },

  // Message search
  searchMessages: async (conversationId, query) => {
    if (!query.trim()) { set({ searchResults: [], searchQuery: '' }); return }
    set({ isSearchingMessages: true, searchQuery: query })
    try {
      const { data } = await axios.get('/messages/' + conversationId + '?limit=500')
      const results = data.messages.filter(m =>
        m.content?.toLowerCase().includes(query.toLowerCase()) && !m.isDeleted
      )
      set({ searchResults: results })
    } catch {
      toast.error('Search failed')
    } finally {
      set({ isSearchingMessages: false })
    }
  },

  clearSearch: () => set({ searchQuery: '', searchResults: [] }),

  sendMessage: async ({ conversationId, content, messageType, mediaUrl, replyTo }) => {
    set({ isSendingMessage: true })
    try {
      await axios.post('/messages', {
        conversationId, content,
        messageType: messageType || 'text',
        mediaUrl, replyTo,
      })
      set({ replyingTo: null })
    } catch {
      toast.error('Failed to send message')
    } finally {
      set({ isSendingMessage: false })
    }
  },

  setReplyingTo: (message) => set({ replyingTo: message }),
  clearReplyingTo: () => set({ replyingTo: null }),

  addMessage: (message) => {
    const { messages, activeConversation, unreadCounts } = get()
    const convId = message.conversation?._id || message.conversation
    const isActive = activeConversation?._id === convId

    if (isActive) {
      const exists = messages.some(m => m._id === message._id)
      if (!exists) set({ messages: [...messages, message] })
    } else {
      // Increment unread count
      set({
        unreadCounts: {
          ...unreadCounts,
          [convId]: (unreadCounts[convId] || 0) + 1,
        }
      })
      // Push notification
      const senderName = message.sender?.username || 'Someone'
      const body = message.messageType === 'image' ? '📷 sent an image' : message.content
      showNotification(senderName, body, message.sender?.avatar)
    }

    set({
      conversations: get().conversations.map(c =>
        c._id === convId
          ? { ...c, lastMessage: message, updatedAt: message.createdAt }
          : c
      ).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    })
  },

  updateMessage: (updatedMessage) => {
    set({ messages: get().messages.map(m => m._id === updatedMessage._id ? updatedMessage : m) })
  },

  removeMessage: ({ messageId }) => {
    set({ messages: get().messages.map(m => m._id === messageId ? { ...m, isDeleted: true, content: '' } : m) })
  },

  updateReactions: ({ messageId, reactions }) => {
    set({ messages: get().messages.map(m => m._id === messageId ? { ...m, reactions } : m) })
  },

  setOnlineUsers: (userIds) => set({ onlineUsers: userIds }),

  updateUserOnlineStatus: ({ userId, isOnline }) => {
    set({
      onlineUsers: isOnline
        ? [...new Set([...get().onlineUsers, userId])]
        : get().onlineUsers.filter(id => id !== userId)
    })
    set({
      conversations: get().conversations.map(c => ({
        ...c,
        participants: c.participants.map(p => p._id === userId ? { ...p, isOnline } : p)
      }))
    })
  },

  setTyping: ({ conversationId, userId, username, isTyping }) => {
    const current = get().typingUsers[conversationId] || []
    set({
      typingUsers: {
        ...get().typingUsers,
        [conversationId]: isTyping
          ? [...current.filter(u => u.userId !== userId), { userId, username }]
          : current.filter(u => u.userId !== userId)
      }
    })
  },

  addConversation: (conversation) => {
    const exists = get().conversations.find(c => c._id === conversation._id)
    if (!exists) set({ conversations: [conversation, ...get().conversations] })
  },
}))

export default useChatStore