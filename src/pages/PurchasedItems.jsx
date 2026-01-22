import React, { useState, useEffect } from 'react'
import { 
  fetchProducts, 
  fetchUsers, 
  fetchVendors, 
  fetchPaymentMethods,
  createAcquisition,
  createVendor,
  convertToUSD,
  getExchangeRates
} from '../lib/supabase'
import { ToastContainer, useToast } from '../components/Toast'
import { ShoppingCart, Plus, Save, X } from 'lucide-react'

export default function PurchasedItems() {
  const { toasts, addToast, removeToast } = useToast()
  
  const [products, setProducts] = useState([])
  const [users, setUsers] = useState([])
  const [vendors, setVendors] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showNewVendor, setShowNewVendor] = useState(false)
  const [newVendorName, setNewVendorName] = useState('')
  const [newVendorCountry, setNewVendorCountry] = useState('USA')

  const [form, setForm] = useState({
    date_purchased: new Date().toISOString().split('T')[0],
    acquirer_id: '',
    source_country: 'USA',
    vendor_id: '',
    payment_method_id: '',
    product_id: '',
    quantity_purchased: 1,
    cost: '',
    currency: 'USD',
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

  const loadData = async () => {
    try {
      const [productsData, usersData, vendorsData, paymentMethodsData] = await Promise.all([
        fetchProducts(),
        fetchUsers(),
        fetchVendors(),
        fetchPaymentMethods()
      ])
      setProducts(productsData)
      setUsers(usersData)
      setVendors(vendorsData)
      setPaymentMethods(paymentMethodsData)
      
      // Default to first user if available
      if (usersData.length > 0) {
        setForm(f => ({ ...f, acquirer_id: usersData[0].id }))
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

  const handleAddVendor = async () => {
    if (!newVendorName.trim()) return
    
    try {
      const vendor = await createVendor({
        name: newVendorName.trim(),
        country: newVendorCountry || null
      })
      setVendors([...vendors, vendor])
      setForm(f => ({ ...f, vendor_id: vendor.id }))
      setShowNewVendor(false)
      setNewVendorName('')
      addToast('Vendor added successfully')
    } catch (error) {
      addToast('Failed to add vendor', 'error')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!form.product_id) {
      addToast('Please select a product', 'error')
      return
    }
    if (!form.acquirer_id) {
      addToast('Please select an acquirer', 'error')
      return
    }
    if (!form.cost || parseFloat(form.cost) <= 0) {
      addToast('Please enter a valid cost', 'error')
      return
    }

    setSubmitting(true)

    try {
      const costUSD = convertToUSD(parseFloat(form.cost), form.currency)
      
      const acquisitionData = {
        date_purchased: form.date_purchased,
        acquirer_id: form.acquirer_id,
        source_country: form.source_country,
        vendor_id: form.vendor_id || null,
        payment_method_id: form.payment_method_id || null,
        product_id: form.product_id,
        quantity_purchased: parseInt(form.quantity_purchased),
        cost: parseFloat(form.cost),
        currency: form.currency,
        cost_usd: costUSD,
        status: 'Purchased',
        notes: form.notes || null
      }
      
      await createAcquisition(acquisitionData)

      addToast('Purchase logged successfully! Go to "Intake to Master" to receive into inventory.')
      
      setForm(f => ({
        ...f,
        product_id: '',
        quantity_purchased: 1,
        cost: '',
        notes: ''
      }))
    } catch (error) {
      console.error('Error creating acquisition:', error)
      addToast('Failed to log purchase', 'error')
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
          <ShoppingCart className="text-blue-400" />
          Purchased Items
        </h1>
        <p className="text-gray-400 mt-1">Log new inventory purchases</p>
      </div>

      <form onSubmit={handleSubmit} className="card max-w-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Date Purchased *
            </label>
            <input
              type="date"
              name="date_purchased"
              value={form.date_purchased}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Acquirer *
            </label>
            <select
              name="acquirer_id"
              value={form.acquirer_id}
              onChange={handleChange}
              required
            >
              <option value="">Select acquirer...</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Source Country *
            </label>
            <select
              name="source_country"
              value={form.source_country}
              onChange={handleChange}
              required
            >
              <option value="USA">USA</option>
              <option value="Japan">Japan</option>
              <option value="China">China</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Vendor (optional)
            </label>
            {showNewVendor ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newVendorName}
                  onChange={(e) => setNewVendorName(e.target.value)}
                  placeholder="Vendor name..."
                  className="flex-1"
                />
                <select
                  value={newVendorCountry}
                  onChange={(e) => setNewVendorCountry(e.target.value)}
                  className="w-24"
                >
                  <option value="USA">USA</option>
                  <option value="Japan">Japan</option>
                  <option value="China">China</option>
                </select>
                <button type="button" onClick={handleAddVendor} className="btn btn-primary p-2">
                  <Save size={18} />
                </button>
                <button type="button" onClick={() => setShowNewVendor(false)} className="btn btn-secondary p-2">
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  name="vendor_id"
                  value={form.vendor_id}
                  onChange={handleChange}
                  className="flex-1"
                >
                  <option value="">Select vendor...</option>
                  {vendors.map(vendor => (
                    <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                  ))}
                </select>
                <button 
                  type="button" 
                  onClick={() => setShowNewVendor(true)}
                  className="btn btn-secondary p-2"
                  title="Add new vendor"
                >
                  <Plus size={18} />
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Payment Method (optional)
            </label>
            <select
              name="payment_method_id"
              value={form.payment_method_id}
              onChange={handleChange}
            >
              <option value="">Select payment method...</option>
              {paymentMethods.map(pm => (
                <option key={pm.id} value={pm.id}>{pm.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Currency *
            </label>
            <select
              name="currency"
              value={form.currency}
              onChange={handleChange}
              required
            >
              <option value="USD">USD ($)</option>
              <option value="JPY">JPY (¥)</option>
              <option value="RMB">RMB (¥)</option>
            </select>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-vault-border">
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
                  {product.brand} - {product.type} - {product.category} - {product.name} ({product.language})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Quantity *
            </label>
            <input
              type="number"
              name="quantity_purchased"
              value={form.quantity_purchased}
              onChange={handleChange}
              min="1"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Total Cost ({form.currency}) *
            </label>
            <input
              type="number"
              name="cost"
              value={form.cost}
              onChange={handleChange}
              min="0"
              step="0.01"
              placeholder="0.00"
              required
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Notes (optional)
          </label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={2}
            placeholder="Optional notes..."
          />
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
                Log Purchase
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
