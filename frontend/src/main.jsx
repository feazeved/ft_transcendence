// This is the entry point of the app: the first JS file that runs in the browser.
// Its only job is to mount the React app onto the real DOM.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.jsx'

// index.html has a single <div id="root"></div>. createRoot() add React to the index.html,
// and .render() tells React what to put inside it.
createRoot(document.getElementById('root')).render(
  // StrictMode doesn't render any UI. It's a dev-only helper that double-invokes some functions to help catch bugs
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
