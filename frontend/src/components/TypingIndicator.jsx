// frontend/src/components/TypingIndicator.jsx
export default function TypingIndicator({ typingUsers }) {
  if (!typingUsers || typingUsers.length === 0) return null

  const names = typingUsers.map(u => u.username).join(', ')

  return (
    <div className="flex items-center gap-2 px-4 py-1">
      {/* Animated dots */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-2xl px-3 py-2">
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-xs text-gray-400">{names} typing...</span>
    </div>
  )
}