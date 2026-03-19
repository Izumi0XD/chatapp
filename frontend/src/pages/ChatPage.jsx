// frontend/src/pages/ChatPage.jsx
import { useEffect, useState } from 'react'
import useChatStore from '../store/chatStore.js'
import Sidebar from '../components/Sidebar.jsx'
import ChatWindow from '../components/ChatWindow.jsx'
import NoChatSelected from '../components/NoChatSelected.jsx'

export default function ChatPage() {
  const { activeConversation, fetchConversations } = useChatStore()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  return (
    <div className="h-screen flex overflow-hidden bg-white dark:bg-gray-900">
      {/* Sidebar — conversation list */}
      <div className={`
        ${sidebarOpen ? 'w-80' : 'w-0'}
        flex-shrink-0 border-r border-gray-200 dark:border-gray-700
        transition-all duration-300 overflow-hidden
        md:block
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeConversation
          ? <ChatWindow onOpenSidebar={() => setSidebarOpen(true)} />
          : <NoChatSelected onOpenSidebar={() => setSidebarOpen(true)} />
        }
      </div>
    </div>
  )
}