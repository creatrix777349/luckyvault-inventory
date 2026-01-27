import React, { useState, useEffect } from 'react'

import { 
  fetchProducts, 
  fetchLocations,
  updateInventory,
  supabase
} from '../lib/supabase'
import { ToastContainer, useToast } from '../components/Toast'
import { PackagePlus, Save, Star, Search, Plus, Trash2 } from 'lucide-react'

// Grade options for slabs
const GRADE_OPTIONS = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
  { value: '6', label: '6' },
  { value: '7', label: '7' },
  { value: '8', label: '8' },
  { value: '9', label: '9' },
  { value: '10', label: '10' },
  { value: 'Pristine 10', label: 'Pristine 10' },
  { value: 'Black Label 10', label: 'Black Label 10' }
]

// Price bucket ranges for slabs
const getPriceBucket = (price) => {
  if (price >= 400) return '$400+'
  if (price >= 200) return '$200-400'
  if (price >= 100) return '$100-200'
  if (price >= 50) return '$50-100'
  return '$0-50'
}

export default function ManualInventory() {
  
  const { toasts, addToast, removeToast } = useToast()
  
  const [products, setProducts] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [mode, setMode] = useState('single') // 'single' or 'bulk'
  const [searchTerm, setSearchTerm] = useState('')

  const [form, setForm] = useState({
    product_id: '',
    location_id: '',
    quantity: '',
    avg_cost_basis: '',
    // Slab-specific fields
    grading_company: '',
    grade: '',
    current_market_price: '',
    card_name: ''
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
      setProducts(productsData)
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

  // Check if slab type is selected
  const isSlab = productFilters.type === 'Slab'
  
  // Check if high value ($200+)
  const currentMarketPriceNum = form.current_market_price ? parseFloat(form.current_market_price) : 0
  const isHighValue = currentMarketPriceNum >= 200

  // Filter products
  const filteredProducts = products.filter(p => {
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      const matchesSearch = 
        p.name?.toLowerCase().includes(search) ||
        p.brand?.toLowerCase().includes(search) ||
        p.type?.toLowerCase().includes(search) ||
        p.category?.toLowerCase().includes(search)
      if (!matchesSearch) return false
    }
    
    // Dropdown filters
    if (productFilters.brand && p.brand !== productFilters.brand) return false
    if (productFilters.type && p.type !== productFilters.type) return false
    if (productFilters.language && p.language !== productFilters.language) return false
    // For slabs, filter by grading company (category)
    if (isSlab && form.grading_company && p.category !== form.grading_company) return false
    return true
  })

  // Auto-select product for slabs based on grading company and price
  const autoSelectSlabProduct = () => {
    if (!isSlab || !form.grading_company || !form.current_market_price) return null
    
    const priceBucket = getPriceBucket(parseFloat(form.current_market_price))
    const matchingProduct = filteredProducts.find(p => 
      p.name.includes(priceBucket)
    )
    return matchingProduct
  }

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
    
    let productId = form.product_id
    
    // For slabs, auto-select product based on grading company and price
    if (isSlab) {
      if (!form.grading_company) {
        addToast('Please select a grading company', 'error')
        return
      }
      if (!form.current_market_price) {
        addToast('Please enter the current market price', 'error')
        return
      }
      if (!form.card_name.trim()) {
        addToast('Please enter the card name', 'error')
        return
      }
      
      const autoProduct = autoSelectSlabProduct()
      if (autoProduct) {
        productId = autoProduct.id
      } else if (!form.product_id) {
        addToast('Please select a product or check that matching slab products exist', 'error')
        return
      }
    }
    
    if (!productId || !form.location_id) {
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
        productId,
        form.location_id,
        parseInt(form.quantity),
        avgCostBasis
      )

      // If it's a high value slab ($200+), also add to high_value_items
      if (isSlab && isHighValue) {
        const selectedProduct = products.find(p => p.id === productId)
        await supabase.from('high_value_items').insert({
          card_name: form.card_name.trim(),
          brand: selectedProduct?.brand || productFilters.brand,
          item_type: 'Slab',
          grading_company: form.grading_company,
          grade: form.grade,
          purchase_price: avgCostBasis,
          purchase_price_usd: avgCostBasis,
          currency: 'USD',
          current_market_price: parseFloat(form.current_market_price),
          location_id: form.location_id,
          status: 'In Inventory',
          date_added: new Date().toISOString().split('T')[0],
          source: 'manual_inventory'
        })
      }

      const successMsg = isSlab && form.card_name 
        ? `Added: ${form.card_name} ${form.grading_company} ${form.grade}${isHighValue ? ' ⭐' : ''}`
        : 'Inventory added successfully!'
      addToast(successMsg)
      
      setForm(f => ({
        ...f,
        product_id: '',
        quantity: '',
        avg_cost_basis: '',
        grading_company: '',
        grade: '',
        current_market_price: '',
        card_name: ''
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
            
            {/* Search Bar */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search products..."
                  className="pl-10 w-full"
                />
              </div>
            </div>
            
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
                  <option value="Single">Single</option>
                  <option value="Slab">Slab</option>
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

            {/* SLAB-SPECIFIC FIELDS */}
            {isSlab && (
              <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg mb-4">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Card Name *</label>
                  <input
                    type="text"
                    name="card_name"
                    value={form.card_name}
                    onChange={handleChange}
                    placeholder="e.g., Charizard VMAX Alt Art"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Grading Company *</label>
                    <select name="grading_company" value={form.grading_company} onChange={handleChange}>
                      <option value="">Select...</option>
                      <option value="PSA">PSA</option>
                      <option value="CGC">CGC</option>
                      <option value="Beckett">Beckett</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Grade</label>
                    <select name="grade" value={form.grade} onChange={handleChange}>
                      <option value="">Select...</option>
                      {GRADE_OPTIONS.map(g => (
                        <option key={g.value} value={g.value}>{g.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Current Market Price (USD) *
                    {isHighValue && (
                      <span className="ml-2 text-yellow-400 inline-flex items-center gap-1">
                        <Star size={14} /> High Value
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    name="current_market_price"
                    value={form.current_market_price}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    placeholder="Enter current market price"
                  />
                  {form.current_market_price && (
                    <p className="text-gray-500 text-xs mt-1">
                      Auto-sorted into: <span className="text-purple-400 font-medium">{getPriceBucket(parseFloat(form.current_market_price))}</span> bucket
                    </p>
                  )}
                </div>

                {form.card_name && form.grading_company && (
                  <div className="mt-4 p-3 bg-vault-dark rounded-lg border border-vault-border">
                    <p className="text-gray-400 text-xs mb-1">Preview:</p>
                    <p className="text-white font-medium flex items-center gap-2">
                      {isHighValue && <Star size={14} className="text-yellow-400" />}
                      {form.card_name} <span className="text-purple-400">{form.grading_company} {form.grade}</span>
                      {form.current_market_price && <span className="text-vault-gold">${parseFloat(form.current_market_price).toLocaleString()}</span>}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Product dropdown - only show for non-slabs */}
            {!isSlab && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Product *</label>
                <select
                  name="product_id"
                  value={form.product_id}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select product...</option>
                  {filteredProducts
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(product => (
                    <option key={product.id} value={product.id}>
                      {product.brand} - {product.type} - {product.name} - {product.category} ({product.language})
                    </option>
                  ))}
                </select>
              </div>
            )}
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

          {/* High Value Notice */}
          {isSlab && isHighValue && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-2">
              <Star className="text-yellow-400 flex-shrink-0 mt-0.5" size={16} />
              <div>
                <p className="text-yellow-400 text-sm font-medium">High Value Item</p>
                <p className="text-yellow-400/70 text-xs">
                  This item will also be tracked in High Value Tracking for detailed P/L monitoring.
                </p>
              </div>
            </div>
          )}

          <div className="mt-6">
            <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
              {submitting ? (
                <div className="spinner w-5 h-5 border-2"></div>
              ) : (
                <>
                  <Save size={20} />
                  Add Inventory
                  {isSlab && isHighValue && <Star size={16} className="ml-1" />}
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

            {/* Search Bar */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search products..."
                  className="pl-10 w-full"
                />
              </div>
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
                      <select
                        value={item.product_id}
                        onChange={(e) => updateBulkItem(item.id, 'product_id', e.target.value)}
                        className="w-full text-sm"
                      >
                        <option value="">Select product...</option>
                        {filteredProducts
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map(product => (
                          <option key={product.id} value={product.id}>
                            {product.brand} - {product.name} ({product.language})
                          </option>
                        ))}
                      </select>
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
