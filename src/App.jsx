import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import ToastContainer from './components/ToastContainer'
import { subscribe } from './services/toastService'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import Agents from './pages/Agents'
import Staff from './pages/Staff'
import Banks from './pages/Banks'
import Franchises from './pages/Franchises'
import Invoices from './pages/Invoices'
import Payouts from './pages/Payouts'
import Settings from './pages/Settings'
import Help from './pages/Help'
import RegionalManagers from './pages/RegionalManagers'

function App() {
  const [notifications, setNotifications] = useState([])

  useEffect(() => {
    const unsubscribe = subscribe((notification) => {
      setNotifications((prev) => [...prev, notification])
    })
    return unsubscribe
  }, [])

  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <ToastContainer notifications={notifications} onRemove={removeNotification} />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="leads" element={<Leads />} />
          <Route path="agents" element={<Agents />} />
          <Route path="staff" element={<Staff />} />
          <Route path="banks" element={<Banks />} />
          <Route path="franchises" element={<Franchises />} />
          <Route path="regional-managers" element={<RegionalManagers />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="payouts" element={<Payouts />} />
          <Route path="settings" element={<Settings />} />
          <Route path="help" element={<Help />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
