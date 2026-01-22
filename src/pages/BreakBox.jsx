import React, { useState, useEffect } from 'react'
import { 
  fetchProducts,
  fetchLocations,
  fetchInventory,
  createBoxBreak,
  updateInventory
} from '../lib/supabase'
import { ToastContainer, useToast } from '../components/Toast'
import { Box, ArrowDown, Save, AlertCircle, Package } from 'lucide-react'

export default function BreakBox() {
  const { toasts, addToast, removeToast } = useToast()
  
  const [products, setProducts] = useState([])
  const [masterLocation, setMasterLocation] = useState(null)
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    sealed_product_id: '',
    boxes_broken: 1,
    override_pack_count: false,
    manual_pack_count: '',
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
      
      const master = locData.find(l => l.name === 'Master Inventory')
      if (master) {
        setMasterLocation(master)
        const invData = await fetchInventory(master.id)
        const breakableInv = invData.filter(inv => inv.product?.breakable && inv.quantity > 0)
        setInventory(breakableInv)
      } else {
        addToast('Master Inventory location not found', 'error')
      }
    } catch (error) {
      console.error('Error loading data:', error)
      addToast('Failed to load data', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm(f => ({ 
      ...f, 
      [name]: type === 'checkbox' ? checked : value 
    }))
  }

  const selectedProduct = products.find(p => p.id === form.sealed_product_id)
  const selectedInventory = inventory.find(inv => inv.product_id === form.sealed_product_id)
  const maxBoxes = selectedInventory?.quantity || 0
  
  const defaultPackCount = selectedProduct?.packs_per_box || 0
  const actualPackCount = form.override_pack_count 
    ? parseInt(form.manual_pack_count) || 0 
    : defaultPackCount
  const totalPacks = actualPackCount * parseInt(form.boxes_broken || 0)

  // Find corresponding pack product - improved matching logic
  const findPackProduct = () => {
    if (!selectedProduct) return null
    
    const packProducts = products.filter(p => 
      p.brand === selectedProduct.brand &&
      p.type === 'Pack' &&
      p.language === selectedProduct.language
    )
    
    // Try exact name match first
    let match = packProducts.find(p => 
      p.name.toLowerCase() === selectedProduct.name.toLowerCase()
    )
    if (match) return match
    
    // Try matching without common suffixes
    match = packProducts.find(p => 
      selectedProduct.name.toLowerCase().startsWith(p.name.toLowerCase()) ||
      p.name.toLowerCase().startsWith(selectedProduct.name.toLowerCase())
    )
    if (match) return match
    
    // Try matching the core name (remove parenthetical info)
    const coreName = selectedProduct.name.replace(/\s*\([^)]*\)\s*/g, '').trim().toLowerCase()
    match = packProducts.find(p => {
      const packCoreName = p.name.replace(/\s*\([^)]*\)\s*/g, '').trim().toLowerCase()
      return coreName === packCoreName || 
             coreName.startsWith(packCoreName) || 
             packCoreName.startsWith(coreName)
    })
    if (match) return match
    
    // Fallback: match by first significant word
    const significantWord = selectedProduct.name.split(' ')[0].toLowerCase()
    if (significantWord.length > 2) {
      match = packProducts.find(p => 
        p.name.toLowerCase().includes(significantWord)
      )
    }
    
    return match
  }

  const packProduct = findPackProduct()

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!masterLocation) {
      addToast('Master Inventory location not found', 'error')
      return
    }
    
    if (!form.sealed_product_id) {
      addToast('Please select a product', 'error')
      return
    }
    
    if (parseInt(form.boxes_broken) > maxBoxes) {
      addToast(`Only ${maxBoxes} boxes available`, 'error')
      return
    }

    if (actualPackCount <= 0) {
      addToast('Pack count must be greater than 0', 'error')
      return
    }

    if (!packProduct) {
      addToast('No matching pack product found. Please add the pack product first.', 'error')
      return
    }

    setSubmitting(true)

    try {
      const boxesBroken = parseInt(form.boxes_broken)
      const costBasisPerBox = selectedInventory?.avg_cost_basis || 0
      const costBasisPerPack = totalPacks > 0 ? (costBasisPerBox * boxesBroken) / totalPacks : 0

      // Create box break record
      await createBoxBreak({
        date: form.date,
        sealed_product_id: form.sealed_product_id,
        pack_product_id: packProduct.id,
        location_id: masterLocation.id,
        boxes_broken: boxesBroken,
        packs_created: totalPacks,
        cost_basis_per_pack: costBasisPerPack,
        override_pack_count: form.override_pack_count,
        notes: form.notes
      })

      // Update inventory - subtract boxes from Master Inventory
      await updateInventory(
        form.sealed_product_id,
        masterLocation.id,
        -boxesBroken
      )

      // Update inventory - add packs to Master Inventory
      await updateInventory(
        packProduct.id,
        masterLocation.id,
        totalPacks,
        costBasisPerPack
      )

      addToast(`Broke ${boxesBroken} box(es) into ${totalPacks} packs!`)
      
      // Reset form
      setForm(f => ({
        ...f,
        sealed_product_id: '',
        boxes_broken: 1,
        override_pack_count: false,
        manual_pack_count: '',
        notes: ''
      }))
      
      // Reload inventory
      loadData()
    } catch (error) {
      console.error('Error breaking box:', error)
      addToast('Failed to break box', 'error')
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
          <Box className="text-pink-400" />
          Break Box
        </h1>
        <p className="text-gray-400 mt-1">Break sealed product into individual packs at Master Inventory</p>
      </div>

      <form onSubmit={handleSubmit} className="card max-w-2xl">
        {/* Location Info (read-only) */}
        <div className="mb-6 p-3 bg-vault-dark rounded-lg border border-vault-border flex items-center gap-3">
          <Package className="text-cyan-400" size={20} />
          <div>
            <p className="text-sm text-gray-400">Location</p>
            <p className="text-white font-medium">Master Inventory</p>
          </div>
        </div>

        {/* Date */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Date *
          </label>
          <input
            type="date"
            name="date"
            value={form.date}
            onChange={handleChange}
            required
            className="max-w-xs"
          />
        </div>

        {/* Product Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Sealed Product * (breakable items in Master Inventory)
          </label>
          {inventory.length === 0 ? (
            <div className="p-4 bg-vault-dark rounded-lg border border-vault-border text-gray-400 text-sm">
              No breakable products in Master Inventory
            </div>
          ) : (
            <select
              name="sealed_product_id"
              value={form.sealed_product_id}
              onChange={handleChange}
              required
            >
              <option value="">Select product...</option>
              {inventory.map(inv => (
                <option key={inv.id} value={inv.product_id}>
                  {inv.product?.brand} - {inv.product?.category} - {inv.product?.name} ({inv.product?.language}) 
                  - {inv.quantity} available 
                  - {inv.product?.packs_per_box} packs/box
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Box Count */}
        {form.sealed_product_id && (
          <>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Boxes to Break * (max: {maxBoxes})
              </label>
              <input
                type="number"
                name="boxes_broken"
                value={form.boxes_broken}
                onChange={handleChange}
                min="1"
                max={maxBoxes}
                required
                className="max-w-xs"
              />
            </div>

            {/* Pack Override */}
            <div className="mt-4 p-4 bg-vault-dark rounded-lg border border-vault-border">
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  id="override_pack_count"
                  name="override_pack_count"
                  checked={form.override_pack_count}
                  onChange={handleChange}
                  className="w-5 h-5"
                />
                <label htmlFor="override_pack_count" className="text-sm text-gray-300">
                  Override pack count (for unsealed or partial boxes)
                </label>
              </div>

              {form.override_pack_count && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Actual packs per box
                  </label>
                  <input
                    type="number"
                    name="manual_pack_count"
                    value={form.manual_pack_count}
                    onChange={handleChange}
                    min="1"
                    placeholder={defaultPackCount.toString()}
                    className="max-w-xs"
                  />
                </div>
              )}
            </div>

            {/* Preview */}
            <div className="mt-6 p-4 bg-gradient-to-br from-pink-500/10 to-purple-500/10 rounded-lg border border-pink-500/30">
              <h4 className="font-display font-semibold text-white mb-3 flex items-center gap-2">
                <ArrowDown size={18} />
                Break Preview
              </h4>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Boxes to break:</span>
                  <span className="text-white font-medium">{form.boxes_broken}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Packs per box:</span>
                  <span className="text-white font-medium">
                    {actualPackCount}
                    {form.override_pack_count && (
                      <span className="text-yellow-400 ml-1">(override)</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between border-t border-vault-border pt-2 mt-2">
                  <span className="text-gray-300 font-medium">Total packs created:</span>
                  <span className="text-pink-400 font-bold text-lg">{totalPacks}</span>
                </div>
                {packProduct && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Pack product:</span>
                    <span className="text-green-400 font-medium">{packProduct.name}</span>
                  </div>
                )}
                {selectedInventory?.avg_cost_basis > 0 && totalPacks > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Cost basis per pack:</span>
                    <span className="text-vault-gold">
                      ${((selectedInventory.avg_cost_basis * parseInt(form.boxes_broken || 0)) / totalPacks).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {!packProduct && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle size={18} />
                No matching pack product found. Please add a pack product for "{selectedProduct?.name}" before breaking.
              </div>
            )}
          </>
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
            disabled={submitting || !form.sealed_product_id || totalPacks === 0 || !packProduct}
          >
            {submitting ? (
              <div className="spinner w-5 h-5 border-2"></div>
            ) : (
              <>
                <Save size={20} />
                Break Box
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
