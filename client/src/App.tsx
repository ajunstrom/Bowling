import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import OperatorDashboard from './pages/OperatorDashboard'
import BowlerDashboard from './pages/BowlerDashboard'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/operator/:sessionId" element={<OperatorDashboard />} />
        <Route path="/bowler/:token" element={<BowlerDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
