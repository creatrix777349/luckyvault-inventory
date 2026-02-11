import React, { useState } from 'react'

import { createProduct } from '../lib/supabase'
import { ToastContainer, useToast } from '../components/Toast'
import { Plus, Save, Trash2 } from 'lucide-react'

export default function AddProduct() {
  
  const { toasts, addToast, removeToast } = useToast()
  
  const [submitting, setSubmitting] = useState(false)
  const [mode, setMode] = useState('single') // 'single' or 'bulk'

  // Single product form
  const [form, setForm] = useState({
    brand: 'Pokemon',
    category: 'Booster Box',
    name: '',
    language: 'EN',
    breakable: true,
    packs_per_box: ''
  })

  // Bulk products list
  const [bulkProducts, setBulkProducts] = useState([
    { id: 1, brand: 'Pokemon', category: 'Booster Box', name: '', language: 'EN', breakable: true, packs_per_box: '' }
  ])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm(f => ({ 
      ...f, 
      [name]: type === 'checkbox' ? checked : value 
    }))
  }

  // Product type/category options (SEALED ONLY)
  const categoryOptions = [
    'Booster Box',
    'ETB',
    'Booster Bundle',
    'UPC',
    'Tin',
    'Tin Box',
    'Blister Pack',
    'Build & Battle',
    'Collector Chest',
    'Premium Collection',
    'Ultra-Premium Collection',
    'Collection Box',
    'Figure Collection',
    'Starter Deck',
    'Deck',
    'Packs Set',
    'Special Box',
    'Booster Pack',
    'Other'
  ]

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!form.name.trim()) {
      addToast('Please enter a product name', 'error')
      return
    }

    setSubmitting(true)

    try {
      // Build final name: "Launch Name + Product Type"
      const finalName = `${form.name.trim()} ${form.category}`
      
      await createProduct({
        brand: form.brand,
        type: 'Sealed', // Always sealed
        category: form.category,
        name: finalName,
        language: form.language,
        breakable: form.breakable,
        packs_per_box: form.breakable && form.packs_per_box ? parseInt(form.packs_per_box) : null
      })

      addToast('Product added successfully!')
      
      setForm(f => ({
        ...f,
        name: '',
        packs_per_box: ''
      }))
    } catch (error) {
      console.error('Error adding product:', error)
      if (error.message?.includes('duplicate')) {
        addToast('This product already exists', 'error')
      } else {
        addToast('Failed to add product', 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Bulk handlers
  const addBulkProduct = () => {
    const lastProduct = bulkProducts[bulkProducts.length - 1]
    const newId = Math.max(...bulkProducts.map(p => p.id), 0) + 1
    setBulkProducts([...bulkProducts, {
      id: newId,
      brand: lastProduct?.brand || 'Pokemon',
      category: lastProduct?.category || 'Booster Box',
      name: '',
      language: lastProduct?.language || 'EN',
      breakable: lastProduct?.breakable ?? true,
      packs_per_box: lastProduct?.packs_per_box || ''
    }])
  }

  const removeBulkProduct = (id) => {
    if (bulkProducts.length <= 1) {
      addToast('Must have at least one product', 'error')
      return
    }
    setBulkProducts(bulkProducts.filter(p => p.id !== id))
  }

  const updateBulkProduct = (id, field, value) => {
    setBulkProducts(bulkProducts.map(p => {
      if (p.id !== id) return p
      return { ...p, [field]: value }
    }))
  }

  const handleBulkSubmit = async (e) => {
    e.preventDefault()
    
    const validProducts = bulkProducts.filter(p => p.name.trim())
    if (validProducts.length === 0) {
      addToast('Please enter at least one product name', 'error')
      return
    }

    setSubmitting(true)
    let successCount = 0
    let failCount = 0

    try {
      for (const product of validProducts) {
        try {
          const finalName = `${product.name.trim()} ${product.category}`
          
          await createProduct({
            brand: product.brand,
            type: 'Sealed',
            category: product.category,
            name: finalName,
            language: product.language,
            breakable: product.breakable,
            packs_per_box: product.breakable && product.packs_per_box ? parseInt(product.packs_per_box) : null
          })
          successCount++
        } catch (err) {
          console.error('Error adding product:', err)
          failCount++
        }
      }

      if (successCount > 0) {
        addToast(`${successCount} product(s) added!${failCount > 0 ? ` ${failCount} failed.` : ''}`)
        setBulkProducts(bulkProducts.map(p => ({ ...p, name: '', packs_per_box: '' })))
      } else {
        addToast('Failed to add products', 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-white flex items-center gap-3">
          <Plus className="text-emerald-400" />
          Add New Product
        </h1>
        <p className="text-gray-400 mt-1">Add sealed products to the inventory system</p>
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
          Single Product
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
        /* Single Product Form */
        <form onSubmit={handleSubmit} className="card max-w-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Brand *</label>
              <select name="brand" value={form.brand} onChange={handleChange} required>
                <option value="Pokemon">Pokemon</option>
                <option value="One Piece">One Piece</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Product Type *</label>
              <select name="category" value={form.category} onChange={handleChange} required>
                {categoryOptions.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Language *</label>
              <select name="language" value={form.language} onChange={handleChange} required>
                <option value="EN">English (ENG)</option>
                <option value="JP">Japanese (JP)</option>
                <option value="CN">Chinese (CN)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Launch Name *</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g., Prismatic Evolutions"
                required
              />
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center gap-3 p-3 bg-vault-dark rounded-lg border border-vault-border">
                <input
                  type="checkbox"
                  id="breakable"
                  name="breakable"
                  checked={form.breakable}
                  onChange={handleChange}
                  className="w-5 h-5"
                />
                <label htmlFor="breakable" className="text-sm text-gray-300">
                  Can be broken into packs (Breakable)
                </label>
              </div>
            </div>

            {form.breakable && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2"># of Packs *</label>
                <input
                  type="number"
                  name="packs_per_box"
                  value={form.packs_per_box}
                  onChange={handleChange}
                  min="1"
                  placeholder="e.g., 36"
                  required={form.breakable}
                />
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="mt-6 p-4 bg-vault-dark rounded-lg border border-vault-border">
            <p className="text-gray-400 text-sm mb-2">Preview:</p>
            <p className="text-white font-medium">
              <span className="text-vault-gold">{form.brand}</span>
              <span className="text-gray-400"> | </span>
              <span className="text-white">{form.name || '[Launch Name]'} {form.category}</span>
              <span className="text-gray-400"> | </span>
              <span className="text-blue-400">{form.language}</span>
              {form.breakable && form.packs_per_box && (
                <span className="text-green-400 ml-2">• {form.packs_per_box} packs</span>
              )}
            </p>
          </div>

          <div className="mt-6">
            <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
              {submitting ? (
                <div className="spinner w-5 h-5 border-2"></div>
              ) : (
                <><Save size={20} /> Add Product</>
              )}
            </button>
          </div>
        </form>
      ) : (
        /* Bulk Add Form */
        <form onSubmit={handleBulkSubmit}>
          <div className="card mb-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display text-lg font-semibold text-white">Bulk Add Products</h2>
              <button type="button" onClick={addBulkProduct} className="btn btn-secondary text-sm">
                <Plus size={16} /> Add Row
              </button>
            </div>

            <div className="space-y-4">
              {bulkProducts.map((product, index) => (
                <div key={product.id} className="p-4 bg-vault-dark rounded-lg border border-vault-border">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-vault-gold font-semibold text-sm">Product {index + 1}</span>
                    {bulkProducts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeBulkProduct(product.id)}
                        className="p-1 text-gray-500 hover:text-red-400"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Brand</label>
                      <select
                        value={product.brand}
                        onChange={(e) => updateBulkProduct(product.id, 'brand', e.target.value)}
                        className="w-full text-sm"
                      >
                        <option value="Pokemon">Pokemon</option>
                        <option value="One Piece">One Piece</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Product Type</label>
                      <select
                        value={product.category}
                        onChange={(e) => updateBulkProduct(product.id, 'category', e.target.value)}
                        className="w-full text-sm"
                      >
                        {categoryOptions.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Language</label>
                      <select
                        value={product.language}
                        onChange={(e) => updateBulkProduct(product.id, 'language', e.target.value)}
                        className="w-full text-sm"
                      >
                        <option value="EN">ENG</option>
                        <option value="JP">JP</option>
                        <option value="CN">CN</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-400 mb-1">Launch Name *</label>
                      <input
                        type="text"
                        value={product.name}
                        onChange={(e) => updateBulkProduct(product.id, 'name', e.target.value)}
                        placeholder="e.g., Prismatic Evolutions"
                        className="w-full text-sm"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-400">
                      <input
                        type="checkbox"
                        checked={product.breakable}
                        onChange={(e) => updateBulkProduct(product.id, 'breakable', e.target.checked)}
                        className="w-4 h-4"
                      />
                      Breakable
                    </label>
                    {product.breakable && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400"># Packs:</span>
                        <input
                          type="number"
                          value={product.packs_per_box}
                          onChange={(e) => updateBulkProduct(product.id, 'packs_per_box', e.target.value)}
                          className="w-16 text-sm"
                          min="1"
                          placeholder="36"
                        />
                      </div>
                    )}
                  </div>

                  {/* Preview */}
                  {product.name && (
                    <div className="mt-3 text-sm text-gray-400">
                      Preview: <span className="text-vault-gold">{product.brand}</span>
                      <span className="text-white"> | {product.name} {product.category}</span>
                      <span className="text-blue-400"> | {product.language}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addBulkProduct}
              className="w-full mt-4 py-2 border-2 border-dashed border-vault-border rounded-lg text-gray-400 hover:text-white hover:border-vault-gold transition-colors"
            >
              <Plus size={16} className="inline mr-2" />
              Add Another Product
            </button>
          </div>

          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <span className="text-gray-400">
                Products to add: <span className="text-white font-semibold">{bulkProducts.filter(p => p.name.trim()).length}</span>
              </span>
            </div>
            <button 
              type="submit" 
              className="btn btn-primary w-full"
              disabled={submitting || bulkProducts.filter(p => p.name.trim()).length === 0}
            >
              {submitting ? (
                <div className="spinner w-5 h-5 border-2"></div>
              ) : (
                <><Save size={20} /> Add {bulkProducts.filter(p => p.name.trim()).length} Product(s)</>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
