import React, { useState } from 'react'

import { createProduct } from '../lib/supabase'
import { ToastContainer, useToast } from '../components/Toast'
import { Plus, Save } from 'lucide-react'

export default function AddProduct() {
  
  const { toasts, addToast, removeToast } = useToast()
  
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    brand: 'Pokemon',
    type: 'Sealed',
    category: 'Booster Box',
    name: '',
    language: 'EN',
    breakable: true,
    packs_per_box: '',
    appendCategory: true  // Auto-append category to name
  })

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm(f => ({ 
      ...f, 
      [name]: type === 'checkbox' ? checked : value 
    }))
  }

  // Generate final product name
  const getFinalName = () => {
    if (!form.name.trim()) return '[Name]'
    
    // For Sealed products, append category if enabled
    if (form.type === 'Sealed' && form.appendCategory && form.category) {
      return `${form.name.trim()} ${form.category}`
    }
    return form.name.trim()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!form.name.trim()) {
      addToast('Please enter a product name', 'error')
      return
    }

    setSubmitting(true)

    try {
      const finalName = getFinalName()
      
      await createProduct({
        brand: form.brand,
        type: form.type,
        category: form.category,
        name: finalName,
        language: form.language,
        breakable: form.breakable,
        packs_per_box: form.breakable && form.packs_per_box ? parseInt(form.packs_per_box) : null
      })

      addToast('Product added successfully!')
      
      // Reset form but keep some defaults
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

  const categoryOptions = {
    Sealed: ['Booster Box', 'ETB', 'Booster Bundle', 'UPC', 'Tin', 'Tin Box', 'Blister Pack', 'Build & Battle', 'Collector Chest', 'Premium Collection', 'Ultra-Premium Collection', 'Collection Box', 'Figure Collection', 'Starter Deck', 'Deck', 'Packs Set', 'Special', 'Special Box', 'Collection', 'Other'],
    Pack: ['Booster Pack'],
    Single: ['Singles'],
    Slab: ['PSA', 'CGC', 'Beckett']
  }

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-white flex items-center gap-3">
          <Plus className="text-emerald-400" />
          Add New Product
        </h1>
        <p className="text-gray-400 mt-1">Add a new product to the inventory system</p>
      </div>

      <form onSubmit={handleSubmit} className="card max-w-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Brand *
            </label>
            <select
              name="brand"
              value={form.brand}
              onChange={handleChange}
              required
            >
              <option value="Pokemon">Pokemon</option>
              <option value="One Piece">One Piece</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Type *
            </label>
            <select
              name="type"
              value={form.type}
              onChange={(e) => {
                const newType = e.target.value
                setForm(f => ({ 
                  ...f, 
                  type: newType,
                  category: categoryOptions[newType]?.[0] || '',
                  breakable: newType === 'Sealed',
                  appendCategory: newType === 'Sealed'
                }))
              }}
              required
            >
              <option value="Sealed">Sealed</option>
              <option value="Pack">Pack</option>
              <option value="Single">Single</option>
              <option value="Slab">Slab</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Category *
            </label>
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              required
            >
              {categoryOptions[form.type]?.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Language *
            </label>
            <select
              name="language"
              value={form.language}
              onChange={handleChange}
              required
            >
              <option value="EN">English</option>
              <option value="JP">Japanese</option>
              <option value="CN">Chinese</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Set/Product Name *
            </label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g., Prismatic Evolutions"
              required
            />
            <p className="text-gray-500 text-xs mt-1">
              Enter the set name (e.g., "Journey Together", "Mega Dream")
            </p>
          </div>

          {/* Append Category Toggle - only for Sealed */}
          {form.type === 'Sealed' && (
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                <input
                  type="checkbox"
                  id="appendCategory"
                  name="appendCategory"
                  checked={form.appendCategory}
                  onChange={handleChange}
                  className="w-5 h-5"
                />
                <label htmlFor="appendCategory" className="text-sm text-gray-300">
                  Auto-append product type to name (e.g., "Journey Together" → "Journey Together ETB")
                </label>
              </div>
            </div>
          )}

          {form.type === 'Sealed' && (
            <>
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
                    Can be broken into packs
                  </label>
                </div>
              </div>

              {form.breakable && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Packs per Box *
                  </label>
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
            </>
          )}
        </div>

        {/* Preview */}
        <div className="mt-6 p-4 bg-vault-dark rounded-lg border border-vault-border">
          <p className="text-gray-400 text-sm mb-2">Preview:</p>
          <p className="text-white font-medium">
            {form.brand} - {form.type} - <span className="text-vault-gold">{getFinalName()}</span> - {form.category} ({form.language})
            {form.breakable && form.packs_per_box && (
              <span className="text-blue-400 ml-2">• {form.packs_per_box} packs</span>
            )}
          </p>
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
                Add New Product
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
