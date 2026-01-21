import React, { useState, useEffect } from 'react'
import { 
  fetchHighValueItems,
  fetchLocations,
  fetchVendors,
  fetchUsers,
  createHighValueItem,
  updateHighValueItemLocation,
  supabase
} from '../lib/supabase'
import { ToastContainer, useToast } from '../components/Toast'
import { Star, Plus, Save, X, ArrowRightLeft, Camera, Upload } from 'lucide-react'

export default function HighValueTracking() {
  const { toasts, addToast, removeToast } = useToast()
  
  const [items, setItems] = useState([])
  const [locations, setLocations] = useState([])
  const [vendors, setVendors] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showMoveModal, setShowMoveModal] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [itemsData, locData, vendorData, userData] = await Promise.all([
        fetchHighValueItems('In Inventory'),
        fetchLocations('Physical'),
        fetchVendors(),
        fetchUsers()
      ])
      setItems(itemsData)
      setLocations(locData)
      setVendors(vendorData)
      setUsers(userData)
    } catch (error) {
      console.error('Error loading data:', error)
      addToast('Failed to load data', 'error')
    } finally {
      setLoading(false)
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
      
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-white flex items-center gap-3">
            <Star className="text-yellow-400" />
            High Value Tracking
          </h1>
          <p className="text-gray-400 mt-1">$100+ singles and $400+ slabs</p>
        </div>
        
        <button onClick={() => setShowAddForm(true)} className="btn btn-primary">
          <Plus size={20} />
          Add Item
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <p className="text-gray-400 text-sm">Total Items</p>
          <p className="font-display text-2xl font-bold text-white">{items.length}</p>
        </div>
        <div className="card">
          <p className="text-gray-400 text-sm">Total Value</p>
          <p className="font-display text-2xl font-bold text-vault-gold">
            ${items.reduce((sum, i) => sum + (i.purchase_price_usd || 0), 0).toLocaleString()}
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card text-center py-12">
          <Star className="mx-auto text-gray-600 mb-4" size={48} />
          <p className="text-gray-400">No high value items tracked yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => (
            <HighValueCard key={item.id} item={item} onMove={() => setShowMoveModal(item)} />
          ))}
        </div>
      )}

      {showAddForm && (
        <AddHighValueForm
          locations={locations}
          vendors={vendors}
          users={users}
          onClose={() => setShowAddForm(false)}
          onSuccess={() => { setShowAddForm(false); loadData(); addToast('High value item added!'); }}
          addToast={addToast}
        />
      )}

      {showMoveModal && (
        <MoveHighValueModal
          item={showMoveModal}
          locations={locations}
          onClose={() => setShowMoveModal(null)}
          onSuccess={() => { setShowMoveModal(null); loadData(); addToast('Item moved successfully!'); }}
          addToast={addToast}
        />
      )}
    </div>
  )
}

function HighValueCard({ item, onMove }) {
  return (
    <div className="card border-yellow-500/30 bg-gradient-to-br from-yellow-500/5 to-amber-600/5">
      <div className="aspect-video bg-vault-dark rounded-lg mb-4 flex items-center justify-center overflow-hidden">
        {item.photo_url ? (
          <img src={item.photo_url} alt={item.card_name} className="w-full h-full object-cover" />
        ) : (
          <Camera className="text-gray-600" size={48} />
        )}
      </div>
      
      <div>
        <h3 className="font-display text-lg font-semibold text-white mb-1">{item.card_name}</h3>
        <div className="flex items-center gap-2 mb-2">
          <span className={`badge ${item.brand === 'Pokemon' ? 'badge-warning' : 'badge-info'}`}>{item.brand}</span>
          <span className="text-gray-500 text-sm">{item.item_type}</span>
        </div>
        {item.grading_company && <p className="text-gray-400 text-sm mb-2">{item.grading_company} {item.grade}</p>}
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-vault-border">
          <div>
            <p className="text-vault-gold font-bold text-xl">${item.purchase_price_usd?.toLocaleString()}</p>
            <p className="text-gray-500 text-xs">{item.location?.name}</p>
          </div>
          <button onClick={onMove} className="btn btn-secondary text-sm py-2">
            <ArrowRightLeft size={16} /> Move
          </button>
        </div>
      </div>
    </div>
  )
}

function AddHighValueForm({ locations, vendors, users, onClose, onSuccess, addToast }) {
  const [submitting, setSubmitting] = useState(false)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [form, setForm] = useState({
    card_name: '', brand: 'Pokemon', item_type: 'Slab', grading_company: '', grade: '',
    purchase_price: '', currency: 'USD', location_id: '', acquirer_id: '', vendor_id: '',
    date_added: new Date().toISOString().split('T')[0], notes: ''
  })

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (file) { setPhotoFile(file); setPhotoPreview(URL.createObjectURL(file)); }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      let photoUrl = null
      if (photoFile) {
        const fileName = `${Date.now()}-${photoFile.name}`
        const { error } = await supabase.storage.from('high-value-photos').upload(fileName, photoFile)
        if (!error) {
          const { data: urlData } = supabase.storage.from('high-value-photos').getPublicUrl(fileName)
          photoUrl = urlData.publicUrl
        }
      }
      await createHighValueItem({
        ...form, purchase_price: parseFloat(form.purchase_price),
        purchase_price_usd: parseFloat(form.purchase_price),
        grade: form.grade ? parseFloat(form.grade) : null, photo_url: photoUrl
      })
      onSuccess()
    } catch (error) {
      console.error('Error adding item:', error)
      addToast('Failed to add item', 'error')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-vault-surface border border-vault-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-display text-xl font-semibold text-white">Add High Value Item</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">Photo</label>
              <div className="border-2 border-dashed border-vault-border rounded-lg p-4 text-center">
                {photoPreview ? (
                  <div className="relative">
                    <img src={photoPreview} alt="Preview" className="max-h-40 mx-auto rounded" />
                    <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null); }} className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1"><X size={16} /></button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="mx-auto text-gray-500 mb-2" size={32} />
                    <span className="text-gray-400 text-sm">Click to upload photo</span>
                    <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                  </label>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">Card Name *</label>
                <input type="text" name="card_name" value={form.card_name} onChange={handleChange} placeholder="e.g., Charizard VMAX Alt Art" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Brand *</label>
                <select name="brand" value={form.brand} onChange={handleChange} required>
                  <option value="Pokemon">Pokemon</option>
                  <option value="One Piece">One Piece</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Type *</label>
                <select name="item_type" value={form.item_type} onChange={handleChange} required>
                  <option value="Slab">Slab ($400+)</option>
                  <option value="Single">Single ($100+)</option>
                </select>
              </div>
              {form.item_type === 'Slab' && (<>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Grading Company</label>
                  <select name="grading_company" value={form.grading_company} onChange={handleChange}>
                    <option value="">Select...</option>
                    <option value="PSA">PSA</option>
                    <option value="CGC">CGC</option>
                    <option value="Beckett">Beckett</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Grade</label>
                  <input type="number" name="grade" value={form.grade} onChange={handleChange} min="1" max="10" step="0.5" placeholder="e.g., 10" />
                </div>
              </>)}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Purchase Price *</label>
                <input type="number" name="purchase_price" value={form.purchase_price} onChange={handleChange} min="0" step="0.01" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Currency *</label>
                <select name="currency" value={form.currency} onChange={handleChange} required>
                  <option value="USD">USD</option>
                  <option value="JPY">JPY</option>
                  <option value="RMB">RMB</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">Location *</label>
                <select name="location_id" value={form.location_id} onChange={handleChange} required>
                  <option value="">Select location...</option>
                  {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Acquirer</label>
                <select name="acquirer_id" value={form.acquirer_id} onChange={handleChange}>
                  <option value="">Select...</option>
                  {users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Vendor</label>
                <select name="vendor_id" value={form.vendor_id} onChange={handleChange}>
                  <option value="">Select...</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
              <button type="submit" className="btn btn-primary flex-1" disabled={submitting}>
                {submitting ? <div className="spinner w-5 h-5 border-2"></div> : <><Save size={20} /> Add Item</>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function MoveHighValueModal({ item, locations, onClose, onSuccess, addToast }) {
  const [submitting, setSubmitting] = useState(false)
  const [newLocationId, setNewLocationId] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!newLocationId) return
    setSubmitting(true)
    try {
      await updateHighValueItemLocation(item.id, newLocationId)
      onSuccess()
    } catch (error) {
      console.error('Error moving item:', error)
      addToast('Failed to move item', 'error')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-vault-surface border border-vault-border rounded-xl w-full max-w-md">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-display text-xl font-semibold text-white">Move Item</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
          </div>
          <div className="mb-4">
            <p className="text-white font-medium">{item.card_name}</p>
            <p className="text-gray-400 text-sm">Current: {item.location?.name}</p>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">Move To *</label>
              <select value={newLocationId} onChange={(e) => setNewLocationId(e.target.value)} required>
                <option value="">Select location...</option>
                {locations.filter(l => l.id !== item.location_id).map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
              </select>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
              <button type="submit" className="btn btn-primary flex-1" disabled={submitting || !newLocationId}>
                {submitting ? <div className="spinner w-5 h-5 border-2"></div> : 'Move'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
