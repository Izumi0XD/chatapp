// frontend/src/components/NoChatSelected.jsx
export default function NoChatSelected({ onOpenSidebar }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-8">
      <button
        onClick={onOpenSidebar}
        className="md:hidden mb-4 px-4 py-2 text-sm bg-primary-500 text-white rounded-xl"
      >
        Open chats
      </button>
      <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900 rounded-3xl flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-primary-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
        Your messages
      </h2>
      <p className="text-gray-500 dark:text-gray-400 text-center text-sm max-w-xs">
        Select a conversation from the sidebar or search for someone to start chatting
      </p>
    </div>
  )
}