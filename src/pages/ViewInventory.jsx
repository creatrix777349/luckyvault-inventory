import React, { useState, useEffect } from 'react'
import { fetchInventory, fetchLocations, supabase } from '../lib/supabase'
import { ToastContainer, useToast } from '../components/Toast'
import { Eye, Package, Search, Star, Edit2, Save, X } from 'lucide-react'

export default function ViewInventory() {
  const { toasts, addToast, removeToast } = useToast()
  
  const [inventory, setInventory] = useState([])
  const [highValueItems, setHighValueItems] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedLocation, setSelectedLocation] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState({
    brand: '',
    type: ''
  })
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ quantity: '', avg_cost_basis: '' })

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
      
      // Also fetch high value items
      let hvQuery = supabase
        .from('high_value_items')
        .select('*, location:locations(name)')
        .eq('status', 'In Inventory')
      
      if (selectedLocation) {
        hvQuery = hvQuery.eq('location_id', selectedLocation)
      }
      
      const { data: hvData } = await hvQuery.order('created_at', { ascending: false })
      setHighValueItems(hvData || [])
    } catch (error) {
      console.error('Error loading inventory:', error)
    }
  }

  const startEdit = (inv) => {
    setEditingId(inv.id)
    setEditForm({
      quantity: inv.quantity.toString(),
      avg_cost_basis: inv.avg_cost_basis?.toString() || '0'
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({ quantity: '', avg_cost_basis: '' })
  }

  const saveEdit = async (invId) => {
    try {
      const { error } = await supabase
        .from('inventory')
        .update({
          quantity: parseInt(editForm.quantity) || 0,
          avg_cost_basis: parseFloat(editForm.avg_cost_basis) || 0
        })
        .eq('id', invId)

      if (error) throw error

      addToast('Inventory updated!')
      setEditingId(null)
      loadInventory()
    } catch (error) {
      console.error('Error updating inventory:', error)
      addToast('Failed to update inventory', 'error')
    }
  }

  // Filter regular inventory
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

  // Filter high value items
  const filteredHighValue = highValueItems.filter(item => {
    if (filters.brand && item.brand !== filters.brand) return false
    if (filters.type && item.item_type !== filters.type) return false
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      const matchesName = item.card_name?.toLowerCase().includes(search)
      const matchesBrand = item.brand?.toLowerCase().includes(search)
      if (!matchesName && !matchesBrand) return false
    }
    return true
  })

  // Group regular inventory by location
  const groupedByLocation = filteredInventory.reduce((acc, inv) => {
    const locName = inv.location?.name || 'Unknown'
    if (!acc[locName]) acc[locName] = { regular: [], highValue: [] }
    acc[locName].regular.push(inv)
    return acc
  }, {})

  // Add high value items to location groups
  filteredHighValue.forEach(item => {
    const locName = item.location?.name || 'Unknown'
    if (!groupedByLocation[locName]) groupedByLocation[locName] = { regular: [], highValue: [] }
    groupedByLocation[locName].highValue.push(item)
  })

  // Calculate totals including high value items
  const regularValue = filteredInventory.reduce((sum, inv) => 
    sum + (inv.quantity * (inv.avg_cost_basis || 0)), 0
  )
  const highValueTotal = filteredHighValue.reduce((sum, item) => 
    sum + (item.purchase_price_usd || 0), 0
  )
  const totalValue = regularValue + highValueTotal

  const regularItems = filteredInventory.reduce((sum, inv) => sum + inv.quantity, 0)
  const totalItems = regularItems + filteredHighValue.length

  // Render inventory row with edit capability
  const renderInventoryRow = (inv) => {
    const isEditing = editingId === inv.id

    return (
      <tr key={`reg-${inv.id}`}>
        <td className="font-medium text-white">{inv.product?.name}</td>
        <td>
          <span className={`badge ${inv.product?.brand === 'Pokemon' ? 'badge-warning' : inv.product?.brand === 'One Piece' ? 'badge-info' : 'badge-secondary'}`}>
            {inv.product?.brand}
          </span>
        </td>
        <td className="text-gray-400">{inv.product?.type}</td>
        <td className="text-gray-400">{inv.product?.language}</td>
        <td className="text-right">
          {isEditing ? (
            <input
              type="number"
              value={editForm.quantity}
              onChange={(e) => setEditForm(f => ({ ...f, quantity: e.target.value }))}
              className="w-20 text-right py-1 px-2 text-sm"
              min="0"
            />
          ) : (
            <span className="font-medium">{inv.quantity}</span>
          )}
        </td>
        <td className="text-right">
          {isEditing ? (
            <input
              type="number"
              value={editForm.avg_cost_basis}
              onChange={(e) => setEditForm(f => ({ ...f, avg_cost_basis: e.target.value }))}
              className="w-24 text-right py-1 px-2 text-sm"
              min="0"
              step="0.01"
            />
          ) : (
            <span className="text-gray-400">${inv.avg_cost_basis?.toFixed(2) || '0.00'}</span>
          )}
        </td>
        <td className="text-right text-vault-gold font-medium">
          ${(inv.quantity * (inv.avg_cost_basis || 0)).toFixed(2)}
        </td>
        <td className="text-right">
          {isEditing ? (
            <div className="flex items-center justify-end gap-1">
              <button
                onClick={() => saveEdit(inv.id)}
                className="p-1 text-green-400 hover:text-green-300"
                title="Save"
              >
                <Save size={16} />
              </button>
              <button
                onClick={cancelEdit}
                className="p-1 text-gray-400 hover:text-white"
                title="Cancel"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => startEdit(inv)}
              className="p-1 text-gray-500 hover:text-white"
              title="Edit"
            >
              <Edit2 size={16} />
            </button>
          )}
        </td>
      </tr>
    )
  }

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <p className="text-gray-400 text-sm">Total Items</p>
          <p className="font-display text-2xl font-bold text-white">{totalItems.toLocaleString()}</p>
        </div>
        <div className="card">
          <p className="text-gray-400 text-sm">Total Value (Cost Basis)</p>
          <p className="font-display text-2xl font-bold text-vault-gold">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="card">
          <p className="text-gray-400 text-sm">Regular Products</p>
          <p className="font-display text-2xl font-bold text-white">{filteredInventory.length}</p>
        </div>
        <div className="card">
          <p className="text-gray-400 text-sm">High Value Items</p>
          <p className="font-display text-2xl font-bold text-yellow-400 flex items-center gap-1">
            <Star size={18} />
            {filteredHighValue.length}
          </p>
        </div>
      </div>

      {/* Inventory by Location */}
      {!selectedLocation ? (
        // Grouped view
        Object.entries(groupedByLocation).map(([locName, items]) => {
          const locRegularValue = items.regular.reduce((sum, inv) => sum + (inv.quantity * (inv.avg_cost_basis || 0)), 0)
          const locHighValueTotal = items.highValue.reduce((sum, item) => sum + (item.purchase_price_usd || 0), 0)
          const locTotalValue = locRegularValue + locHighValueTotal
          const locTotalItems = items.regular.reduce((sum, inv) => sum + inv.quantity, 0) + items.highValue.length
          
          return (
            <div key={locName} className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-display text-lg font-semibold text-white flex items-center gap-2">
                  <Package size={20} className="text-vault-gold" />
                  {locName}
                  <span className="text-gray-500 text-sm font-normal">
                    ({locTotalItems} items)
                  </span>
                </h3>
                <span className="text-vault-gold font-semibold">
                  ${locTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="card overflow-x-auto">
                {items.regular.length === 0 && items.highValue.length === 0 ? (
                  <p className="text-gray-400 text-center py-4">No inventory</p>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Brand</th>
                        <th>Type</th>
                        <th>Language</th>
                        <th className="text-right">Qty</th>
                        <th className="text-right">Avg Cost</th>
                        <th className="text-right">Total Value</th>
                        <th className="text-right w-16">Edit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Regular inventory items */}
                      {items.regular.map(inv => renderInventoryRow(inv))}
                      {/* High value items */}
                      {items.highValue.map(item => (
                        <tr key={`hv-${item.id}`} className="bg-yellow-500/5">
                          <td className="font-medium text-white flex items-center gap-2">
                            <Star size={14} className="text-yellow-400" />
                            {item.card_name}
                            {item.grading_company && <span className="text-gray-500 text-xs">({item.grading_company} {item.grade})</span>}
                          </td>
                          <td>
                            <span className={`badge ${item.brand === 'Pokemon' ? 'badge-warning' : item.brand === 'One Piece' ? 'badge-info' : 'badge-secondary'}`}>
                              {item.brand}
                            </span>
                          </td>
                          <td className="text-gray-400">{item.item_type}</td>
                          <td className="text-gray-400">-</td>
                          <td className="text-right font-medium">1</td>
                          <td className="text-right text-gray-400">${item.purchase_price_usd?.toFixed(2) || '-'}</td>
                          <td className="text-right text-vault-gold font-medium">
                            ${item.purchase_price_usd?.toFixed(2) || '-'}
                          </td>
                          <td className="text-right text-gray-500 text-xs">HV</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )
        })
      ) : (
        // Single location view
        <div className="card overflow-x-auto">
          {filteredInventory.length === 0 && filteredHighValue.length === 0 ? (
            <div className="text-center py-12">
              <Package className="mx-auto text-gray-600 mb-4" size={48} />
              <p className="text-gray-400">No inventory found</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Brand</th>
                  <th>Type</th>
                  <th>Language</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Avg Cost</th>
                  <th className="text-right">Total Value</th>
                  <th className="text-right w-16">Edit</th>
                </tr>
              </thead>
              <tbody>
                {/* Regular inventory items */}
                {filteredInventory.map(inv => renderInventoryRow(inv))}
                {/* High value items */}
                {filteredHighValue.map(item => (
                  <tr key={`hv-${item.id}`} className="bg-yellow-500/5">
                    <td className="font-medium text-white flex items-center gap-2">
                      <Star size={14} className="text-yellow-400" />
                      {item.card_name}
                      {item.grading_company && <span className="text-gray-500 text-xs">({item.grading_company} {item.grade})</span>}
                    </td>
                    <td>
                      <span className={`badge ${item.brand === 'Pokemon' ? 'badge-warning' : item.brand === 'One Piece' ? 'badge-info' : 'badge-secondary'}`}>
                        {item.brand}
                      </span>
                    </td>
                    <td className="text-gray-400">{item.item_type}</td>
                    <td className="text-gray-400">-</td>
                    <td className="text-right font-medium">1</td>
                    <td className="text-right text-gray-400">${item.purchase_price_usd?.toFixed(2) || '-'}</td>
                    <td className="text-right text-vault-gold font-medium">
                      ${item.purchase_price_usd?.toFixed(2) || '-'}
                    </td>
                    <td className="text-right text-gray-500 text-xs">HV</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
