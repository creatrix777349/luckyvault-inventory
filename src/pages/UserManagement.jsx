import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { ToastContainer, useToast } from '../components/Toast'
import { Users, Plus, Edit2, Trash2, Save, X, UserPlus } from 'lucide-react'

export default function UserManagement() {
  const { toasts, addToast, removeToast } = useToast()
  
  const [users, setUsers] = useState([])
  const [locations, setLocations] = useState([])
  const [userRooms, setUserRooms] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', role: '' })
  
  const [newUser, setNewUser] = useState({
    name: '',
    role: 'Streamer',
    rooms: []
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [usersRes, locationsRes, roomsRes] = await Promise.all([
        supabase
          .from('users')
          .select('*')
          .order('name'),
        supabase
          .from('locations')
          .select('*')
          .eq('active', true)
          .ilike('name', '%Stream Room%')
          .order('name'),
        supabase
          .from('user_rooms')
          .select('*, location:locations(name)')
      ])
      
      setUsers(usersRes.data || [])
      setLocations(locationsRes.data || [])
      setUserRooms(roomsRes.data || [])
    } catch (error) {
      console.error('Error loading data:', error)
      addToast('Failed to load data', 'error')
    } finally {
      setLoading(false)
    }
  }

  const getUserRooms = (userId) => {
    return userRooms.filter(ur => ur.user_id === userId)
  }

  const handleAddUser = async (e) => {
    e.preventDefault()
    
    if (!newUser.name.trim()) {
      addToast('Please enter a name', 'error')
      return
    }

    setSubmitting(true)
    try {
      // Create user
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          name: newUser.name.trim(),
          role: newUser.role,
          active: true,
          can_login: false
        })
        .select()
        .single()

      if (userError) throw userError

      // Add room assignments
      if (newUser.rooms.length > 0) {
        const roomAssignments = newUser.rooms.map(locId => ({
          user_id: userData.id,
          location_id: locId
        }))
        
        const { error: roomError } = await supabase
          .from('user_rooms')
          .insert(roomAssignments)
        
        if (roomError) console.error('Error adding rooms:', roomError)
      }

      addToast('User added!')
      setNewUser({ name: '', role: 'Streamer', rooms: [] })
      setShowAddForm(false)
      loadData()
    } catch (error) {
      console.error('Error adding user:', error)
      if (error.message?.includes('duplicate')) {
        addToast('A user with this name already exists', 'error')
      } else {
        addToast('Failed to add user', 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = (user) => {
    setEditingId(user.id)
    setEditForm({ name: user.name, role: user.role || 'Streamer' })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({ name: '', role: '' })
  }

  const saveEdit = async (userId) => {
    if (!editForm.name.trim()) {
      addToast('Name cannot be empty', 'error')
      return
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ name: editForm.name.trim(), role: editForm.role })
        .eq('id', userId)

      if (error) throw error

      addToast('User updated!')
      setEditingId(null)
      loadData()
    } catch (error) {
      console.error('Error updating user:', error)
      addToast('Failed to update user', 'error')
    }
  }

  const toggleUserActive = async (user) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ active: !user.active })
        .eq('id', user.id)

      if (error) throw error

      addToast(user.active ? 'User deactivated' : 'User activated')
      loadData()
    } catch (error) {
      console.error('Error toggling user:', error)
      addToast('Failed to update user', 'error')
    }
  }

  const addRoomToUser = async (userId, locationId) => {
    try {
      const { error } = await supabase
        .from('user_rooms')
        .insert({ user_id: userId, location_id: locationId })

      if (error) {
        if (error.message?.includes('duplicate')) {
          addToast('User already assigned to this room', 'error')
        } else {
          throw error
        }
      } else {
        addToast('Room assigned!')
        loadData()
      }
    } catch (error) {
      console.error('Error adding room:', error)
      addToast('Failed to assign room', 'error')
    }
  }

  const removeRoomFromUser = async (userRoomId) => {
    try {
      const { error } = await supabase
        .from('user_rooms')
        .delete()
        .eq('id', userRoomId)

      if (error) throw error

      addToast('Room removed')
      loadData()
    } catch (error) {
      console.error('Error removing room:', error)
      addToast('Failed to remove room', 'error')
    }
  }

  const toggleNewUserRoom = (locId) => {
    setNewUser(u => ({
      ...u,
      rooms: u.rooms.includes(locId)
        ? u.rooms.filter(id => id !== locId)
        : [...u.rooms, locId]
    }))
  }

  const activeUsers = users.filter(u => u.active)
  const inactiveUsers = users.filter(u => !u.active)

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
      
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="font-display text-2xl font-bold text-white flex items-center gap-3">
            <Users className="text-blue-400" />
            Team Management
          </h1>
          <p className="text-gray-400 mt-1">Manage streamers and room assignments</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn btn-primary"
        >
          <UserPlus size={18} /> Add Streamer
        </button>
      </div>

      {/* Add New User Form */}
      {showAddForm && (
        <div className="card mb-6 border-blue-500/30">
          <h2 className="font-display text-lg font-semibold text-white mb-4">Add New Streamer</h2>
          
          <form onSubmit={handleAddUser} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Name *</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser(u => ({ ...u, name: e.target.value }))}
                  placeholder="e.g., Michelle"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser(u => ({ ...u, role: e.target.value }))}
                >
                  <option value="Streamer">Streamer</option>
                  <option value="Counter">Counter</option>
                  <option value="Admin">Admin</option>
                  <option value="Manager">Manager</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Assign to Rooms</label>
              <div className="flex flex-wrap gap-2">
                {locations.map(loc => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => toggleNewUserRoom(loc.id)}
                    className={`px-3 py-1 rounded-lg text-sm transition-all ${
                      newUser.rooms.includes(loc.id)
                        ? 'bg-blue-500 text-white'
                        : 'bg-vault-dark text-gray-400 hover:text-white'
                    }`}
                  >
                    {loc.name.replace('Stream Room - ', '')}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? <div className="spinner w-5 h-5 border-2"></div> : <><Plus size={18} /> Add Streamer</>}
              </button>
              <button type="button" onClick={() => setShowAddForm(false)} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active Users */}
      <div className="card mb-6">
        <h2 className="font-display text-lg font-semibold text-white mb-4">
          Active Team Members ({activeUsers.length})
        </h2>
        
        {activeUsers.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No active team members</p>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Assigned Rooms</th>
                  <th className="w-32">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeUsers.map(user => {
                  const isEditing = editingId === user.id
                  const rooms = getUserRooms(user.id)
                  
                  return (
                    <tr key={user.id}>
                      <td>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                            className="py-1 px-2 text-sm w-full"
                          />
                        ) : (
                          <span className="font-medium text-white">{user.name}</span>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <select
                            value={editForm.role}
                            onChange={(e) => setEditForm(f => ({ ...f, role: e.target.value }))}
                            className="py-1 px-2 text-sm"
                          >
                            <option value="Streamer">Streamer</option>
                            <option value="Counter">Counter</option>
                            <option value="Admin">Admin</option>
                            <option value="Manager">Manager</option>
                          </select>
                        ) : (
                          <span className={`badge ${
                            user.role === 'Admin' ? 'badge-warning' :
                            user.role === 'Manager' ? 'badge-info' : 'badge-secondary'
                          }`}>
                            {user.role || 'Streamer'}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1 items-center">
                          {rooms.map(ur => (
                            <span 
                              key={ur.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-vault-dark rounded text-xs text-gray-300"
                            >
                              {ur.location?.name?.replace('Stream Room - ', '')}
                              <button
                                onClick={() => removeRoomFromUser(ur.id)}
                                className="text-gray-500 hover:text-red-400"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                          <div className="relative group">
                            <button className="p-1 text-gray-500 hover:text-blue-400">
                              <Plus size={14} />
                            </button>
                            <div className="absolute left-0 top-full mt-1 bg-vault-darker border border-vault-border rounded-lg shadow-lg z-10 hidden group-hover:block min-w-[150px]">
                              {locations
                                .filter(loc => !rooms.find(r => r.location_id === loc.id))
                                .map(loc => (
                                  <button
                                    key={loc.id}
                                    onClick={() => addRoomToUser(user.id, loc.id)}
                                    className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-vault-surface"
                                  >
                                    {loc.name.replace('Stream Room - ', '')}
                                  </button>
                                ))}
                              {locations.filter(loc => !rooms.find(r => r.location_id === loc.id)).length === 0 && (
                                <div className="px-3 py-2 text-gray-500 text-sm">All rooms assigned</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => saveEdit(user.id)} className="p-1 text-green-400 hover:text-green-300" title="Save">
                              <Save size={16} />
                            </button>
                            <button onClick={cancelEdit} className="p-1 text-gray-400 hover:text-white" title="Cancel">
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button onClick={() => startEdit(user)} className="p-1 text-gray-500 hover:text-white" title="Edit">
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => toggleUserActive(user)} 
                              className="p-1 text-gray-500 hover:text-red-400" 
                              title="Deactivate"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inactive Users */}
      {inactiveUsers.length > 0 && (
        <div className="card opacity-75">
          <h2 className="font-display text-lg font-semibold text-gray-400 mb-4">
            Inactive ({inactiveUsers.length})
          </h2>
          
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th className="w-32">Actions</th>
                </tr>
              </thead>
              <tbody>
                {inactiveUsers.map(user => (
                  <tr key={user.id} className="opacity-60">
                    <td className="text-gray-400">{user.name}</td>
                    <td className="text-gray-500">{user.role || 'Streamer'}</td>
                    <td>
                      <button 
                        onClick={() => toggleUserActive(user)} 
                        className="text-sm text-blue-400 hover:text-blue-300"
                      >
                        Reactivate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
