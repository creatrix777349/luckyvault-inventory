import React, { useState, useEffect } from 'react'

import { 
  fetchProducts, 
  fetchLocations,
  updateInventoryManual,
  supabase
} from '../lib/supabase'
import { ToastContainer, useToast } from '../components/Toast'
import { PackagePlus, Save, Star, AlertCircle } from 'lucide-react'

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

export default function ManualInventory() {
  
  const { toasts, addToast, removeToast } = useToast()
  
  const [products, setProducts] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    product_id: '',
    location_id: '',
    quantity: '1',
    avg_cost_basis: '',
    // Slab-specific fields
    grading_company: '',
    grade: '',
    current_market_price: '',
    card_name: '' // For custom slab name
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
    setProductFilters(f => {
      const updated = { ...f, [name]: value }
      // Reset dependent filters when parent changes
      if (name === 'brand') {
        updated.type = ''
        updated.language = ''
      }
      if (name === 'type') {
        updated.language = ''
      }
      return updated
    })
    // Reset form fields that depend on filters
    setForm(f => ({ 
      ...f, 
      product_id: '',
      grading_company: '',
      grade: '',
      current_market_price: '',
      card_name: ''
    }))
  }

  // Check if we should show slab-specific fields (Slab type selected)
  const isSlab = productFilters.type === 'Slab'
  
  // Check if current market price indicates high value ($200+)
  const currentMarketPriceNum = form.current_market_price ? parseFloat(form.current_market_price) : 0
  const isHighValue = currentMarketPriceNum >= 200

  const filteredProducts = products.filter(p => {
    if (productFilters.brand && p.brand !== productFilters.brand) return false
    if (productFilters.type && p.type !== productFilters.type) return false
    if (productFilters.language && p.language !== productFilters.language) return false
    return true
  })

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

    // Validate grading company for slabs
    if (isSlab && !form.grading_company) {
      addToast('Please select a grading company for slabs', 'error')
      return
    }

    setSubmitting(true)

    try {
      // Parse values - treat empty strings as null, not 0
      const quantity = parseInt(form.quantity)
      const avgCostBasis = form.avg_cost_basis !== '' ? parseFloat(form.avg_cost_basis) : null
      const currentMarketPrice = form.current_market_price !== '' ? parseFloat(form.current_market_price) : null
      
      const selectedProduct = products.find(p => p.id === form.product_id)
      
      // Use the new function that handles null cost basis properly
      await updateInventoryManual(
        form.product_id,
        form.location_id,
        quantity,
        avgCostBasis,
        {
          grading_company: isSlab ? form.grading_company : null,
          grade: isSlab ? form.grade : null,
          current_market_price: currentMarketPrice,
          is_high_value: isHighValue
        }
      )

      // If it's high value ($200+) slab, also create an entry in high_value_items for detailed tracking
      if (isHighValue && isSlab) {
        await supabase.from('high_value_items').insert({
          card_name: form.card_name || selectedProduct?.name || 'Unknown Slab',
          brand: selectedProduct?.brand || productFilters.brand,
          item_type: 'Slab',
          grading_company: form.grading_company,
          grade: form.grade,
          purchase_price: avgCostBasis,
          purchase_price_usd: avgCostBasis,
          currency: 'USD',
          current_market_price: currentMarketPrice,
          location_id: form.location_id,
          status: 'In Inventory',
          date_added: new Date().toISOString().split('T')[0],
          source: 'manual_inventory'
        })
      }

      addToast(`Inventory added successfully!${isHighValue ? ' ⭐ High Value item tracked' : ''}`)
      
      setForm(f => ({
        ...f,
        product_id: '',
        quantity: '1',
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
        <p className="text-gray-400 mt-1">Manually add inventory to any location</p>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6 max-w-2xl">
        <p className="text-yellow-400 text-sm">
          <strong>Use this for:</strong> Adding inventory you already have on hand that wasn't tracked through the purchase system (e.g., initial inventory setup, found items).
        </p>
        <p className="text-yellow-400/70 text-xs mt-2">
          💡 Leave "Purchase Price" blank if unknown - it won't affect your cost averages.
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

          {/* Slab-specific fields - Grading Company & Grade */}
          {isSlab && (
            <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Grading Company *
                </label>
                <select
                  name="grading_company"
                  value={form.grading_company}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select grading company...</option>
                  <option value="PSA">PSA</option>
                  <option value="CGC">CGC</option>
                  <option value="Beckett">Beckett</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Grade
                </label>
                <select
                  name="grade"
                  value={form.grade}
                  onChange={handleChange}
                >
                  <option value="">Select grade...</option>
                  {GRADE_OPTIONS.map(g => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Card Name (for tracking)
                </label>
                <input
                  type="text"
                  name="card_name"
                  value={form.card_name}
                  onChange={handleChange}
                  placeholder="e.g., Charizard VMAX Alt Art"
                />
              </div>
            </div>
          )}

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
              {filteredProducts
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(product => (
                <option key={product.id} value={product.id}>
                  {product.brand} - {product.type} - {product.name} - {product.category} ({product.language})
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
            <p className="text-gray-500 text-xs mt-1">
              Won't affect cost averages if left blank
            </p>
          </div>
        </div>

        {/* Current Market Price - for slabs (optional) */}
        {isSlab && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Current Market Price (USD)
              <span className="text-gray-500 font-normal ml-1">- optional</span>
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
            {isHighValue && (
              <p className="text-yellow-400 text-xs mt-1 flex items-center gap-1">
                <Star size={12} />
                Items $200+ are marked as High Value and will display with a star
              </p>
            )}
          </div>
        )}

        {/* High Value Preview */}
        {isHighValue && isSlab && (
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-2">
            <Star className="text-yellow-400 flex-shrink-0 mt-0.5" size={16} />
            <div>
              <p className="text-yellow-400 text-sm font-medium">High Value Item</p>
              <p className="text-yellow-400/70 text-xs">
                This item will be tracked in both regular inventory and High Value Tracking for detailed P/L monitoring.
              </p>
            </div>
          </div>
        )}

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
                Add Inventory
                {isHighValue && <Star size={16} className="ml-1" />}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
