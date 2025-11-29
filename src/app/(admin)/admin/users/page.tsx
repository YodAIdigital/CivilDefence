'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useRole } from '@/contexts/auth-context'
import type { Profile, UserRole } from '@/types/database'
import { Search, UserCog, Shield, ShieldCheck, User, Loader2 } from 'lucide-react'

export default function UsersManagementPage() {
  const { isSuperAdmin } = useRole()
  const [users, setUsers] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)

  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (err) {
      console.error('Error fetching users:', err)
      setError('Failed to load users')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    if (!isSuperAdmin && (newRole === 'super_admin' || newRole === 'admin')) {
      setError('Only super admins can assign admin roles')
      return
    }

    try {
      setUpdatingUserId(userId)
      setError(null)

      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) throw error

      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
      setSuccess(`User role updated to ${newRole}`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error updating user role:', err)
      setError('Failed to update user role')
    } finally {
      setUpdatingUserId(null)
    }
  }

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return <ShieldCheck className="h-4 w-4 text-purple-500" />
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-500" />
      case 'member':
        return <User className="h-4 w-4 text-green-500" />
      default:
        return <User className="h-4 w-4 text-gray-500" />
    }
  }

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-100 text-purple-800'
      case 'admin':
        return 'bg-blue-100 text-blue-800'
      case 'member':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">
            Manage user accounts and permissions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <UserCog className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{users.length} users</span>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50 text-green-800">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            View and manage all registered users. {isSuperAdmin ? 'As a super admin, you can assign any role.' : 'As an admin, you can manage member roles.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by email or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No users found.</p>
          ) : (
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-sm font-medium">User</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Role</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Joined</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium">{user.full_name || 'Unnamed User'}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                          {getRoleIcon(user.role)}
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {updatingUserId === user.id ? (
                          <Loader2 className="ml-auto h-4 w-4 animate-spin" />
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            {user.role !== 'public' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => updateUserRole(user.id, 'public')}
                                disabled={!isSuperAdmin && user.role === 'admin'}
                              >
                                Set Public
                              </Button>
                            )}
                            {user.role !== 'member' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => updateUserRole(user.id, 'member')}
                                disabled={!isSuperAdmin && user.role === 'admin'}
                              >
                                Set Member
                              </Button>
                            )}
                            {isSuperAdmin && user.role !== 'admin' && user.role !== 'super_admin' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => updateUserRole(user.id, 'admin')}
                              >
                                Set Admin
                              </Button>
                            )}
                            {isSuperAdmin && user.role !== 'super_admin' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-purple-600 hover:text-purple-700"
                                onClick={() => updateUserRole(user.id, 'super_admin')}
                              >
                                Set Super Admin
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Role Permissions</CardTitle>
          <CardDescription>Overview of what each role can do</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-5 w-5 text-gray-500" />
                <h3 className="font-semibold">Public</h3>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>View public alerts</li>
                <li>View public resources</li>
                <li>Browse public communities</li>
              </ul>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-5 w-5 text-green-500" />
                <h3 className="font-semibold">Member</h3>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>All public permissions</li>
                <li>Join communities</li>
                <li>Create personal checklists</li>
                <li>Acknowledge alerts</li>
              </ul>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-5 w-5 text-blue-500" />
                <h3 className="font-semibold">Admin</h3>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>All member permissions</li>
                <li>Create communities</li>
                <li>Manage community members</li>
                <li>Create & manage alerts</li>
                <li>Manage resources</li>
              </ul>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="h-5 w-5 text-purple-500" />
                <h3 className="font-semibold">Super Admin</h3>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>All admin permissions</li>
                <li>Manage all users</li>
                <li>Assign admin roles</li>
                <li>System settings</li>
                <li>View audit logs</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
