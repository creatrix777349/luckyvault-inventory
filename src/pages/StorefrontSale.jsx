import React, { useState, useEffect } from 'react'
import { 
  fetchProducts,
  fetchLocations,
  fetchInventory,
  createStorefrontSale,
  supabase
} from '../lib/supabase'
import { ToastContainer, useToast } from '../components/Toast'
import { DollarSign, Save, TrendingUp, TrendingDown } from 'lucide-react'

export default function StorefrontSale() {
  const { toasts, addToast, removeToast } = useToast()
  
  const [products, setProducts] = useState([])
  const [locations, setLocations] = useState([])
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [saleType, setSaleType] = useState('Bulk')

  // Bulk sale form
  const [bulkForm, setBulkForm] = useState({
    date: new Date().toISOString().split('T')[0],
    brand: 'Pokemon',
    product_type: 'Single',
    quantity: 1,
    sale_price: '',
    notes: ''
  })

  // Product sale form - similar to ManualInventory
  const [productForm, setProductForm] = useState({
    date: new Date().toISOString().split('T')[0],
    location_id: '',
    product_id: '',
    quantity: 1,
    sale_price: '',
    notes: ''
  })

  const [productFilters, setProductFilters] = useState({
    brand: '',
    type: '',
    language: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  // Load inventory when location changes
  useEffect(() => {
    if (productForm.location_id) {
      loadLocationInventory(productForm.location_id)
    }
  }, [productForm.location_id])

  const loadData = async () => {
    try {
      const [productsData, locData] = await Promise.all([
        fetchProducts(),
        fetchLocations('Physical')
      ])
      setProducts(productsData)
      setLocations(locData)
      
      // Default to Front Store if exists
      const frontStore = locData.find(l => l.name === 'Front Store')
      if (frontStore) {
        setProductForm(f => ({ ...f, location_id: frontStore.id }))
      }
    } catch (error) {
      console.error('Error loading data:', error)
      addToast('Failed to load data', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadLocationInventory = async (locationId) => {
    try {
      const invData = await fetchInventory(locationId)
      setInventory(invData)
    } catch (error) {
      console.error('Error loading inventory:', error)
    }
  }

  const handleProductFormChange = (e) => {
    const { name, value } = e.target
    setProductForm(f => ({ ...f, [name]: value }))
  }

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setProductFilters(f => ({ ...f, [name]: value }))
    setProductForm(f => ({ ...f, product_id: '' }))
  }

  // Filter inventory based on product filters
  const filteredInventory = inventory.filter(inv => {
    if (!inv.product) return false
    if (productFilters.brand && inv.product.brand !== productFilters.brand) return false
    if (productFilters.type && inv.product.type !== productFilters.type) return false
    if (productFilters.language && inv.product.language !== productFilters.language) return false
    return inv.quantity > 0 // Only show items with stock
  })

  // Get selected inventory item
  const selectedInventory = inventory.find(inv => inv.product_id === productForm.product_id)
  
  // Calculate profit
  const estimatedProfit = productForm.sale_price && selectedInventory
    ? parseFloat(productForm.sale_price) - (selectedInventory.avg_cost_basis * parseInt(productForm.quantity || 0))
    : null

  const handleBulkSubmit = async (e) => {
    e.preventDefault()
    
    if (!bulkForm.sale_price || parseFloat(bulkForm.sale_price) <= 0) {
      addToast('Please enter a valid sale price', 'error')
      return
    }

    setSubmitting(true)

    try {
      await createStorefrontSale({
        date: bulkForm.date,
        sale_type: 'Bulk',
        brand: bulkForm.brand,
        product_type: bulkForm.product_type,
        quantity: parseInt(bulkForm.quantity),
        sale_price: parseFloat(bulkForm.sale_price),
        notes: bulkForm.notes || null,
        created_by: null
      })

      addToast('Bulk sale logged successfully!')
      
      setBulkForm(f => ({
        ...f,
        quantity: 1,
        sale_price: '',
        notes: ''
      }))
    } catch (error) {
      console.error('Error logging sale:', error)
      addToast('Failed to log sale', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleProductSubmit = async (e) => {
    e.preventDefault()
    
    if (!productForm.product_id) {
      addToast('Please select a product', 'error')
      return
    }
    
    if (!productForm.sale_price || parseFloat(productForm.sale_price) <= 0) {
      addToast('Please enter a valid sale price', 'error')
      return
    }

    const qty = parseInt(productForm.quantity)
    
    if (!selectedInventory || selectedInventory.quantity < qty) {
      addToast('Not enough inventory', 'error')
      return
    }

    setSubmitting(true)

    try {
      const salePrice = parseFloat(productForm.sale_price)
      const costBasis = (selectedInventory.avg_cost_basis || 0) * qty
      const profit = salePrice - costBasis

      // Log the sale
      await createStorefrontSale({
        date: productForm.date,
        sale_type: 'Product',
        product_id: productForm.product_id,
        location_id: productForm.location_id,
        quantity: qty,
        sale_price: salePrice,
        cost_basis: costBasis,
        profit: profit,
        notes: productForm.notes,
        created_by: null
      })

      // Subtract from inventory
      const newQuantity = selectedInventory.quantity - qty
      
      if (newQuantity <= 0) {
        // Delete inventory record if quantity is 0
        await supabase
          .from('inventory')
          .delete()
          .eq('id', selectedInventory.id)
      } else {
        // Update quantity
        await supabase
          .from('inventory')
          .update({ quantity: newQuantity })
          .eq('id', selectedInventory.id)
      }

      const profitText = profit >= 0 ? `+$${profit.toFixed(2)}` : `-$${Math.abs(profit).toFixed(2)}`
      addToast(`Sale logged! Profit: ${profitText}`)
      
      // Reset form
      setProductForm(f => ({
        ...f,
        product_id: '',
        quantity: 1,
        sale_price: '',
        notes: ''
      }))
      
      // Reload inventory
      loadLocationInventory(productForm.location_id)
    } catch (error) {
      console.error('Error logging sale:', error)
      addToast('Failed to log sale', 'error')
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
          <DollarSign className="text-green-400" />
          Storefront Sale
        </h1>
        <p className="text-gray-400 mt-1">Log sales from the retail storefront</p>
      </div>

      {/* Sale Type Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setSaleType('Bulk')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            saleType === 'Bulk'
              ? 'bg-vault-gold text-vault-dark'
              : 'bg-vault-surface text-gray-400 hover:text-white'
          }`}
        >
          Bulk Sale
        </button>
        <button
          onClick={() => setSaleType('Product')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            saleType === 'Product'
              ? 'bg-vault-gold text-vault-dark'
              : 'bg-vault-surface text-gray-400 hover:text-white'
          }`}
        >
          Sealed & Product Sales
        </button>
      </div>

      {saleType === 'Bulk' ? (
        /* BULK SALE FORM */
        <form onSubmit={handleBulkSubmit} className="card max-w-xl">
          <p className="text-gray-400 text-sm mb-4">
            For quick bulk sales of unlisted items - no inventory tracking
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Date *</label>
              <input
                type="date"
                value={bulkForm.date}
                onChange={(e) => setBulkForm(f => ({ ...f, date: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Brand *</label>
              <select
                value={bulkForm.brand}
                onChange={(e) => setBulkForm(f => ({ ...f, brand: e.target.value }))}
                required
              >
                <option value="Pokemon">Pokemon</option>
                <option value="One Piece">One Piece</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Type *</label>
              <select
                value={bulkForm.product_type}
                onChange={(e) => setBulkForm(f => ({ ...f, product_type: e.target.value }))}
                required
              >
                <option value="Single">Single</option>
                <option value="Slab">Slab</option>
                <option value="Sealed">Sealed</option>
                <option value="Pack">Pack</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Quantity *</label>
              <input
                type="number"
                value={bulkForm.quantity}
                onChange={(e) => setBulkForm(f => ({ ...f, quantity: e.target.value }))}
                min="1"
                required
              />
            </div>
          </div>
          
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">Total Sale Price ($) *</label>
            <input
              type="number"
              value={bulkForm.sale_price}
              onChange={(e) => setBulkForm(f => ({ ...f, sale_price: e.target.value }))}
              min="0"
              step="0.01"
              placeholder="0.00"
              required
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">Notes</label>
            <textarea
              value={bulkForm.notes}
              onChange={(e) => setBulkForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Optional notes about this sale..."
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary w-full mt-6"
            disabled={submitting}
          >
            {submitting ? <div className="spinner w-5 h-5 border-2"></div> : <><Save size={20} /> Log Bulk Sale</>}
          </button>
        </form>
      ) : (
        /* PRODUCT SALE FORM - Similar to ManualInventory but subtracts */
        <form onSubmit={handleProductSubmit} className="card max-w-2xl">
          <p className="text-gray-400 text-sm mb-4">
            For tracked inventory items - subtracts from stock and calculates profit
          </p>
          
          {/* Date */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">Date *</label>
            <input
              type="date"
              name="date"
              value={productForm.date}
              onChange={handleProductFormChange}
              required
            />
          </div>

          {/* Location */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">Selling From *</label>
            <select
              name="location_id"
              value={productForm.location_id}
              onChange={handleProductFormChange}
              required
            >
              <option value="">Select location...</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>

          {/* Product Selection */}
          {productForm.location_id && (
            <div className="pt-4 border-t border-vault-border">
              <h3 className="font-display text-lg font-semibold text-white mb-4">Product Selection</h3>
              
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

              {/* Product Dropdown */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">Product *</label>
                <select
                  name="product_id"
                  value={productForm.product_id}
                  onChange={handleProductFormChange}
                  required
                >
                  <option value="">Select product...</option>
                  {filteredInventory
                    .sort((a, b) => (a.product?.name || '').localeCompare(b.product?.name || ''))
                    .map(inv => (
                    <option key={inv.id} value={inv.product_id}>
                      {inv.product?.brand} - {inv.product?.type} - {inv.product?.name} - {inv.product?.category} ({inv.product?.language}) - {inv.quantity} avail @ ${inv.avg_cost_basis?.toFixed(2) || '0.00'}/ea
                    </option>
                  ))}
                </select>
                {filteredInventory.length === 0 && (
                  <p className="text-yellow-400 text-xs mt-1">No inventory at this location matching filters</p>
                )}
              </div>

              {/* Quantity and Sale Price */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Quantity *</label>
                  <input
                    type="number"
                    name="quantity"
                    value={productForm.quantity}
                    onChange={handleProductFormChange}
                    min="1"
                    max={selectedInventory?.quantity || 1}
                    required
                  />
                  {selectedInventory && (
                    <p className="text-gray-500 text-xs mt-1">
                      {selectedInventory.quantity} available
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Sale Price ($) *</label>
                  <input
                    type="number"
                    name="sale_price"
                    value={productForm.sale_price}
                    onChange={handleProductFormChange}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              {/* Profit Preview */}
              {estimatedProfit !== null && (
                <div className={`mt-4 p-3 rounded-lg flex items-center justify-between ${
                  estimatedProfit >= 0 
                    ? 'bg-green-500/10 border border-green-500/30' 
                    : 'bg-red-500/10 border border-red-500/30'
                }`}>
                  <div className="flex items-center gap-2">
                    {estimatedProfit >= 0 ? (
                      <TrendingUp className="text-green-400" size={20} />
                    ) : (
                      <TrendingDown className="text-red-400" size={20} />
                    )}
                    <span className="text-gray-300">Estimated Profit:</span>
                  </div>
                  <span className={`font-bold text-lg ${estimatedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {estimatedProfit >= 0 ? '+' : '-'}${Math.abs(estimatedProfit).toFixed(2)}
                  </span>
                </div>
              )}

              {/* Notes */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">Notes</label>
                <textarea
                  name="notes"
                  value={productForm.notes}
                  onChange={handleProductFormChange}
                  rows={2}
                  placeholder="Optional notes..."
                />
              </div>
            </div>
          )}

          <button 
            type="submit" 
            className="btn btn-primary w-full mt-6"
            disabled={submitting || !productForm.product_id || !productForm.location_id}
          >
            {submitting ? <div className="spinner w-5 h-5 border-2"></div> : <><Save size={20} /> Log Sale</>}
          </button>
        </form>
      )}
    </div>
  )
}
