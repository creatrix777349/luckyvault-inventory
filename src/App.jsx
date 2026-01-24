import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// Pages
import Dashboard from './pages/Dashboard'
import PurchasedItems from './pages/PurchasedItems'
import IntakeToMaster from './pages/IntakeToMaster'
import MovedInventory from './pages/MovedInventory'
import BreakBox from './pages/BreakBox'
import SendToGrading from './pages/SendToGrading'
import StorefrontSale from './pages/StorefrontSale'
import BusinessExpenses from './pages/BusinessExpenses'
import ViewInventory from './pages/ViewInventory'
import HighValueTracking from './pages/HighValueTracking'
import AddProduct from './pages/AddProduct'
import ManualInventory from './pages/ManualInventory'
import Reports from './pages/Reports'
import StreamCounts from './pages/StreamCounts'
import PlatformSales from './pages/PlatformSales'
import ProductMapping from './pages/ProductMapping'
import UserManagement from './pages/UserManagement'

// Components
import Layout from './components/Layout'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout><Dashboard /></Layout>} />
        <Route path="/stream-counts" element={<Layout><StreamCounts /></Layout>} />
        <Route path="/platform-sales" element={<Layout><PlatformSales /></Layout>} />
        <Route path="/purchased-items" element={<Layout><PurchasedItems /></Layout>} />
        <Route path="/intake" element={<Layout><IntakeToMaster /></Layout>} />
        <Route path="/move-inventory" element={<Layout><MovedInventory /></Layout>} />
        <Route path="/break-box" element={<Layout><BreakBox /></Layout>} />
        <Route path="/grading" element={<Layout><SendToGrading /></Layout>} />
        <Route path="/storefront-sale" element={<Layout><StorefrontSale /></Layout>} />
        <Route path="/expenses" element={<Layout><BusinessExpenses /></Layout>} />
        <Route path="/inventory" element={<Layout><ViewInventory /></Layout>} />
        <Route path="/high-value" element={<Layout><HighValueTracking /></Layout>} />
        <Route path="/add-product" element={<Layout><AddProduct /></Layout>} />
        <Route path="/manual-inventory" element={<Layout><ManualInventory /></Layout>} />
        <Route path="/reports" element={<Layout><Reports /></Layout>} />
        <Route path="/product-mapping" element={<Layout><ProductMapping /></Layout>} />
        <Route path="/users" element={<Layout><UserManagement /></Layout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
