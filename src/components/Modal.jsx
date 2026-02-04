import { X } from 'lucide-react'
import { useEffect } from 'react'

const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  useEffect(() => {
    // Prevent body scroll when modal is open
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-5xl',
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-start justify-center pt-20 pb-4 px-4 overflow-y-auto" style={{ zIndex: 10000 }}>
      {/* Background overlay */}
      <div
        className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal panel */}
      <div
        className={`relative bg-white rounded-lg text-left overflow-hidden shadow-xl w-full ${sizeClasses[size]} max-h-[calc(100vh-6rem)] flex flex-col mt-4`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0 sticky top-0 bg-white z-10">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-3 flex-1 overflow-y-auto min-h-0">{children}</div>
      </div>
    </div>
  )
}

export default Modal
