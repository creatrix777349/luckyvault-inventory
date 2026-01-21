import React, { useState, useEffect } from 'react'
import { fetchInventory, fetchLocations } from '../lib/supabase'
import { ToastContainer, useToast } from '../components/Toast'
import { Eye, Package, Search } from 'lucide-react'

export default function ViewInventory() {
  const { toasts, addToast, removeToast } = useToast()
  
  const [inventory, setInventory] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedLocation, setSelectedLocation] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState({
    brand: '',
    type: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    loadInventory()
  }, [selectedLocation])

  const loadData = async () => {
    try {
      const locData = await fetchLocations('Physical')
      setLocations(locData)
      // Load all inventory by default
      loadInventory()
    } catch (error) {
      console.error('Error loading data:', error)
      addToast('Failed to load data', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadInventory = async () => {
    try {
      const invData = await fetchInventory(selectedLocation || null)
      setInventory(invData)
    } catch (error) {
      console.error('Error loading inventory:', error)
    }
  }

  const filteredInventory = inventory.filter(inv => {
    if (filters.brand && inv.product?.brand !== filters.brand) return false
    if (filters.type && inv.product?.type !== filters.type) return false
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      const matchesName = inv.product?.name?.toLowerCase().includes(search)
      const matchesBrand = inv.product?.brand?.toLowerCase().includes(search)
      if (!matchesName && !matchesBrand) return false
    }
    return true
  })

  // Group by location
  const groupedByLocation = filteredInventory.reduce((acc, inv) => {
    const locName = inv.location?.name || 'Unknown'
    if (!acc[locName]) acc[locName] = []
    acc[locName].push(inv)
    return acc
  }, {})

  const totalValue = filteredInventory.reduce((sum, inv) => 
    sum + (inv.quantity * (inv.avg_cost_basis || 0)), 0
  )

  const totalItems = filteredInventory.reduce((sum, inv) => sum + inv.quantity, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-white flex items-center gap-3">
          <Eye className="text-slate-400" />
          View Inventory
        </h1>
        <p className="text-gray-400 mt-1">View inventory across all locations</p>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Location</label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
            >
              <option value="">All Locations</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Brand</label>
            <select
              value={filters.brand}
              onChange={(e) => setFilters(f => ({ ...f, brand: e.target.value }))}
            >
              <option value="">All Brands</option>
              <option value="Pokemon">Pokemon</option>
              <option value="One Piece">One Piece</option>
              <option value="Other">Other</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters(f => ({ ...f, type: e.target.value }))}
            >
              <option value="">All Types</option>
              <option value="Sealed">Sealed</option>
              <option value="Pack">Pack</option>
              <option value="Single">Single</option>
              <option value="Slab">Slab</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search products..."
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <p className="text-gray-400 text-sm">Total Items</p>
          <p className="font-display text-2xl font-bold text-white">{totalItems.toLocaleString()}</p>
        </div>
        <div className="card">
          <p className="text-gray-400 text-sm">Total Value (Cost Basis)</p>
          <p className="font-display text-2xl font-bold text-vault-gold">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="card">
          <p className="text-gray-400 text-sm">Unique Products</p>
          <p className="font-display text-2xl font-bold text-white">{filteredInventory.length}</p>
        </div>
      </div>

      {/* Inventory Table */}
      {!selectedLocation ? (
        // Grouped view
        Object.entries(groupedByLocation).map(([locName, items]) => (
          <div key={locName} className="mb-6">
            <h3 className="font-display text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Package size={20} className="text-vault-gold" />
              {locName}
              <span className="text-gray-500 text-sm font-normal">({items.length} products)</span>
            </h3>
            <div className="card overflow-x-auto">
              <InventoryTable items={items} showLocation={false} />
            </div>
          </div>
        ))
      ) : (
        // Single location view
        <div className="card overflow-x-auto">
          {filteredInventory.length === 0 ? (
            <div className="text-center py-12">
              <Package className="mx-auto text-gray-600 mb-4" size={48} />
              <p className="text-gray-400">No inventory found</p>
            </div>
          ) : (
            <InventoryTable items={filteredInventory} showLocation={false} />
          )}
        </div>
      )}
    </div>
  )
}

function InventoryTable({ items, showLocation }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th>Brand</th>
          <th>Type</th>
          <th>Language</th>
          {showLocation && <th>Location</th>}
          <th className="text-right">Qty</th>
          <th className="text-right">Avg Cost</th>
          <th className="text-right">Total Value</th>
        </tr>
      </thead>
      <tbody>
        {items.map(inv => (
          <tr key={inv.id}>
            <td className="font-medium text-white">{inv.product?.name}</td>
            <td>
              <span className={`badge ${inv.product?.brand === 'Pokemon' ? 'badge-warning' : 'badge-info'}`}>
                {inv.product?.brand}
              </span>
            </td>
            <td className="text-gray-400">{inv.product?.type}</td>
            <td className="text-gray-400">{inv.product?.language}</td>
            {showLocation && <td className="text-gray-400">{inv.location?.name}</td>}
            <td className="text-right font-medium">{inv.quantity}</td>
            <td className="text-right text-gray-400">${inv.avg_cost_basis?.toFixed(2) || '0.00'}</td>
            <td className="text-right text-vault-gold font-medium">
              ${(inv.quantity * (inv.avg_cost_basis || 0)).toFixed(2)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
