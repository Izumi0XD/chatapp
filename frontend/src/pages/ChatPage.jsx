import { useEffect, useState } from 'react'
import useChatStore from '../store/chatStore.js'
import Sidebar from '../components/Sidebar.jsx'
import ChatWindow from '../components/ChatWindow.jsx'
import NoChatSelected from '../components/NoChatSelected.jsx'

export default function ChatPage() {
  const { activeConversation, fetchConversations, setActiveConversation } = useChatStore()
  // On mobile: show sidebar by default, hide when chat is open
  const [showSidebar, setShowSidebar] = useState(true)

  useEffect(() => {
    fetchConversations()
  }, [])

  // When a conversation is selected on mobile, hide sidebar and show chat
  const handleSelectConversation = () => {
    setShowSidebar(false)
  }

  // When back button pressed in chat, show sidebar
  const handleBackToSidebar = () => {
    setActiveConversation(null)
    setShowSidebar(true)
  }

  return (
    <div className="h-screen flex overflow-hidden bg-white dark:bg-gray-900">

      {/* Sidebar — full screen on mobile, fixed width on desktop */}
      <div className={`
        flex-shrink-0 border-r border-gray-200 dark:border-gray-700
        w-full md:w-80
        ${showSidebar ? 'flex' : 'hidden'}
        md:flex flex-col
      `}>
        <Sidebar onSelectConversation={handleSelectConversation} />
      </div>

      {/* Chat area — full screen on mobile when open */}
      <div className={`
        flex-1 flex flex-col min-w-0
        ${!showSidebar ? 'flex' : 'hidden'}
        md:flex
      `}>
        {activeConversation
          ? <ChatWindow onBack={handleBackToSidebar} />
          : <NoChatSelected />
        }
      </div>
    </div>
  )
}