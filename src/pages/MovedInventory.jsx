import React, { useState, useEffect } from 'react'
import { 
  fetchProducts,
  fetchLocations,
  fetchInventory,
  createMovement,
  updateInventory
} from '../lib/supabase'
import { ToastContainer, useToast } from '../components/Toast'
import { ArrowRightLeft, ArrowRight, Save } from 'lucide-react'

// Only show these locations in the Move Inventory page
const ALLOWED_LOCATION_NAMES = [
  'Master Inventory',
  'Stream Room 1',
  'Stream Room 2',
  'Stream Room 3',
  'Stream Room 4',
  'Stream Room 5',
  'Front Store',
  'Slab Room',
  'Office Safe',
  'Other/Out'
]

export default function MovedInventory() {
  const { toasts, addToast, removeToast } = useToast()
  
  const [locations, setLocations] = useState([])
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    from_location_id: '',
    to_location_id: '',
    product_id: '',
    quantity: 1,
    notes: ''
  })

  const [productFilters, setProductFilters] = useState({
    brand: '',
    type: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (form.from_location_id) {
      loadInventoryForLocation(form.from_location_id)
    }
  }, [form.from_location_id])

  const loadData = async () => {
    try {
      const locData = await fetchLocations()
      setLocations(locData)
    } catch (error) {
      console.error('Error loading data:', error)
      addToast('Failed to load data', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadInventoryForLocation = async (locationId) => {
    try {
      const invData = await fetchInventory(locationId)
      setInventory(invData)
    } catch (error) {
      console.error('Error loading inventory:', error)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    
    if (name === 'from_location_id') {
      setForm(f => ({ ...f, product_id: '', quantity: 1 }))
    }
  }

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setProductFilters(f => ({ ...f, [name]: value }))
    setForm(f => ({ ...f, product_id: '' }))
  }

  const filteredInventory = inventory.filter(inv => {
    if (productFilters.brand && inv.product?.brand !== productFilters.brand) return false
    if (productFilters.type && inv.product?.type !== productFilters.type) return false
    return true
  })

  const selectedInventory = inventory.find(inv => inv.product_id === form.product_id)
  const maxQuantity = selectedInventory?.quantity || 0

  // Filter to only allowed locations
  const allowedLocations = locations.filter(l => ALLOWED_LOCATION_NAMES.includes(l.name))
  const physicalLocations = allowedLocations.filter(l => l.type === 'Physical')
  const allDestinations = allowedLocations.filter(l => l.id !== form.from_location_id)

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!form.from_location_id || !form.to_location_id || !form.product_id) {
      addToast('Please fill all required fields', 'error')
      return
    }
    
    if (form.quantity > maxQuantity) {
      addToast(`Only ${maxQuantity} available`, 'error')
      return
    }

    setSubmitting(true)

    try {
      const qty = parseInt(form.quantity)
      const costBasis = selectedInventory?.avg_cost_basis * qty

      // Create movement record
      await createMovement({
        date: form.date,
        product_id: form.product_id,
        from_location_id: form.from_location_id,
        to_location_id: form.to_location_id,
        quantity: qty,
        cost_basis: costBasis,
        movement_type: 'Transfer',
        notes: form.notes
      })

      // Update inventory - subtract from source
      await updateInventory(
        form.product_id,
        form.from_location_id,
        -qty
      )

      // Update inventory - add to destination
      await updateInventory(
        form.product_id,
        form.to_location_id,
        qty,
        selectedInventory?.avg_cost_basis
      )

      addToast('Inventory moved successfully!')
      
      // Reset form
      setForm(f => ({
        ...f,
        product_id: '',
        quantity: 1,
        notes: ''
      }))
      
      // Reload inventory
      loadInventoryForLocation(form.from_location_id)
    } catch (error) {
      console.error('Error moving inventory:', error)
      addToast('Failed to move inventory', 'error')
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
      
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-white flex items-center gap-3">
          <ArrowRightLeft className="text-orange-400" />
          Move Inventory
        </h1>
        <p className="text-gray-400 mt-1">Transfer inventory between locations</p>
      </div>

      <form onSubmit={handleSubmit} className="card max-w-2xl">
        {/* Date */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Date *
          </label>
          <input
            type="date"
            name="date"
            value={form.date}
            onChange={handleChange}
            required
          />
        </div>

        {/* Location Transfer */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end mb-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              From Location *
            </label>
            <select
              name="from_location_id"
              value={form.from_location_id}
              onChange={handleChange}
              required
            >
              <option value="">Select source...</option>
              {physicalLocations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-center">
            <ArrowRight className="text-vault-gold" size={24} />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              To Location *
            </label>
            <select
              name="to_location_id"
              value={form.to_location_id}
              onChange={handleChange}
              required
            >
              <option value="">Select destination...</option>
              {allDestinations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Product Selection */}
        {form.from_location_id && (
          <div className="pt-6 border-t border-vault-border">
            <h3 className="font-display text-lg font-semibold text-white mb-4">Select Product</h3>
            
            {/* Filters */}
            <div className="grid grid-cols-2 gap-4 mb-4">
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
            </div>

            {/* Product Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Product * (showing items in stock)
              </label>
              <select
                name="product_id"
                value={form.product_id}
                onChange={handleChange}
                required
              >
                <option value="">Select product...</option>
                {filteredInventory
                  .sort((a, b) => (a.product?.name || '').localeCompare(b.product?.name || ''))
                  .map(inv => (
                  <option key={inv.id} value={inv.product_id}>
                    {inv.product?.brand} - {inv.product?.type} - {inv.product?.name} - {inv.product?.category} ({inv.product?.language}) - {inv.quantity} avail
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity */}
            {form.product_id && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Quantity * (max: {maxQuantity})
                </label>
                <input
                  type="number"
                  name="quantity"
                  value={form.quantity}
                  onChange={handleChange}
                  min="1"
                  max={maxQuantity}
                  required
                />
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Notes
          </label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={2}
            placeholder="Optional notes..."
          />
        </div>

        {/* Submit */}
        <div className="mt-6">
          <button 
            type="submit" 
            className="btn btn-primary w-full"
            disabled={submitting || !form.product_id}
          >
            {submitting ? (
              <div className="spinner w-5 h-5 border-2"></div>
            ) : (
              <>
                <Save size={20} />
                Move Inventory
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
