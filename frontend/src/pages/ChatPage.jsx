import { useEffect, useState } from 'react'
import useChatStore from '../store/chatStore.js'
import Sidebar from '../components/Sidebar.jsx'
import ChatWindow from '../components/ChatWindow.jsx'
import NoChatSelected from '../components/NoChatSelected.jsx'

export default function ChatPage() {
  const { activeConversation, fetchConversations, setActiveConversation } = useChatStore()
  const [showSidebar, setShowSidebar] = useState(true)

  useEffect(() => {
    fetchConversations()
  }, [])

  const handleSelectConversation = () => setShowSidebar(false)

  const handleBackToSidebar = () => {
    setActiveConversation(null)
    setShowSidebar(true)
  }

  return (
    <div className="fixed inset-0 flex bg-white dark:bg-gray-900">
      {/* Sidebar */}
      <div className={`
        flex-shrink-0 border-r border-gray-200 dark:border-gray-700
        w-full md:w-80
        ${showSidebar ? 'flex' : 'hidden'}
        md:flex flex-col
      `}>
        <Sidebar onSelectConversation={handleSelectConversation} />
      </div>

      {/* Chat area */}
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