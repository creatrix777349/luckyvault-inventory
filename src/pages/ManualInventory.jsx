import React, { useState, useEffect } from 'react'

import { 
  fetchProducts, 
  fetchLocations,
  updateInventory
} from '../lib/supabase'
import { ToastContainer, useToast } from '../components/Toast'
import SearchableSelect from '../components/SearchableSelect'
import { PackagePlus, Save, Plus, Trash2 } from 'lucide-react'

export default function ManualInventory() {
  
  const { toasts, addToast, removeToast } = useToast()
  
  const [products, setProducts] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [mode, setMode] = useState('single') // 'single' or 'bulk'

  const [form, setForm] = useState({
    product_id: '',
    location_id: '',
    quantity: '',
    avg_cost_basis: ''
  })

  // Bulk items
  const [bulkItems, setBulkItems] = useState([
    { id: 1, product_id: '', quantity: 1, avg_cost_basis: '' }
  ])
  const [bulkLocation, setBulkLocation] = useState('')

  const [productFilters, setProductFilters] = useState({
    brand: '',
    type: '',
    language: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [productsData, locationsData] = await Promise.all([
        fetchProducts(),
        fetchLocations('Physical')
      ])
      // Filter to only sealed products (no singles/slabs)
      const sealedProducts = productsData.filter(p => p.type === 'Sealed' || p.type === 'Pack')
      setProducts(sealedProducts)
      setLocations(locationsData)
      
      // Default to Master Inventory
      const master = locationsData.find(l => l.name === 'Master Inventory')
      if (master) {
        setForm(f => ({ ...f, location_id: master.id }))
        setBulkLocation(master.id)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      addToast('Failed to load data', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setProductFilters(f => ({ ...f, [name]: value }))
    setForm(f => ({ ...f, product_id: '' }))
  }

  // Filter products for dropdown
  const filteredProducts = products.filter(p => {
    if (productFilters.brand && p.brand !== productFilters.brand) return false
    if (productFilters.type && p.type !== productFilters.type) return false
    if (productFilters.language && p.language !== productFilters.language) return false
    return true
  })

  // Bulk handlers
  const addBulkItem = () => {
    const newId = Math.max(...bulkItems.map(i => i.id), 0) + 1
    setBulkItems([...bulkItems, { id: newId, product_id: '', quantity: 1, avg_cost_basis: '' }])
  }

  const removeBulkItem = (id) => {
    if (bulkItems.length <= 1) {
      addToast('Must have at least one item', 'error')
      return
    }
    setBulkItems(bulkItems.filter(i => i.id !== id))
  }

  const updateBulkItem = (id, field, value) => {
    setBulkItems(bulkItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!form.product_id || !form.location_id) {
      addToast('Please select product and location', 'error')
      return
    }

    if (!form.quantity || parseInt(form.quantity) <= 0) {
      addToast('Please enter a valid quantity', 'error')
      return
    }

    setSubmitting(true)

    try {
      const avgCostBasis = form.avg_cost_basis !== '' ? parseFloat(form.avg_cost_basis) : null
      
      await updateInventory(
        form.product_id,
        form.location_id,
        parseInt(form.quantity),
        avgCostBasis
      )

      addToast('Inventory added successfully!')
      
      setForm(f => ({
        ...f,
        product_id: '',
        quantity: '',
        avg_cost_basis: ''
      }))
    } catch (error) {
      console.error('Error adding inventory:', error)
      addToast('Failed to add inventory', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleBulkSubmit = async (e) => {
    e.preventDefault()
    
    if (!bulkLocation) {
      addToast('Please select a location', 'error')
      return
    }

    const validItems = bulkItems.filter(item => item.product_id && item.quantity > 0)
    if (validItems.length === 0) {
      addToast('Please add at least one product with quantity', 'error')
      return
    }

    setSubmitting(true)
    let successCount = 0

    try {
      for (const item of validItems) {
        try {
          const avgCostBasis = item.avg_cost_basis !== '' ? parseFloat(item.avg_cost_basis) : null
          await updateInventory(
            item.product_id,
            bulkLocation,
            parseInt(item.quantity),
            avgCostBasis
          )
          successCount++
        } catch (err) {
          console.error('Error adding item:', err)
        }
      }

      addToast(`${successCount} item(s) added to inventory!`)
      setBulkItems([{ id: 1, product_id: '', quantity: 1, avg_cost_basis: '' }])
    } catch (error) {
      console.error('Error in bulk add:', error)
      addToast('Failed to add inventory', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Format product for display
  const formatProductOption = (product) => (
    <div>
      <span className="text-vault-gold">{product.brand}</span>
      <span className="text-gray-400"> | </span>
      <span className="text-white">{product.name}</span>
      <span className="text-gray-500"> ({product.language})</span>
    </div>
  )

  const getProductLabel = (product) => 
    `${product.brand} | ${product.name} (${product.language})`

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
          <PackagePlus className="text-teal-400" />
          Manual Inventory
        </h1>
        <p className="text-gray-400 mt-1">Add inventory directly without purchase record</p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setMode('single')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            mode === 'single'
              ? 'bg-vault-gold text-vault-dark'
              : 'bg-vault-surface text-gray-400 hover:text-white'
          }`}
        >
          Single Item
        </button>
        <button
          type="button"
          onClick={() => setMode('bulk')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            mode === 'bulk'
              ? 'bg-vault-gold text-vault-dark'
              : 'bg-vault-surface text-gray-400 hover:text-white'
          }`}
        >
          Bulk Add
        </button>
      </div>

      {mode === 'single' ? (
        /* Single Item Form */
        <form onSubmit={handleSubmit} className="card max-w-2xl">
          {/* Location */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">Location *</label>
            <select
              name="location_id"
              value={form.location_id}
              onChange={handleChange}
              required
            >
              <option value="">Select location...</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>

          {/* Product Selection */}
          <div className="pt-4 border-t border-vault-border">
            <h3 className="font-display text-lg font-semibold text-white mb-4">Product Selection</h3>
            
            {/* Filters */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Brand</label>
                <select name="brand" value={productFilters.brand} onChange={handleFilterChange}>
                  <option value="">All Brands</option>
                  <option value="Pokemon">Pokemon</option>
                  <option value="One Piece">One Piece</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
                <select name="type" value={productFilters.type} onChange={handleFilterChange}>
                  <option value="">All Types</option>
                  <option value="Sealed">Sealed</option>
                  <option value="Pack">Pack</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Language</label>
                <select name="language" value={productFilters.language} onChange={handleFilterChange}>
                  <option value="">All Languages</option>
                  <option value="EN">English</option>
                  <option value="JP">Japanese</option>
                  <option value="CN">Chinese</option>
                </select>
              </div>
            </div>

            {/* Product Search */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Product *</label>
              <SearchableSelect
                options={filteredProducts}
                value={form.product_id}
                onChange={(val) => setForm(f => ({ ...f, product_id: val }))}
                placeholder="Type to search products..."
                getOptionValue={(p) => p.id}
                getOptionLabel={getProductLabel}
                renderOption={formatProductOption}
              />
            </div>
          </div>

          {/* Quantity and Cost */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Quantity *</label>
              <input
                type="number"
                name="quantity"
                value={form.quantity}
                onChange={handleChange}
                min="1"
                placeholder="Enter quantity"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Purchase Price (USD)
                <span className="text-gray-500 font-normal ml-1">- optional</span>
              </label>
              <input
                type="number"
                name="avg_cost_basis"
                value={form.avg_cost_basis}
                onChange={handleChange}
                min="0"
                step="0.01"
                placeholder="Leave blank if unknown"
              />
            </div>
          </div>

          <div className="mt-6">
            <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
              {submitting ? (
                <div className="spinner w-5 h-5 border-2"></div>
              ) : (
                <>
                  <Save size={20} />
                  Add Inventory
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        /* Bulk Add Form */
        <form onSubmit={handleBulkSubmit}>
          <div className="card mb-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display text-lg font-semibold text-white">Bulk Add Inventory</h2>
            </div>

            {/* Location for all items */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">Location (applies to all) *</label>
              <select
                value={bulkLocation}
                onChange={(e) => setBulkLocation(e.target.value)}
                required
              >
                <option value="">Select location...</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>

            {/* Bulk Items */}
            <div className="space-y-3">
              {bulkItems.map((item, index) => (
                <div key={item.id} className="p-4 bg-vault-dark rounded-lg border border-vault-border">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-vault-gold font-semibold text-sm">Item {index + 1}</span>
                    {bulkItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeBulkItem(item.id)}
                        className="p-1 text-gray-500 hover:text-red-400"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-400 mb-1">Product *</label>
                      <SearchableSelect
                        options={products}
                        value={item.product_id}
                        onChange={(val) => updateBulkItem(item.id, 'product_id', val)}
                        placeholder="Search products..."
                        getOptionValue={(p) => p.id}
                        getOptionLabel={getProductLabel}
                        renderOption={formatProductOption}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Qty *</label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateBulkItem(item.id, 'quantity', e.target.value)}
                        min="1"
                        className="w-full text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Cost (USD)</label>
                      <input
                        type="number"
                        value={item.avg_cost_basis}
                        onChange={(e) => updateBulkItem(item.id, 'avg_cost_basis', e.target.value)}
                        min="0"
                        step="0.01"
                        placeholder="Optional"
                        className="w-full text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addBulkItem}
              className="w-full mt-4 py-2 border-2 border-dashed border-vault-border rounded-lg text-gray-400 hover:text-white hover:border-vault-gold transition-colors"
            >
              <Plus size={16} className="inline mr-2" />
              Add Another Item
            </button>
          </div>

          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <span className="text-gray-400">
                Items to add: <span className="text-white font-semibold">{bulkItems.filter(i => i.product_id).length}</span>
              </span>
            </div>
            <button 
              type="submit" 
              className="btn btn-primary w-full"
              disabled={submitting || bulkItems.filter(i => i.product_id).length === 0}
            >
              {submitting ? (
                <div className="spinner w-5 h-5 border-2"></div>
              ) : (
                <><Save size={20} /> Add {bulkItems.filter(i => i.product_id).length} Item(s) to Inventory</>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
