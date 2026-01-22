import React, { useState, useEffect } from 'react'
import { 
  fetchProducts,
  fetchLocations,
  fetchInventory,
  createStorefrontSale,
  updateInventory
} from '../lib/supabase'
import { ToastContainer, useToast } from '../components/Toast'
import { DollarSign, Save } from 'lucide-react'

export default function StorefrontSale() {
  const { toasts, addToast, removeToast } = useToast()
  
  const [products, setProducts] = useState([])
  const [storefrontLocation, setStorefrontLocation] = useState(null)
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [saleType, setSaleType] = useState('Bulk')

  const [bulkForm, setBulkForm] = useState({
    date: new Date().toISOString().split('T')[0],
    brand: 'Pokemon',
    product_type: 'Single',
    quantity: 1,
    sale_price: ''
  })

  const [itemizedForm, setItemizedForm] = useState({
    date: new Date().toISOString().split('T')[0],
    product_id: '',
    quantity: 1,
    sale_price: '',
    notes: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [productsData, locData] = await Promise.all([
        fetchProducts(),
        fetchLocations('Physical')
      ])
      setProducts(productsData)
      
      const storefront = locData.find(l => l.name === 'Front Store')
      setStorefrontLocation(storefront)
      
      if (storefront) {
        const invData = await fetchInventory(storefront.id)
        setInventory(invData)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      addToast('Failed to load data', 'error')
    } finally {
      setLoading(false)
    }
  }

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
        created_by: profile?.id
      })

      addToast('Bulk sale logged successfully!')
      
      setBulkForm(f => ({
        ...f,
        quantity: 1,
        sale_price: ''
      }))
    } catch (error) {
      console.error('Error logging sale:', error)
      addToast('Failed to log sale', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleItemizedSubmit = async (e) => {
    e.preventDefault()
    
    if (!itemizedForm.product_id) {
      addToast('Please select a product', 'error')
      return
    }
    
    if (!itemizedForm.sale_price || parseFloat(itemizedForm.sale_price) <= 0) {
      addToast('Please enter a valid sale price', 'error')
      return
    }

    const selectedInventory = inventory.find(inv => inv.product_id === itemizedForm.product_id)
    if (!selectedInventory || selectedInventory.quantity < parseInt(itemizedForm.quantity)) {
      addToast('Not enough inventory', 'error')
      return
    }

    setSubmitting(true)

    try {
      const qty = parseInt(itemizedForm.quantity)
      const salePrice = parseFloat(itemizedForm.sale_price)
      const costBasis = selectedInventory.avg_cost_basis * qty
      const profit = salePrice - costBasis

      await createStorefrontSale({
        date: itemizedForm.date,
        sale_type: 'Itemized',
        product_id: itemizedForm.product_id,
        quantity: qty,
        sale_price: salePrice,
        cost_basis: costBasis,
        profit: profit,
        notes: itemizedForm.notes,
        created_by: profile?.id
      })

      // Update inventory
      if (storefrontLocation) {
        await updateInventory(
          itemizedForm.product_id,
          storefrontLocation.id,
          -qty
        )
      }

      addToast(`Sale logged! Profit: $${profit.toFixed(2)}`)
      
      setItemizedForm(f => ({
        ...f,
        product_id: '',
        quantity: 1,
        sale_price: '',
        notes: ''
      }))
      
      // Reload inventory
      if (storefrontLocation) {
        const invData = await fetchInventory(storefrontLocation.id)
        setInventory(invData)
      }
    } catch (error) {
      console.error('Error logging sale:', error)
      addToast('Failed to log sale', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedInventory = inventory.find(inv => inv.product_id === itemizedForm.product_id)
  const estimatedProfit = itemizedForm.sale_price && selectedInventory
    ? parseFloat(itemizedForm.sale_price) - (selectedInventory.avg_cost_basis * parseInt(itemizedForm.quantity || 0))
    : null

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
          onClick={() => setSaleType('Itemized')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            saleType === 'Itemized'
              ? 'bg-vault-gold text-vault-dark'
              : 'bg-vault-surface text-gray-400 hover:text-white'
          }`}
        >
          Itemized ($100+ singles, $400+ slabs)
        </button>
      </div>

      {saleType === 'Bulk' ? (
        <form onSubmit={handleBulkSubmit} className="card max-w-xl">
          <p className="text-gray-400 text-sm mb-4">
            For quick bulk sales - no cost basis tracking
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

          <button 
            type="submit" 
            className="btn btn-primary w-full mt-6"
            disabled={submitting}
          >
            {submitting ? <div className="spinner w-5 h-5 border-2"></div> : <><Save size={20} /> Log Bulk Sale</>}
          </button>
        </form>
      ) : (
        <form onSubmit={handleItemizedSubmit} className="card max-w-xl">
          <p className="text-gray-400 text-sm mb-4">
            For high-value items - tracks cost basis and profit
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">Date *</label>
              <input
                type="date"
                value={itemizedForm.date}
                onChange={(e) => setItemizedForm(f => ({ ...f, date: e.target.value }))}
                required
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">Product * (from storefront inventory)</label>
              <select
                value={itemizedForm.product_id}
                onChange={(e) => setItemizedForm(f => ({ ...f, product_id: e.target.value }))}
                required
              >
                <option value="">Select product...</option>
                {inventory
                  .sort((a, b) => (a.product?.name || '').localeCompare(b.product?.name || ''))
                  .map(inv => (
                  <option key={inv.id} value={inv.product_id}>
                    {inv.product?.brand} - {inv.product?.type} - {inv.product?.name} - {inv.product?.category} ({inv.product?.language}) - {inv.quantity} avail
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Quantity *</label>
              <input
                type="number"
                value={itemizedForm.quantity}
                onChange={(e) => setItemizedForm(f => ({ ...f, quantity: e.target.value }))}
                min="1"
                max={selectedInventory?.quantity || 1}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Sale Price ($) *</label>
              <input
                type="number"
                value={itemizedForm.sale_price}
                onChange={(e) => setItemizedForm(f => ({ ...f, sale_price: e.target.value }))}
                min="0"
                step="0.01"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {estimatedProfit !== null && (
            <div className={`mt-4 p-3 rounded-lg ${estimatedProfit >= 0 ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
              <div className="flex justify-between">
                <span className="text-gray-300">Estimated Profit:</span>
                <span className={`font-bold ${estimatedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${estimatedProfit.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">Notes</label>
            <textarea
              value={itemizedForm.notes}
              onChange={(e) => setItemizedForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Optional notes..."
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary w-full mt-6"
            disabled={submitting || !itemizedForm.product_id}
          >
            {submitting ? <div className="spinner w-5 h-5 border-2"></div> : <><Save size={20} /> Log Itemized Sale</>}
          </button>
        </form>
      )}
    </div>
  )
}
