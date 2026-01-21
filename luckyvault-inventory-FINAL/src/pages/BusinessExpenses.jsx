import React, { useState, useEffect } from 'react'
import { 
  supabase,
  fetchPaymentMethods,
  convertToUSD
} from '../lib/supabase'
import { ToastContainer, useToast } from '../components/Toast'
import { Receipt, Save, DollarSign, Truck, Building, Utensils, Plane, MoreHorizontal } from 'lucide-react'

const EXPENSE_CATEGORIES = [
  { id: 'shipping', name: 'Shipping', icon: Truck, color: 'text-blue-400' },
  { id: 'office', name: 'Office Expenses', icon: Building, color: 'text-purple-400' },
  { id: 'utilities', name: 'Utilities', icon: Building, color: 'text-cyan-400' },
  { id: 'food', name: 'Food & Meals', icon: Utensils, color: 'text-orange-400' },
  { id: 'travel', name: 'Travel', icon: Plane, color: 'text-green-400' },
  { id: 'other', name: 'Other', icon: MoreHorizontal, color: 'text-gray-400' }
]

export default function BusinessExpenses() {
  const { toasts, addToast, removeToast } = useToast()
  
  const [paymentMethods, setPaymentMethods] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: '',
    amount: '',
    currency: 'USD',
    payment_method_id: '',
    description: '',
    notes: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [pmData, expenseData] = await Promise.all([
        fetchPaymentMethods(),
        supabase
          .from('business_expenses')
          .select('*')
          .order('date', { ascending: false })
          .limit(20)
      ])
      
      setPaymentMethods(pmData)
      if (expenseData.data) {
        setExpenses(expenseData.data)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      // Table might not exist yet, that's okay
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!form.category || !form.amount || !form.description) {
      addToast('Please fill all required fields', 'error')
      return
    }

    setSubmitting(true)

    try {
      const amountUSD = convertToUSD(parseFloat(form.amount), form.currency)
      
      const expenseData = {
        date: form.date,
        category: form.category,
        amount: parseFloat(form.amount),
        currency: form.currency,
        amount_usd: amountUSD,
        payment_method_id: form.payment_method_id || null,
        description: form.description,
        notes: form.notes || null
      }
      
      const { data, error } = await supabase
        .from('business_expenses')
        .insert(expenseData)
        .select()
        .single()

      if (error) throw error

      addToast('Expense recorded successfully!')
      
      // Add to local list
      setExpenses([data, ...expenses])
      
      // Reset form
      setForm(f => ({
        ...f,
        category: '',
        amount: '',
        description: '',
        notes: ''
      }))
    } catch (error) {
      console.error('Error recording expense:', error)
      // If table doesn't exist, show helpful message
      if (error.message?.includes('does not exist')) {
        addToast('Please run the SQL setup to create the business_expenses table', 'error')
      } else {
        addToast('Failed to record expense', 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const getCategoryInfo = (categoryId) => {
    return EXPENSE_CATEGORIES.find(c => c.id === categoryId) || EXPENSE_CATEGORIES[5]
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
          <Receipt className="text-purple-400" />
          Business Expenses
        </h1>
        <p className="text-gray-400 mt-1">Track shipping, office, utilities, food, and travel expenses</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Add Expense Form */}
        <form onSubmit={handleSubmit} className="card">
          <h2 className="font-display text-lg font-semibold text-white mb-4">Record Expense</h2>
          
          {/* Date */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">Date *</label>
            <input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
              required
            />
          </div>

          {/* Category Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">Category *</label>
            <div className="grid grid-cols-3 gap-2">
              {EXPENSE_CATEGORIES.map(cat => {
                const Icon = cat.icon
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, category: cat.id }))}
                    className={`p-3 rounded-lg border-2 transition-all text-center ${
                      form.category === cat.id
                        ? 'border-vault-gold bg-vault-gold/10'
                        : 'border-vault-border bg-vault-dark hover:border-gray-500'
                    }`}
                  >
                    <Icon className={`mx-auto mb-1 ${form.category === cat.id ? 'text-vault-gold' : cat.color}`} size={20} />
                    <p className={`text-xs font-medium ${form.category === cat.id ? 'text-vault-gold' : 'text-gray-400'}`}>
                      {cat.name}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Amount & Currency */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Amount *</label>
              <input
                type="number"
                name="amount"
                value={form.amount}
                onChange={handleChange}
                min="0"
                step="0.01"
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Currency *</label>
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

          {/* Payment Method */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">Payment Method</label>
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

          {/* Description */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">Description *</label>
            <input
              type="text"
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="What was this expense for?"
              required
            />
          </div>

          {/* Notes */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">Notes</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={2}
              placeholder="Additional details..."
            />
          </div>

          {/* Submit */}
          <button 
            type="submit" 
            className="btn btn-primary w-full"
            disabled={submitting || !form.category || !form.amount}
          >
            {submitting ? (
              <div className="spinner w-5 h-5 border-2"></div>
            ) : (
              <>
                <Save size={20} />
                Record Expense
              </>
            )}
          </button>
        </form>

        {/* Recent Expenses */}
        <div className="card">
          <h2 className="font-display text-lg font-semibold text-white mb-4">Recent Expenses</h2>
          
          {expenses.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="mx-auto text-gray-600 mb-4" size={48} />
              <p className="text-gray-400">No expenses recorded yet</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {expenses.map(expense => {
                const catInfo = getCategoryInfo(expense.category)
                const Icon = catInfo.icon
                return (
                  <div 
                    key={expense.id}
                    className="p-3 bg-vault-dark rounded-lg border border-vault-border"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-vault-surface ${catInfo.color}`}>
                          <Icon size={16} />
                        </div>
                        <div>
                          <p className="text-white font-medium text-sm">{expense.description}</p>
                          <p className="text-gray-500 text-xs">{catInfo.name} • {expense.date}</p>
                        </div>
                      </div>
                      <p className="text-vault-gold font-semibold">
                        ${expense.amount_usd?.toFixed(2) || expense.amount?.toFixed(2)}
                      </p>
                    </div>
                    {expense.notes && (
                      <p className="text-gray-500 text-xs mt-2 pl-11">{expense.notes}</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
