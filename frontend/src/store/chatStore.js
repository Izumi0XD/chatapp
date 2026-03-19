import { create } from 'zustand'
import axios from '../utils/axios.js'
import toast from 'react-hot-toast'

const useChatStore = create((set, get) => ({
  conversations: [],
  activeConversation: null,
  messages: [],
  onlineUsers: [],
  typingUsers: {},
  isLoadingMessages: false,
  isSendingMessage: false,

  fetchConversations: async () => {
    try {
      const { data } = await axios.get('/conversations')
      set({ conversations: data })
    } catch {
      toast.error('Failed to load conversations')
    }
  },

  setActiveConversation: (conversation) => {
    set({ activeConversation: conversation, messages: [] })
  },

  openOrCreateConversation: async (recipientId) => {
    try {
      const { data } = await axios.post('/conversations', { recipientId })
      const exists = get().conversations.find(c => c._id === data._id)
      if (!exists) {
        set({ conversations: [data, ...get().conversations] })
      }
      set({ activeConversation: data })
      return data
    } catch {
      toast.error('Failed to open conversation')
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

  // No optimistic add — socket delivers to everyone including sender
  sendMessage: async ({ conversationId, content, messageType, mediaUrl }) => {
    set({ isSendingMessage: true })
    try {
      await axios.post('/messages', {
        conversationId,
        content,
        messageType: messageType || 'text',
        mediaUrl,
      })
    } catch {
      toast.error('Failed to send message')
    } finally {
      set({ isSendingMessage: false })
    }
  },

  // Socket delivers message to ALL participants including sender
  // Simple dedup by _id — no double-checking conversation IDs
  addMessage: (message) => {
    const { messages, activeConversation } = get()

    const convId = message.conversation?._id || message.conversation

    if (activeConversation?._id === convId) {
      const exists = messages.some(m => m._id === message._id)
      if (!exists) {
        set({ messages: [...messages, message] })
      }
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
    set({
      messages: get().messages.map(m =>
        m._id === updatedMessage._id ? updatedMessage : m
      )
    })
  },

  removeMessage: ({ messageId }) => {
    set({
      messages: get().messages.map(m =>
        m._id === messageId ? { ...m, isDeleted: true, content: '' } : m
      )
    })
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
        participants: c.participants.map(p =>
          p._id === userId ? { ...p, isOnline } : p
        )
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
    if (!exists) {
      set({ conversations: [conversation, ...get().conversations] })
    }
  },
}))

export default useChatStore