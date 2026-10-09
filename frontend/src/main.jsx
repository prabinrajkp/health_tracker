import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#f1f5f9',
            border: '1px solid #334155',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '13px',
            borderRadius: '12px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          },
          success: { iconTheme: { primary: '#22c55e', secondary: '#1e293b' } },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#1e293b' },
            style: { borderColor: '#ef444440' },
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
)
