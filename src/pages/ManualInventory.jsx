import React, { useState, useEffect } from 'react'

import { 
  fetchProducts, 
  fetchLocations,
  updateInventory
} from '../lib/supabase'
import { ToastContainer, useToast } from '../components/Toast'
import { PackagePlus, Save } from 'lucide-react'

export default function ManualInventory() {
  
  const { toasts, addToast, removeToast } = useToast()
  
  const [products, setProducts] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    product_id: '',
    location_id: '',
    quantity: '',
    avg_cost_basis: ''
  })

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

  const filteredProducts = products.filter(p => {
    if (productFilters.brand && p.brand !== productFilters.brand) return false
    if (productFilters.type && p.type !== productFilters.type) return false
    if (productFilters.language && p.language !== productFilters.language) return false
    return true
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!form.product_id) {
      addToast('Please select a product', 'error')
      return
    }
    if (!form.location_id) {
      addToast('Please select a location', 'error')
      return
    }
    if (!form.quantity || parseInt(form.quantity) <= 0) {
      addToast('Please enter a valid quantity', 'error')
      return
    }

    setSubmitting(true)

    try {
      const qty = parseInt(form.quantity)
      const avgCost = form.avg_cost_basis ? parseFloat(form.avg_cost_basis) : 0
      
      await updateInventory(
        form.product_id,
        form.location_id,
        qty,
        avgCost
      )

      addToast(`Added ${qty} items to inventory!`)
      
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
          <PackagePlus className="text-emerald-400" />
          Manual Inventory Addition
        </h1>
        <p className="text-gray-400 mt-1">Add existing inventory directly (bypasses purchase flow)</p>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6 max-w-2xl">
        <p className="text-yellow-400 text-sm">
          <strong>Use this for:</strong> Adding inventory you already have on hand that wasn't tracked through the purchase system (e.g., initial inventory setup).
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card max-w-2xl">
        {/* Location */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Location *
          </label>
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
          
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Brand</label>
              <select name="brand" value={productFilters.brand} onChange={handleFilterChange}>
                <option value="">All Brands</option>
                <option value="Pokemon">Pokemon</option>
                <option value="One Piece">One Piece</option>
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

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Product *
            </label>
            <select
              name="product_id"
              value={form.product_id}
              onChange={handleChange}
              required
            >
              <option value="">Select product...</option>
              {filteredProducts.map(product => (
                <option key={product.id} value={product.id}>
                  {product.brand} - {product.type} - {product.name} ({product.language})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quantity and Cost */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Quantity *
            </label>
            <input
              type="number"
              name="quantity"
              value={form.quantity}
              onChange={handleChange}
              min="1"
              placeholder="e.g., 50"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Avg Cost Per Unit (USD) (optional)
            </label>
            <input
              type="number"
              name="avg_cost_basis"
              value={form.avg_cost_basis}
              onChange={handleChange}
              min="0"
              step="0.01"
              placeholder="0.00"
            />
            <p className="text-gray-500 text-xs mt-1">Leave blank if unknown</p>
          </div>
        </div>

        <div className="mt-6">
          <button 
            type="submit" 
            className="btn btn-primary w-full"
            disabled={submitting}
          >
            {submitting ? (
              <div className="spinner w-5 h-5 border-2"></div>
            ) : (
              <>
                <Save size={20} />
                Add to Inventory
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
