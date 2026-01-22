import React, { useState, useEffect } from 'react'

import { 
  fetchProducts, 
  fetchLocations,
  updateInventoryManual,
  supabase
} from '../lib/supabase'
import { ToastContainer, useToast } from '../components/Toast'
import { PackagePlus, Save, Star } from 'lucide-react'

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

  const [form, setForm] = useState({
    product_id: '',
    location_id: '',
    quantity: '1',
    avg_cost_basis: '',
    // Slab-specific fields
    grading_company: '',
    grade: '',
    current_market_price: '',
    card_name: ''
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
    // Reset form fields
    setForm(f => ({ 
      ...f, 
      product_id: '',
      grading_company: '',
      grade: '',
      current_market_price: '',
      card_name: ''
    }))
  }

  // Check if we're adding a slab
  const isSlab = productFilters.type === 'Slab'
  
  // Check if current market price indicates high value ($200+)
  const currentMarketPriceNum = form.current_market_price ? parseFloat(form.current_market_price) : 0
  const isHighValue = currentMarketPriceNum >= 200

  // For non-slabs, filter products normally
  const filteredProducts = products.filter(p => {
    if (productFilters.brand && p.brand !== productFilters.brand) return false
    if (productFilters.type && p.type !== productFilters.type) return false
    if (productFilters.language && p.language !== productFilters.language) return false
    return true
  })

  // Find the correct slab product based on grading company and price
  const findSlabProduct = (brand, language, gradingCompany, price) => {
    const priceBucket = getPriceBucket(price)
    
    // Look for product matching: brand, type=Slab, language, category=gradingCompany
    // Product name format should include the price bucket
    const matchingProduct = products.find(p => 
      p.brand === brand &&
      p.type === 'Slab' &&
      p.language === language &&
      p.category === gradingCompany &&
      p.name.includes(priceBucket)
    )
    
    return matchingProduct
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validation for slabs
    if (isSlab) {
      if (!productFilters.brand || !productFilters.language) {
        addToast('Please select brand and language', 'error')
        return
      }
      if (!form.grading_company) {
        addToast('Please select a grading company', 'error')
        return
      }
      if (!form.card_name.trim()) {
        addToast('Please enter the card name', 'error')
        return
      }
      if (!form.current_market_price) {
        addToast('Please enter the current market price', 'error')
        return
      }
    } else {
      // Validation for non-slabs
      if (!form.product_id || !form.location_id) {
        addToast('Please select product and location', 'error')
        return
      }
    }

    if (!form.quantity || parseInt(form.quantity) <= 0) {
      addToast('Please enter a valid quantity', 'error')
      return
    }

    if (!form.location_id) {
      addToast('Please select a location', 'error')
      return
    }

    setSubmitting(true)

    try {
      const quantity = parseInt(form.quantity)
      const avgCostBasis = form.avg_cost_basis !== '' ? parseFloat(form.avg_cost_basis) : null
      const currentMarketPrice = form.current_market_price !== '' ? parseFloat(form.current_market_price) : null
      
      if (isSlab) {
        // For slabs: find or identify the correct product bucket
        const slabProduct = findSlabProduct(
          productFilters.brand,
          productFilters.language,
          form.grading_company,
          currentMarketPrice || 0
        )
        
        if (!slabProduct) {
          // Product doesn't exist - create a descriptive error
          const priceBucket = getPriceBucket(currentMarketPrice || 0)
          addToast(`No slab product found for ${productFilters.brand} ${form.grading_company} ${priceBucket} (${productFilters.language}). Please add it in Add Product first.`, 'error')
          setSubmitting(false)
          return
        }

        // Add to inventory with slab metadata
        await updateInventoryManual(
          slabProduct.id,
          form.location_id,
          quantity,
          avgCostBasis,
          {
            grading_company: form.grading_company,
            grade: form.grade,
            current_market_price: currentMarketPrice,
            is_high_value: isHighValue
          }
        )

        // If high value ($200+), also add to high_value_items for detailed tracking
        if (isHighValue) {
          await supabase.from('high_value_items').insert({
            card_name: form.card_name.trim(),
            brand: productFilters.brand,
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

        addToast(`Added: ${form.card_name} ${form.grading_company} ${form.grade}${isHighValue ? ' ⭐ High Value' : ''}`)
        
      } else {
        // For non-slabs: use selected product
        await updateInventoryManual(
          form.product_id,
          form.location_id,
          quantity,
          avgCostBasis,
          {}
        )
        
        const selectedProduct = products.find(p => p.id === form.product_id)
        addToast(`Added: ${selectedProduct?.name || 'Product'}`)
      }
      
      // Reset form
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
              <label className="block text-sm font-medium text-gray-300 mb-2">Brand *</label>
              <select name="brand" value={productFilters.brand} onChange={handleFilterChange} required>
                <option value="">Select Brand</option>
                <option value="Pokemon">Pokemon</option>
                <option value="One Piece">One Piece</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Type *</label>
              <select name="type" value={productFilters.type} onChange={handleFilterChange} required>
                <option value="">Select Type</option>
                <option value="Sealed">Sealed</option>
                <option value="Pack">Pack</option>
                <option value="Single">Single</option>
                <option value="Slab">Slab</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Language *</label>
              <select name="language" value={productFilters.language} onChange={handleFilterChange} required>
                <option value="">Select Language</option>
                <option value="EN">English</option>
                <option value="JP">Japanese</option>
                <option value="CN">Chinese</option>
              </select>
            </div>
          </div>

          {/* SLAB ENTRY - Simplified like High Value form */}
          {isSlab && productFilters.brand && productFilters.language && (
            <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg mb-4">
              {/* Card Name */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Card Name *
                </label>
                <input
                  type="text"
                  name="card_name"
                  value={form.card_name}
                  onChange={handleChange}
                  placeholder="e.g., Charizard VMAX Alt Art"
                  required
                />
              </div>

              {/* Grading Company & Grade */}
              <div className="grid grid-cols-2 gap-4 mb-4">
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
                    <option value="">Select...</option>
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
                    <option value="">Select...</option>
                    {GRADE_OPTIONS.map(g => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Current Market Price */}
              <div className="mb-4">
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
                  required
                />
                {form.current_market_price && (
                  <p className="text-gray-500 text-xs mt-1">
                    Will be sorted into: <span className="text-purple-400 font-medium">{getPriceBucket(parseFloat(form.current_market_price))}</span> bucket
                  </p>
                )}
              </div>

              {/* Preview */}
              {form.card_name && form.grading_company && (
                <div className="p-3 bg-vault-dark rounded-lg border border-vault-border">
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

          {/* NON-SLAB: Show product dropdown */}
          {!isSlab && productFilters.brand && productFilters.type && productFilters.language && (
            <div className="mb-4">
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
                    {product.name} - {product.category}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Quantity and Cost - show when we have enough info */}
        {((isSlab && productFilters.brand && productFilters.language) || (!isSlab && form.product_id)) && (
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
        )}

        {/* High Value Notice */}
        {isHighValue && isSlab && (
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
