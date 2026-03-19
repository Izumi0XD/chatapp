// frontend/src/hooks/useSocket.js
import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import useAuthStore from '../store/authStore.js'
import useChatStore from '../store/chatStore.js'

let socketInstance = null  // module-level singleton

const useSocket = () => {
  const { authUser } = useAuthStore()
  const {
    addMessage,
    updateMessage,
    removeMessage,
    setOnlineUsers,
    updateUserOnlineStatus,
    setTyping,
    addConversation,
  } = useChatStore()

  useEffect(() => {
    if (!authUser) {
      // User logged out — disconnect socket
      if (socketInstance) {
        socketInstance.disconnect()
        socketInstance = null
      }
      return
    }

    // Connect to socket server
    socketInstance = io(import.meta.env.VITE_SOCKET_URL, {
  withCredentials: true,
  transports: ['websocket'],
  auth: {
    token: localStorage.getItem('token'),
  },
})

    socketInstance.on('connect', () => {
      console.log('Socket connected:', socketInstance.id)
    })

    socketInstance.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message)
    })

    // ── Incoming events ──────────────────────────────────────
    socketInstance.on('users:online', (userIds) => {
      setOnlineUsers(userIds)
    })

    socketInstance.on('user:online', (data) => {
      updateUserOnlineStatus({ userId: data.userId, isOnline: true })
    })

    socketInstance.on('user:offline', (data) => {
      updateUserOnlineStatus({ userId: data.userId, isOnline: false })
    })

    socketInstance.on('message:new', (message) => {
      addMessage(message)
    })

    socketInstance.on('message:edited', (message) => {
      updateMessage(message)
    })

    socketInstance.on('message:deleted', (data) => {
      removeMessage(data)
    })

    socketInstance.on('typing:update', (data) => {
      setTyping(data)
    })

    socketInstance.on('conversation:new', (conversation) => {
      addConversation(conversation)
    })

    return () => {
      socketInstance?.off('users:online')
      socketInstance?.off('user:online')
      socketInstance?.off('user:offline')
      socketInstance?.off('message:new')
      socketInstance?.off('message:edited')
      socketInstance?.off('message:deleted')
      socketInstance?.off('typing:update')
      socketInstance?.off('conversation:new')
    }
  }, [authUser])

  return socketInstance
}

// Export getter so other components can emit events
export const getSocket = () => socketInstance
export default useSocket