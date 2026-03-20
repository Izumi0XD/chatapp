import { useEffect } from 'react'
import { io } from 'socket.io-client'
import useAuthStore from '../store/authStore.js'
import useChatStore from '../store/chatStore.js'

let socketInstance = null

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
      if (socketInstance) {
        socketInstance.disconnect()
        socketInstance = null
      }
      return
    }

    socketInstance = io(import.meta.env.VITE_SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
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

    socketInstance.on('users:online', setOnlineUsers)
    socketInstance.on('user:online', (data) => updateUserOnlineStatus({ userId: data.userId, isOnline: true }))
    socketInstance.on('user:offline', (data) => updateUserOnlineStatus({ userId: data.userId, isOnline: false }))
    socketInstance.on('message:new', addMessage)
    socketInstance.on('message:edited', updateMessage)
    socketInstance.on('message:deleted', removeMessage)
    socketInstance.on('typing:update', setTyping)
    socketInstance.on('conversation:new', addConversation)
    socketInstance.on('message:reaction', ({ messageId, reactions }) => {
  useChatStore.getState().updateReactions({ messageId, reactions })
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
      socketInstance?.off('message:reaction')
      
    }
  }, [authUser])

  return socketInstance
}

export const getSocket = () => socketInstance
export default useSocket