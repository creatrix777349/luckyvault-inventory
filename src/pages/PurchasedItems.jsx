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
import { ShoppingCart, Plus, Save, X, Search, Trash2 } from 'lucide-react'

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

  // Search state
  const [searchTerm, setSearchTerm] = useState('')

  // Header form (shared across all line items)
  const [header, setHeader] = useState({
    date_purchased: new Date().toISOString().split('T')[0],
    acquirer_id: '',
    source_country: 'USA',
    vendor_id: '',
    payment_method_id: '',
    currency: 'USD'
  })

  // Line items (multiple products)
  const [lineItems, setLineItems] = useState([
    { id: 1, product_id: '', quantity: 1, cost: '', notes: '' }
  ])

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
      
      await getExchangeRates()
    } catch (error) {
      console.error('Error loading data:', error)
      addToast('Failed to load data', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleHeaderChange = (e) => {
    const { name, value } = e.target
    setHeader(h => ({ ...h, [name]: value }))
  }

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setProductFilters(f => ({ ...f, [name]: value }))
  }

  // Filter products by search term and filters
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
    return true
  })

  // Line item handlers
  const addLineItem = () => {
    const newId = Math.max(...lineItems.map(i => i.id), 0) + 1
    setLineItems([...lineItems, { id: newId, product_id: '', quantity: 1, cost: '', notes: '' }])
  }

  const removeLineItem = (id) => {
    if (lineItems.length <= 1) {
      addToast('Must have at least one item', 'error')
      return
    }
    setLineItems(lineItems.filter(i => i.id !== id))
  }

  const updateLineItem = (id, field, value) => {
    setLineItems(lineItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ))
  }

  const handleAddVendor = async () => {
    if (!newVendorName.trim()) return
    
    try {
      const vendor = await createVendor({
        name: newVendorName.trim(),
        country: newVendorCountry || null,
        created_by: null
      })
      setVendors([...vendors, vendor])
      setHeader(h => ({ ...h, vendor_id: vendor.id }))
      setShowNewVendor(false)
      setNewVendorName('')
      addToast('Vendor added successfully')
    } catch (error) {
      addToast('Failed to add vendor', 'error')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate header
    if (!header.acquirer_id) {
      addToast('Please select an acquirer', 'error')
      return
    }

    // Validate line items
    const validItems = lineItems.filter(item => item.product_id && item.cost)
    if (validItems.length === 0) {
      addToast('Please add at least one product with cost', 'error')
      return
    }

    setSubmitting(true)

    try {
      // Create acquisition for each line item
      for (const item of validItems) {
        const costUSD = convertToUSD(parseFloat(item.cost), header.currency)
        
        const acquisitionData = {
          date_purchased: header.date_purchased,
          acquirer_id: header.acquirer_id,
          source_country: header.source_country,
          vendor_id: header.vendor_id || null,
          payment_method_id: header.payment_method_id || null,
          product_id: item.product_id,
          quantity_purchased: parseInt(item.quantity),
          cost: parseFloat(item.cost),
          currency: header.currency,
          cost_usd: costUSD,
          status: 'Purchased',
          notes: item.notes || null,
          created_by: null
        }
        
        await createAcquisition(acquisitionData)
      }

      addToast(`${validItems.length} purchase(s) logged! Go to "Intake to Master" to receive into inventory.`)
      
      // Reset line items but keep header
      setLineItems([{ id: 1, product_id: '', quantity: 1, cost: '', notes: '' }])
    } catch (error) {
      console.error('Error creating acquisition:', error)
      addToast('Failed to log purchase', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Get product name by ID
  const getProductName = (productId) => {
    const product = products.find(p => p.id === productId)
    if (!product) return ''
    return `${product.brand} - ${product.name} (${product.language})`
  }

  // Calculate totals
  const totalCost = lineItems.reduce((sum, item) => sum + (parseFloat(item.cost) || 0), 0)
  const totalItems = lineItems.filter(i => i.product_id).length

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
        <p className="text-gray-400 mt-1">Log new inventory purchases (supports multiple items)</p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Header Section */}
        <div className="card mb-6">
          <h2 className="font-display text-lg font-semibold text-white mb-4">Purchase Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Date Purchased *
              </label>
              <input
                type="date"
                name="date_purchased"
                value={header.date_purchased}
                onChange={handleHeaderChange}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Acquirer *
              </label>
              <select
                name="acquirer_id"
                value={header.acquirer_id}
                onChange={handleHeaderChange}
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
                value={header.source_country}
                onChange={handleHeaderChange}
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
                    value={header.vendor_id}
                    onChange={handleHeaderChange}
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
                value={header.payment_method_id}
                onChange={handleHeaderChange}
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
                value={header.currency}
                onChange={handleHeaderChange}
                required
              >
                <option value="USD">USD ($)</option>
                <option value="JPY">JPY (¥)</option>
                <option value="RMB">RMB (¥)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Product Selection with Search */}
        <div className="card mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-display text-lg font-semibold text-white">Products</h2>
            <button
              type="button"
              onClick={addLineItem}
              className="btn btn-secondary text-sm"
            >
              <Plus size={16} /> Add Another Item
            </button>
          </div>

          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search products by name, brand, type..."
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

          {/* Line Items */}
          <div className="space-y-3">
            {lineItems.map((item, index) => (
              <div 
                key={item.id} 
                className="p-4 bg-vault-dark rounded-lg border border-vault-border"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-vault-gold font-semibold text-sm">Item {index + 1}</span>
                  {lineItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLineItem(item.id)}
                      className="ml-auto p-1 text-gray-500 hover:text-red-400"
                      title="Remove item"
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
                      onChange={(e) => updateLineItem(item.id, 'product_id', e.target.value)}
                      className="w-full text-sm"
                    >
                      <option value="">Select product...</option>
                      {filteredProducts
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(product => (
                        <option key={product.id} value={product.id}>
                          {product.brand} - {product.type} - {product.name} ({product.language})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Qty *</label>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(item.id, 'quantity', e.target.value)}
                      min="1"
                      className="w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Cost ({header.currency}) *</label>
                    <input
                      type="number"
                      value={item.cost}
                      onChange={(e) => updateLineItem(item.id, 'cost', e.target.value)}
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full text-sm"
                    />
                  </div>
                </div>
                
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-400 mb-1">Notes (optional)</label>
                  <input
                    type="text"
                    value={item.notes}
                    onChange={(e) => updateLineItem(item.id, 'notes', e.target.value)}
                    placeholder="Optional notes for this item..."
                    className="w-full text-sm"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Add more button */}
          <button
            type="button"
            onClick={addLineItem}
            className="w-full mt-3 py-2 border-2 border-dashed border-vault-border rounded-lg text-gray-400 hover:text-white hover:border-vault-gold transition-colors"
          >
            <Plus size={16} className="inline mr-2" />
            Add Another Item
          </button>
        </div>

        {/* Summary & Submit */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <div>
              <span className="text-gray-400">Total Items:</span>
              <span className="text-white font-semibold ml-2">{totalItems}</span>
            </div>
            <div>
              <span className="text-gray-400">Total Cost:</span>
              <span className="text-vault-gold font-semibold ml-2">
                {header.currency === 'USD' && '$'}
                {header.currency === 'JPY' && '¥'}
                {header.currency === 'RMB' && '¥'}
                {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary w-full"
            disabled={submitting || totalItems === 0}
          >
            {submitting ? (
              <div className="spinner w-5 h-5 border-2"></div>
            ) : (
              <>
                <Save size={20} />
                Log {totalItems} Purchase{totalItems !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
