import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { ToastContainer, useToast } from '../components/Toast'
import { BarChart3, Calendar, CalendarRange, CalendarDays, ShoppingCart, Receipt, FileText, Filter, ClipboardList, DollarSign, Package, History } from 'lucide-react'

export default function Reports() {
  const { toasts, addToast, removeToast } = useToast()
  
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('stream_counts') // 'stream_counts', 'storefront_sales', 'acquisitions', 'expenses', 'summary', 'inventory_catalog', 'inventory_history'
  const [dateMode, setDateMode] = useState('single') // 'single', 'range', 'weekly'
  const [singleDate, setSingleDate] = useState(new Date().toISOString().split('T')[0])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reportData, setReportData] = useState(null)
  const [countryFilter, setCountryFilter] = useState('') // Source country filter
  
  // Product catalog and history data
  const [productCatalog, setProductCatalog] = useState([])
  const [inventoryHistory, setInventoryHistory] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(false)

  // Auto-load today's report on mount
  useEffect(() => {
    loadReport()
  }, [])

  const getWeekDates = (date) => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(d.setDate(diff))
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    return {
      start: monday.toISOString().split('T')[0],
      end: sunday.toISOString().split('T')[0]
    }
  }

  const getDateRange = () => {
    if (dateMode === 'single') {
      return { start: singleDate, end: singleDate }
    } else if (dateMode === 'range') {
      if (!startDate || !endDate) return null
      return { start: startDate, end: endDate }
    } else if (dateMode === 'weekly') {
      return getWeekDates(singleDate)
    }
    return null
  }

  const loadReport = async () => {
    const dates = getDateRange()
    if (!dates) {
      addToast('Please select valid dates', 'error')
      return
    }

    setLoading(true)
    
    try {
      const { start, end } = dates

      // Fetch acquisitions with full details
      const { data: acquisitions, error: acqError } = await supabase
        .from('acquisitions')
        .select(`
          *,
          acquirer:users!acquirer_id(name),
          vendor:vendors(name),
          product:products(brand, type, name, language, category)
        `)
        .gte('date_purchased', start)
        .lte('date_purchased', end)
        .order('date_purchased', { ascending: false })

      if (acqError) throw acqError

      // Fetch business expenses
      let expenses = []
      try {
        const { data: expData, error: expError } = await supabase
          .from('business_expenses')
          .select('*, payment_method:payment_methods(name)')
          .gte('date', start)
          .lte('date', end)
          .order('date', { ascending: false })
        if (expData && !expError) expenses = expData
      } catch (e) {
        console.log('Business expenses table may not exist yet')
      }

      // Fetch stream counts
      let streamCounts = []
      let streamCountItems = []
      try {
        const startDateTime = `${start}T00:00:00`
        const endDateTime = `${end}T23:59:59`
        
        const { data: countsData, error: countsError } = await supabase
          .from('stream_counts')
          .select(`
            *,
            location:locations(name),
            streamer:users!stream_counts_streamer_id_fkey(name),
            counted_by:users!stream_counts_counted_by_id_fkey(name)
          `)
          .gte('count_time', startDateTime)
          .lte('count_time', endDateTime)
          .order('count_time', { ascending: false })
        
        if (countsData && !countsError) {
          streamCounts = countsData
          
          // Fetch all items for these counts
          if (countsData.length > 0) {
            const countIds = countsData.map(c => c.id)
            const { data: itemsData, error: itemsError } = await supabase
              .from('stream_count_items')
              .select(`
                *,
                product:products(name, brand, type)
              `)
              .in('stream_count_id', countIds)
            
            if (itemsData && !itemsError) {
              streamCountItems = itemsData
            }
          }
        }
      } catch (e) {
        console.log('Stream counts tables may not exist yet')
      }

      // Get unique source countries for filter dropdown
      const countries = [...new Set(acquisitions?.map(a => a.source_country).filter(Boolean))]

      // Calculate totals
      const totalAcquisitionsCost = acquisitions?.reduce((sum, a) => sum + (a.cost_usd || 0), 0) || 0
      const totalExpensesCost = expenses?.reduce((sum, e) => sum + (e.amount_usd || 0), 0) || 0
      const totalItems = acquisitions?.reduce((sum, a) => sum + (a.quantity_purchased || 0), 0) || 0

      // Stream counts totals
      const totalUnitsSold = streamCounts.reduce((sum, c) => sum + (c.total_sold || 0), 0)
      const totalDiscrepancies = streamCounts.reduce((sum, c) => sum + (c.total_discrepancies || 0), 0)

      // Group stream counts by streamer
      const salesByStreamer = streamCounts.reduce((acc, c) => {
        const name = c.streamer?.name || 'Unknown'
        if (!acc[name]) acc[name] = { counts: 0, sold: 0, discrepancies: 0 }
        acc[name].counts += 1
        acc[name].sold += c.total_sold || 0
        acc[name].discrepancies += c.total_discrepancies || 0
        return acc
      }, {})

      // Group stream counts by room
      const salesByRoom = streamCounts.reduce((acc, c) => {
        const name = c.location?.name?.replace('Stream Room - ', '') || 'Unknown'
        if (!acc[name]) acc[name] = { counts: 0, sold: 0, discrepancies: 0 }
        acc[name].counts += 1
        acc[name].sold += c.total_sold || 0
        acc[name].discrepancies += c.total_discrepancies || 0
        return acc
      }, {})

      // Group sold items by product
      const soldByProduct = streamCountItems
        .filter(item => item.difference < 0)
        .reduce((acc, item) => {
          const name = item.product?.name || 'Unknown'
          const brand = item.product?.brand || 'Unknown'
          const key = `${brand}|${name}`
          if (!acc[key]) acc[key] = { name, brand, sold: 0 }
          acc[key].sold += Math.abs(item.difference)
          return acc
        }, {})

      // Group acquisitions by acquirer for summary
      const byAcquirer = acquisitions?.reduce((acc, a) => {
        const name = a.acquirer?.name || 'Unknown'
        if (!acc[name]) acc[name] = { count: 0, total: 0 }
        acc[name].count += a.quantity_purchased || 0
        acc[name].total += a.cost_usd || 0
        return acc
      }, {}) || {}

      // Group by brand
      const byBrand = acquisitions?.reduce((acc, a) => {
        const brand = a.product?.brand || 'Unknown'
        if (!acc[brand]) acc[brand] = { count: 0, total: 0 }
        acc[brand].count += a.quantity_purchased || 0
        acc[brand].total += a.cost_usd || 0
        return acc
      }, {}) || {}

      // Group by source country
      const byCountry = acquisitions?.reduce((acc, a) => {
        const country = a.source_country || 'Unknown'
        if (!acc[country]) acc[country] = { count: 0, total: 0 }
        acc[country].count += a.quantity_purchased || 0
        acc[country].total += a.cost_usd || 0
        return acc
      }, {}) || {}

      // Group expenses by category
      const expensesByCategory = expenses?.reduce((acc, e) => {
        const cat = e.category || 'other'
        if (!acc[cat]) acc[cat] = { count: 0, total: 0 }
        acc[cat].count += 1
        acc[cat].total += e.amount_usd || 0
        return acc
      }, {}) || {}

      // Fetch storefront sales
      let storefrontSales = []
      try {
        const { data: salesData, error: salesError } = await supabase
          .from('storefront_sales')
          .select(`
            *,
            product:products(brand, type, name, language, category),
            location:locations(name)
          `)
          .gte('date', start)
          .lte('date', end)
          .order('date', { ascending: false })
        if (salesData && !salesError) storefrontSales = salesData
      } catch (e) {
        console.log('Storefront sales table may not exist yet')
      }

      // Calculate storefront sales totals
      const totalStorefrontSales = storefrontSales.reduce((sum, s) => sum + (s.sale_price || 0), 0)
      const totalStorefrontProfit = storefrontSales.reduce((sum, s) => sum + (s.profit || 0), 0)
      const totalStorefrontCost = storefrontSales.reduce((sum, s) => sum + (s.cost_basis || 0), 0)

      setReportData({
        dateRange: { start, end },
        acquisitions: acquisitions || [],
        expenses: expenses || [],
        streamCounts,
        streamCountItems,
        storefrontSales,
        totalStorefrontSales,
        totalStorefrontProfit,
        totalStorefrontCost,
        countries,
        totalAcquisitionsCost,
        totalExpensesCost,
        grandTotal: totalAcquisitionsCost + totalExpensesCost,
        totalItems,
        totalUnitsSold,
        totalDiscrepancies,
        salesByStreamer,
        salesByRoom,
        soldByProduct,
        byAcquirer,
        byBrand,
        byCountry,
        expensesByCategory
      })
    } catch (error) {
      console.error('Error loading report:', error)
      addToast('Failed to load report', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Load all products (catalog)
  const loadProductCatalog = async () => {
    if (productCatalog.length > 0) return // Already loaded
    setCatalogLoading(true)
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('brand')
        .order('type')
        .order('name')
      
      if (error) throw error
      setProductCatalog(data || [])
    } catch (error) {
      console.error('Error loading product catalog:', error)
      addToast('Failed to load product catalog', 'error')
    } finally {
      setCatalogLoading(false)
    }
  }

  // Load inventory history (all inventory records including zero qty)
  const loadInventoryHistory = async () => {
    if (inventoryHistory.length > 0) return // Already loaded
    setCatalogLoading(true)
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          *,
          product:products(id, brand, type, name, category, language),
          location:locations(id, name)
        `)
        .order('updated_at', { ascending: false })
      
      if (error) throw error
      setInventoryHistory(data || [])
    } catch (error) {
      console.error('Error loading inventory history:', error)
      addToast('Failed to load inventory history', 'error')
    } finally {
      setCatalogLoading(false)
    }
  }

  const formatDateRange = () => {
    if (!reportData?.dateRange) return ''
    const { start, end } = reportData.dateRange
    if (start === end) return start
    return `${start} to ${end}`
  }

  const formatCurrency = (amount, currency = 'USD') => {
    if (currency === 'JPY') return `¥${amount?.toLocaleString() || 0}`
    if (currency === 'RMB') return `¥${amount?.toLocaleString() || 0}`
    return `$${amount?.toFixed(2) || '0.00'}`
  }

  // Filter acquisitions by country
  const filteredAcquisitions = reportData?.acquisitions?.filter(a => {
    if (!countryFilter) return true
    return a.source_country === countryFilter
  }) || []

  // Recalculate filtered totals
  const filteredTotalCost = filteredAcquisitions.reduce((sum, a) => sum + (a.cost_usd || 0), 0)
  const filteredTotalItems = filteredAcquisitions.reduce((sum, a) => sum + (a.quantity_purchased || 0), 0)

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-white flex items-center gap-3">
          <BarChart3 className="text-vault-gold" />
          Reports
        </h1>
        <p className="text-gray-400 mt-1">View acquisitions, expenses, and summaries</p>
      </div>

      {/* Date Selection */}
      <div className="card mb-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Date Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Date Selection</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDateMode('single')}
                className={`p-3 rounded-lg border-2 transition-all text-center ${
                  dateMode === 'single'
                    ? 'border-vault-gold bg-vault-gold/10 text-vault-gold'
                    : 'border-vault-border bg-vault-dark text-gray-400 hover:border-gray-500'
                }`}
              >
                <Calendar className="mx-auto mb-1" size={20} />
                <p className="text-xs font-medium">Single Day</p>
              </button>
              <button
                type="button"
                onClick={() => setDateMode('range')}
                className={`p-3 rounded-lg border-2 transition-all text-center ${
                  dateMode === 'range'
                    ? 'border-vault-gold bg-vault-gold/10 text-vault-gold'
                    : 'border-vault-border bg-vault-dark text-gray-400 hover:border-gray-500'
                }`}
              >
                <CalendarRange className="mx-auto mb-1" size={20} />
                <p className="text-xs font-medium">Date Range</p>
              </button>
              <button
                type="button"
                onClick={() => setDateMode('weekly')}
                className={`p-3 rounded-lg border-2 transition-all text-center ${
                  dateMode === 'weekly'
                    ? 'border-vault-gold bg-vault-gold/10 text-vault-gold'
                    : 'border-vault-border bg-vault-dark text-gray-400 hover:border-gray-500'
                }`}
              >
                <CalendarDays className="mx-auto mb-1" size={20} />
                <p className="text-xs font-medium">Weekly</p>
              </button>
            </div>
          </div>

          {/* Date Inputs */}
          <div className="flex items-end gap-3">
            {dateMode === 'single' && (
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-300 mb-2">Date</label>
                <input
                  type="date"
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                />
              </div>
            )}
            
            {dateMode === 'range' && (
              <>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Start</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-300 mb-2">End</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </>
            )}
            
            {dateMode === 'weekly' && (
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Any day in week
                  <span className="text-gray-500 text-xs ml-2">
                    ({getWeekDates(singleDate).start} to {getWeekDates(singleDate).end})
                  </span>
                </label>
                <input
                  type="date"
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                />
              </div>
            )}

            <button onClick={loadReport} className="btn btn-primary" disabled={loading}>
              {loading ? <div className="spinner w-5 h-5 border-2"></div> : 'Generate'}
            </button>
          </div>
        </div>
      </div>

      {/* Report Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="spinner"></div>
        </div>
      ) : reportData ? (
        <>
          {/* Date Header */}
          <div className="mb-4 text-center">
            <p className="text-gray-400">
              Report for: <span className="text-white font-medium">{formatDateRange()}</span>
            </p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            <div className="card">
              <p className="text-gray-400 text-sm">Units Sold</p>
              <p className="font-display text-2xl font-bold text-green-400">
                {reportData.totalUnitsSold?.toLocaleString() || 0}
              </p>
              <p className="text-gray-500 text-xs">{reportData.streamCounts?.length || 0} counts</p>
            </div>
            <div className="card">
              <p className="text-gray-400 text-sm">Storefront Sales</p>
              <p className="font-display text-2xl font-bold text-green-400">
                ${reportData.totalStorefrontSales?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
              </p>
              <p className={`text-xs ${reportData.totalStorefrontProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {reportData.totalStorefrontProfit >= 0 ? '+' : ''}${reportData.totalStorefrontProfit?.toFixed(2) || '0.00'} profit
              </p>
            </div>
            <div className="card">
              <p className="text-gray-400 text-sm">Acquisitions</p>
              <p className="font-display text-2xl font-bold text-vault-gold">
                ${reportData.totalAcquisitionsCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <p className="text-gray-500 text-xs">{reportData.totalItems} items</p>
            </div>
            <div className="card">
              <p className="text-gray-400 text-sm">Expenses</p>
              <p className="font-display text-2xl font-bold text-purple-400">
                ${reportData.totalExpensesCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <p className="text-gray-500 text-xs">{reportData.expenses.length} entries</p>
            </div>
            <div className="card">
              <p className="text-gray-400 text-sm">Total Spent</p>
              <p className="font-display text-2xl font-bold text-white">
                ${reportData.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="card">
              <p className="text-gray-400 text-sm">Discrepancies</p>
              <p className={`font-display text-2xl font-bold ${reportData.totalDiscrepancies > 0 ? 'text-amber-400' : 'text-gray-500'}`}>
                {reportData.totalDiscrepancies || 0}
              </p>
              <p className="text-gray-500 text-xs">needs review</p>
            </div>
          </div>

          {/* Report Tabs */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <button
              onClick={() => setActiveTab('stream_counts')}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${
                activeTab === 'stream_counts'
                  ? 'bg-vault-gold text-vault-dark'
                  : 'bg-vault-surface text-gray-400 hover:text-white'
              }`}
            >
              <ClipboardList size={18} />
              Stream Counts ({reportData.streamCounts?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('storefront_sales')}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${
                activeTab === 'storefront_sales'
                  ? 'bg-vault-gold text-vault-dark'
                  : 'bg-vault-surface text-gray-400 hover:text-white'
              }`}
            >
              <DollarSign size={18} />
              Storefront Sales ({reportData.storefrontSales?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('acquisitions')}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${
                activeTab === 'acquisitions'
                  ? 'bg-vault-gold text-vault-dark'
                  : 'bg-vault-surface text-gray-400 hover:text-white'
              }`}
            >
              <ShoppingCart size={18} />
              Acquisitions ({reportData.acquisitions.length})
            </button>
            <button
              onClick={() => setActiveTab('expenses')}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${
                activeTab === 'expenses'
                  ? 'bg-vault-gold text-vault-dark'
                  : 'bg-vault-surface text-gray-400 hover:text-white'
              }`}
            >
              <Receipt size={18} />
              Expenses ({reportData.expenses.length})
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${
                activeTab === 'summary'
                  ? 'bg-vault-gold text-vault-dark'
                  : 'bg-vault-surface text-gray-400 hover:text-white'
              }`}
            >
              <FileText size={18} />
              Summary
            </button>
            <button
              onClick={() => { setActiveTab('inventory_catalog'); loadProductCatalog(); }}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${
                activeTab === 'inventory_catalog'
                  ? 'bg-vault-gold text-vault-dark'
                  : 'bg-vault-surface text-gray-400 hover:text-white'
              }`}
            >
              <Package size={18} />
              Product Catalog
            </button>
            <button
              onClick={() => { setActiveTab('inventory_history'); loadInventoryHistory(); }}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${
                activeTab === 'inventory_history'
                  ? 'bg-vault-gold text-vault-dark'
                  : 'bg-vault-surface text-gray-400 hover:text-white'
              }`}
            >
              <History size={18} />
              Inventory History
            </button>
          </div>

          {/* Stream Counts Tab */}
          {activeTab === 'stream_counts' && (
            <div className="space-y-6">
              {/* Sales by Streamer */}
              {Object.keys(reportData.salesByStreamer || {}).length > 0 && (
                <div className="card">
                  <h3 className="font-display text-lg font-semibold text-white mb-4">Sales by Streamer</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Streamer</th>
                        <th className="text-right">Counts</th>
                        <th className="text-right">Units Sold</th>
                        <th className="text-right">Discrepancies</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(reportData.salesByStreamer)
                        .sort((a, b) => b[1].sold - a[1].sold)
                        .map(([name, data]) => (
                          <tr key={name}>
                            <td className="font-medium text-white">{name}</td>
                            <td className="text-right text-gray-400">{data.counts}</td>
                            <td className="text-right text-green-400 font-medium">{data.sold}</td>
                            <td className="text-right">
                              {data.discrepancies > 0 ? (
                                <span className="text-amber-400">+{data.discrepancies}</span>
                              ) : (
                                <span className="text-gray-500">0</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      <tr className="border-t-2 border-vault-border">
                        <td className="font-semibold text-white">TOTAL</td>
                        <td className="text-right font-semibold text-gray-400">
                          {Object.values(reportData.salesByStreamer).reduce((sum, d) => sum + d.counts, 0)}
                        </td>
                        <td className="text-right font-bold text-green-400 text-lg">
                          {reportData.totalUnitsSold}
                        </td>
                        <td className="text-right font-medium text-amber-400">
                          {reportData.totalDiscrepancies > 0 ? `+${reportData.totalDiscrepancies}` : '0'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Sales by Room */}
              {Object.keys(reportData.salesByRoom || {}).length > 0 && (
                <div className="card">
                  <h3 className="font-display text-lg font-semibold text-white mb-4">Sales by Stream Room</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Room</th>
                        <th className="text-right">Counts</th>
                        <th className="text-right">Units Sold</th>
                        <th className="text-right">Discrepancies</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(reportData.salesByRoom)
                        .sort((a, b) => b[1].sold - a[1].sold)
                        .map(([name, data]) => (
                          <tr key={name}>
                            <td className="font-medium text-white">{name}</td>
                            <td className="text-right text-gray-400">{data.counts}</td>
                            <td className="text-right text-green-400 font-medium">{data.sold}</td>
                            <td className="text-right">
                              {data.discrepancies > 0 ? (
                                <span className="text-amber-400">+{data.discrepancies}</span>
                              ) : (
                                <span className="text-gray-500">0</span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Top Selling Products */}
              {Object.keys(reportData.soldByProduct || {}).length > 0 && (
                <div className="card">
                  <h3 className="font-display text-lg font-semibold text-white mb-4">Products Sold</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Brand</th>
                        <th className="text-right">Units Sold</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(reportData.soldByProduct)
                        .sort((a, b) => b.sold - a.sold)
                        .map((item, idx) => (
                          <tr key={idx}>
                            <td className="font-medium text-white">{item.name}</td>
                            <td>
                              <span className={`badge ${item.brand === 'Pokemon' ? 'badge-warning' : 'badge-info'}`}>
                                {item.brand}
                              </span>
                            </td>
                            <td className="text-right text-green-400 font-medium">{item.sold}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Individual Count Records */}
              <div className="card">
                <h3 className="font-display text-lg font-semibold text-white mb-4">Count Records</h3>
                {(reportData.streamCounts?.length || 0) === 0 ? (
                  <p className="text-gray-400 text-center py-8">No stream counts in this period</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table>
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Room</th>
                          <th>Streamer</th>
                          <th>Counted By</th>
                          <th className="text-right">Sold</th>
                          <th className="text-right">Discrepancy</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.streamCounts.map(count => (
                          <tr key={count.id}>
                            <td className="text-gray-400">
                              {new Date(count.count_time).toLocaleString([], { 
                                month: 'short', 
                                day: 'numeric',
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </td>
                            <td className="font-medium text-white">
                              {count.location?.name?.replace('Stream Room - ', '')}
                            </td>
                            <td className="text-gray-300">{count.streamer?.name}</td>
                            <td className="text-gray-400">{count.counted_by?.name}</td>
                            <td className="text-right text-green-400 font-medium">{count.total_sold}</td>
                            <td className="text-right">
                              {count.total_discrepancies > 0 ? (
                                <span className="text-amber-400">+{count.total_discrepancies}</span>
                              ) : (
                                <span className="text-gray-500">0</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Acquisitions Tab - Individual entries at actual purchase price */}
          {activeTab === 'acquisitions' && (
            <div className="card">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-display text-lg font-semibold text-white">
                  Acquisitions Detail
                  <span className="text-gray-500 text-sm font-normal ml-2">(actual purchase prices)</span>
                </h3>
                
                {/* Country Filter */}
                {reportData.countries.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Filter size={16} className="text-gray-400" />
                    <select
                      value={countryFilter}
                      onChange={(e) => setCountryFilter(e.target.value)}
                      className="text-sm py-1"
                    >
                      <option value="">All Countries</option>
                      {reportData.countries.map(country => (
                        <option key={country} value={country}>{country}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Filtered totals banner */}
              {countryFilter && (
                <div className="bg-vault-dark p-3 rounded-lg mb-4 flex justify-between items-center">
                  <span className="text-gray-400">
                    Filtered: <span className="text-white font-medium">{countryFilter}</span>
                  </span>
                  <span className="text-vault-gold font-bold">
                    {filteredTotalItems} items • ${filteredTotalCost.toFixed(2)}
                  </span>
                </div>
              )}

              {filteredAcquisitions.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No acquisitions in this period</p>
              ) : (
                <div className="overflow-x-auto">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Product</th>
                        <th>Source</th>
                        <th>Acquirer</th>
                        <th>Vendor</th>
                        <th className="text-right">Qty</th>
                        <th className="text-right">Cost</th>
                        <th className="text-right">USD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAcquisitions.map(acq => (
                        <tr key={acq.id}>
                          <td className="text-gray-400">{acq.date_purchased}</td>
                          <td>
                            <div className="font-medium text-white">{acq.product?.name}</div>
                            <div className="text-gray-500 text-xs">
                              {acq.product?.brand} • {acq.product?.type} • {acq.product?.language}
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${
                              acq.source_country === 'Japan' ? 'badge-info' :
                              acq.source_country === 'China' ? 'badge-warning' :
                              acq.source_country === 'USA' ? 'badge-success' :
                              'badge-secondary'
                            }`}>
                              {acq.source_country || '-'}
                            </span>
                          </td>
                          <td className="text-gray-300">{acq.acquirer?.name || '-'}</td>
                          <td className="text-gray-400">{acq.vendor?.name || '-'}</td>
                          <td className="text-right">{acq.quantity_purchased}</td>
                          <td className="text-right text-gray-300">
                            {formatCurrency(acq.cost, acq.currency)}
                          </td>
                          <td className="text-right text-vault-gold font-medium">
                            ${acq.cost_usd?.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      {/* Total Row */}
                      <tr className="border-t-2 border-vault-border">
                        <td colSpan={5} className="font-semibold text-white">TOTAL</td>
                        <td className="text-right font-semibold text-white">{filteredTotalItems}</td>
                        <td></td>
                        <td className="text-right font-bold text-vault-gold text-lg">
                          ${filteredTotalCost.toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Storefront Sales Tab */}
          {activeTab === 'storefront_sales' && (
            <div className="card">
              <h3 className="font-display text-lg font-semibold text-white mb-4">
                Storefront Sales Detail
              </h3>
              
              {/* Summary row */}
              <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-vault-dark rounded-lg">
                <div>
                  <p className="text-gray-400 text-xs">Total Sales</p>
                  <p className="text-green-400 font-bold">${reportData.totalStorefrontSales?.toFixed(2) || '0.00'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Cost Basis</p>
                  <p className="text-gray-300 font-bold">${reportData.totalStorefrontCost?.toFixed(2) || '0.00'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Profit</p>
                  <p className={`font-bold ${reportData.totalStorefrontProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {reportData.totalStorefrontProfit >= 0 ? '+' : ''}${reportData.totalStorefrontProfit?.toFixed(2) || '0.00'}
                  </p>
                </div>
              </div>

              {reportData.storefrontSales?.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No storefront sales in this period</p>
              ) : (
                <div className="overflow-x-auto">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Product/Details</th>
                        <th className="text-right">Qty</th>
                        <th className="text-right">Sale Price</th>
                        <th className="text-right">Cost</th>
                        <th className="text-right">Profit</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.storefrontSales.map(sale => (
                        <tr key={sale.id}>
                          <td className="text-gray-400">{sale.date}</td>
                          <td>
                            <span className={`badge ${
                              sale.sale_type === 'Bulk' ? 'badge-secondary' : 'badge-success'
                            }`}>
                              {sale.sale_type}
                            </span>
                          </td>
                          <td>
                            {sale.product ? (
                              <div>
                                <div className="font-medium text-white">{sale.product.name}</div>
                                <div className="text-gray-500 text-xs">
                                  {sale.product.brand} • {sale.product.type} • {sale.product.language}
                                </div>
                              </div>
                            ) : (
                              <div className="text-gray-300">
                                {sale.brand} - {sale.product_type}
                              </div>
                            )}
                          </td>
                          <td className="text-right">{sale.quantity}</td>
                          <td className="text-right text-green-400 font-medium">
                            ${sale.sale_price?.toFixed(2)}
                          </td>
                          <td className="text-right text-gray-400">
                            {sale.cost_basis ? `$${sale.cost_basis.toFixed(2)}` : '-'}
                          </td>
                          <td className={`text-right font-medium ${
                            sale.profit >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {sale.profit != null ? (
                              <>{sale.profit >= 0 ? '+' : ''}${sale.profit.toFixed(2)}</>
                            ) : '-'}
                          </td>
                          <td className="text-gray-500 text-sm max-w-[150px] truncate">
                            {sale.notes || '-'}
                          </td>
                        </tr>
                      ))}
                      {/* Total Row */}
                      <tr className="border-t-2 border-vault-border">
                        <td colSpan={4} className="font-semibold text-white">TOTAL</td>
                        <td className="text-right font-bold text-green-400 text-lg">
                          ${reportData.totalStorefrontSales?.toFixed(2)}
                        </td>
                        <td className="text-right font-bold text-gray-400">
                          ${reportData.totalStorefrontCost?.toFixed(2)}
                        </td>
                        <td className={`text-right font-bold text-lg ${
                          reportData.totalStorefrontProfit >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {reportData.totalStorefrontProfit >= 0 ? '+' : ''}${reportData.totalStorefrontProfit?.toFixed(2)}
                        </td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Expenses Tab */}
          {activeTab === 'expenses' && (
            <div className="card">
              <h3 className="font-display text-lg font-semibold text-white mb-4">
                Business Expenses Detail
              </h3>
              {reportData.expenses.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No expenses in this period</p>
              ) : (
                <div className="overflow-x-auto">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Category</th>
                        <th>Description</th>
                        <th>Payment Method</th>
                        <th>Notes</th>
                        <th className="text-right">Amount</th>
                        <th className="text-right">USD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.expenses.map(exp => (
                        <tr key={exp.id}>
                          <td className="text-gray-400">{exp.date}</td>
                          <td>
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                              exp.category === 'shipping' ? 'bg-blue-500/20 text-blue-400' :
                              exp.category === 'office' ? 'bg-purple-500/20 text-purple-400' :
                              exp.category === 'utilities' ? 'bg-yellow-500/20 text-yellow-400' :
                              exp.category === 'food' ? 'bg-green-500/20 text-green-400' :
                              exp.category === 'travel' ? 'bg-orange-500/20 text-orange-400' :
                              'bg-gray-500/20 text-gray-400'
                            }`}>
                              {exp.category}
                            </span>
                          </td>
                          <td className="font-medium text-white">{exp.description}</td>
                          <td className="text-gray-300">{exp.payment_method?.name || '-'}</td>
                          <td className="text-gray-500 text-sm">{exp.notes || '-'}</td>
                          <td className="text-right text-gray-300">
                            {formatCurrency(exp.amount, exp.currency)}
                          </td>
                          <td className="text-right text-purple-400 font-medium">
                            ${exp.amount_usd?.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      {/* Total Row */}
                      <tr className="border-t-2 border-vault-border">
                        <td colSpan={6} className="font-semibold text-white">TOTAL</td>
                        <td className="text-right font-bold text-purple-400 text-lg">
                          ${reportData.totalExpensesCost.toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Summary Tab */}
          {activeTab === 'summary' && (
            <div className="space-y-6">
              {/* By Source Country */}
              {Object.keys(reportData.byCountry).length > 0 && (
                <div className="card">
                  <h3 className="font-display text-lg font-semibold text-white mb-4">Acquisitions by Source Country</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Country</th>
                        <th className="text-right">Items</th>
                        <th className="text-right">Total Spent (USD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(reportData.byCountry)
                        .sort((a, b) => b[1].total - a[1].total)
                        .map(([name, data]) => (
                          <tr key={name}>
                            <td className="font-medium text-white">{name}</td>
                            <td className="text-right">{data.count}</td>
                            <td className="text-right text-vault-gold">${data.total.toFixed(2)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* By Acquirer */}
              {Object.keys(reportData.byAcquirer).length > 0 && (
                <div className="card">
                  <h3 className="font-display text-lg font-semibold text-white mb-4">Acquisitions by Acquirer</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Acquirer</th>
                        <th className="text-right">Items</th>
                        <th className="text-right">Total Spent (USD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(reportData.byAcquirer)
                        .sort((a, b) => b[1].total - a[1].total)
                        .map(([name, data]) => (
                          <tr key={name}>
                            <td className="font-medium text-white">{name}</td>
                            <td className="text-right">{data.count}</td>
                            <td className="text-right text-vault-gold">${data.total.toFixed(2)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* By Brand */}
              {Object.keys(reportData.byBrand).length > 0 && (
                <div className="card">
                  <h3 className="font-display text-lg font-semibold text-white mb-4">Acquisitions by Brand</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Brand</th>
                        <th className="text-right">Items</th>
                        <th className="text-right">Total Spent (USD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(reportData.byBrand)
                        .sort((a, b) => b[1].total - a[1].total)
                        .map(([name, data]) => (
                          <tr key={name}>
                            <td className="font-medium text-white">{name}</td>
                            <td className="text-right">{data.count}</td>
                            <td className="text-right text-vault-gold">${data.total.toFixed(2)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Expenses by Category */}
              {Object.keys(reportData.expensesByCategory).length > 0 && (
                <div className="card">
                  <h3 className="font-display text-lg font-semibold text-white mb-4">Expenses by Category</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th className="text-right">Entries</th>
                        <th className="text-right">Total (USD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(reportData.expensesByCategory)
                        .sort((a, b) => b[1].total - a[1].total)
                        .map(([cat, data]) => (
                          <tr key={cat}>
                            <td className="font-medium text-white capitalize">{cat}</td>
                            <td className="text-right">{data.count}</td>
                            <td className="text-right text-purple-400">${data.total.toFixed(2)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Product Catalog Tab */}
          {activeTab === 'inventory_catalog' && (
            <div className="card">
              <h3 className="font-display text-lg font-semibold text-white mb-4">
                Product Catalog ({productCatalog.length} products)
              </h3>
              <p className="text-gray-400 text-sm mb-4">Master list of all products in the system</p>
              
              {catalogLoading ? (
                <div className="flex justify-center py-8">
                  <div className="spinner"></div>
                </div>
              ) : productCatalog.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No products found</p>
              ) : (
                <div className="overflow-x-auto">
                  <table>
                    <thead>
                      <tr>
                        <th>Brand</th>
                        <th>Type</th>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Language</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productCatalog.map(product => (
                        <tr key={product.id}>
                          <td>
                            <span className={`badge ${
                              product.brand === 'Pokemon' ? 'badge-warning' : 
                              product.brand === 'One Piece' ? 'badge-info' : 'badge-secondary'
                            }`}>
                              {product.brand}
                            </span>
                          </td>
                          <td className="text-gray-300">{product.type}</td>
                          <td className="font-medium text-white">{product.name}</td>
                          <td className="text-gray-400">{product.category}</td>
                          <td>
                            <span className={`badge ${
                              product.language === 'JP' ? 'badge-info' : 
                              product.language === 'CN' ? 'badge-warning' : 'badge-secondary'
                            }`}>
                              {product.language}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Inventory History Tab */}
          {activeTab === 'inventory_history' && (
            <div className="card">
              <h3 className="font-display text-lg font-semibold text-white mb-4">
                Inventory History ({inventoryHistory.length} records)
              </h3>
              <p className="text-gray-400 text-sm mb-4">All inventory records including sold out items</p>
              
              {catalogLoading ? (
                <div className="flex justify-center py-8">
                  <div className="spinner"></div>
                </div>
              ) : inventoryHistory.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No inventory history found</p>
              ) : (
                <div className="overflow-x-auto">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Location</th>
                        <th className="text-right">Quantity</th>
                        <th className="text-right">Avg Cost</th>
                        <th>Last Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryHistory.map(inv => (
                        <tr key={inv.id} className={inv.quantity === 0 ? 'opacity-50' : ''}>
                          <td>
                            <div className="font-medium text-white">{inv.product?.name}</div>
                            <div className="text-gray-500 text-xs">
                              {inv.product?.brand} • {inv.product?.type} • {inv.product?.language}
                            </div>
                          </td>
                          <td className="text-gray-300">{inv.location?.name || '-'}</td>
                          <td className={`text-right font-medium ${inv.quantity === 0 ? 'text-red-400' : 'text-white'}`}>
                            {inv.quantity}
                          </td>
                          <td className="text-right text-vault-gold">
                            {inv.avg_cost_basis ? `$${inv.avg_cost_basis.toFixed(2)}` : '-'}
                          </td>
                          <td className="text-gray-500 text-sm">
                            {inv.updated_at ? new Date(inv.updated_at).toLocaleDateString() : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="card text-center py-12">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-400">Loading today's report...</p>
        </div>
      )}
    </div>
  )
}
