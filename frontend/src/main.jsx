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
            background: 'rgb(var(--c-surface-elevated))',
            color: 'rgb(var(--c-text-primary))',
            border: '1px solid rgb(var(--c-surface-border))',
            fontFamily: "'Inter Variable', system-ui, sans-serif",
            fontSize: '14px',
            borderRadius: '12px',
          },
          success: { iconTheme: { primary: 'rgb(var(--c-success))', secondary: 'rgb(var(--c-surface-elevated))' } },
          error: {
            iconTheme: { primary: 'rgb(var(--c-danger))', secondary: 'rgb(var(--c-surface-elevated))' },
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
)
