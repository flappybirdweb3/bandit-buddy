'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { Sparkles } from 'lucide-react'

type ToastCtx = { notify: (message: string) => void }
const ToastContext = createContext<ToastCtx>({ notify: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState('')

  const notify = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2800)
  }

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      {notice && (
        <div className="toast" role="status">
          <Sparkles size={16} /> {notice}
        </div>
      )}
    </ToastContext.Provider>
  )
}
