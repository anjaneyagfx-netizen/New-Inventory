import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import Header from '../components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '../components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Warehouse, Users, Plus, Pencil, Trash2, Save, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

const SettingsPage = () => {
  const { currentUser, canManageUsers, canManageWarehouses, refreshWarehouses } = useAuth();
  const canWH = canManageWarehouses();
  const canU = canManageUsers();

  const [warehouses, setWarehouses] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [whModal, setWhModal] = useState({ open: false, editing: null, name: '', location: '' });
  const [userModal, setUserModal] = useState({ open: false, editing: null, username: '', email: '', password: '', role: 'staff', warehouse_ids: [] });
  const [saving, setSaving] = useState(false);

  const [toDeleteWH, setToDeleteWH] = useState(null);
  const [toDeleteUser, setToDeleteUser] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [ws, us] = await Promise.all([
        api.get('/warehouses').then((r) => r.data),
        canU ? api.get('/users').then((r) => r.data) : Promise.resolve([]),
      ]);
      setWarehouses(ws);
      setUsers(us);
    } catch { toast.error('Failed to load settings'); }
    finally { setLoading(false); }
  }, [canU]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveWH = async () => {
    if (!whModal.name.trim()) return toast.error('Name required');
    setSaving(true);
    try {
      if (whModal.editing) {
        await api.put(`/warehouses/${whModal.editing.id}`, { name: whModal.name, location: whModal.location });
        toast.success('Warehouse updated');
      } else {
        await api.post('/warehouses', { name: whModal.name, location: whModal.location });
        toast.success('Warehouse created');
      }
      setWhModal({ open: false, editing: null, name: '', location: '' });
      await refreshWarehouses();
      fetchData();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setSaving(false); }
  };

  const confirmDeleteWH = async () => {
    if (!toDeleteWH) return;
    setDeleting(true);
    try {
      await api.delete(`/warehouses/${toDeleteWH.id}`);
      toast.success('Warehouse deleted');
      setToDeleteWH(null);
      await refreshWarehouses();
      fetchData();
    } catch { toast.error('Delete failed'); }
    finally { setDeleting(false); }
  };

  const saveUser = async () => {
    if (!userModal.username.trim()) return toast.error('Username required');
    if (!userModal.editing && !userModal.password.trim()) return toast.error('Password required');
    setSaving(true);
    try {
      if (userModal.editing) {
        const payload = { email: userModal.email, role: userModal.role, warehouse_ids: userModal.warehouse_ids };
        if (userModal.password) payload.password = userModal.password;
        await api.put(`/users/${userModal.editing.id}`, payload);
        toast.success('User updated');
      } else {
        await api.post('/users', {
          username: userModal.username, email: userModal.email, password: userModal.password,
          role: userModal.role, warehouse_ids: userModal.warehouse_ids,
        });
        toast.success('User created');
      }
      setUserModal({ open: false, editing: null, username: '', email: '', password: '', role: 'staff', warehouse_ids: [] });
      fetchData();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setSaving(false); }
  };

  const confirmDeleteUser = async () => {
    if (!toDeleteUser) return;
    setDeleting(true);
    try {
      await api.delete(`/users/${toDeleteUser.id}`);
      toast.success('User deleted');
      setToDeleteUser(null);
      fetchData();
    } catch { toast.error('Delete failed'); }
    finally { setDeleting(false); }
  };

  return (
    <>
      <Helmet><title>Settings - StockFlow System</title></Helmet>
      <Header />

      {/* Warehouse Modal */}
      <Dialog open={whModal.open} onOpenChange={(o) => !saving && setWhModal({ ...whModal, open: o })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{whModal.editing ? 'Edit Warehouse' : 'Create Warehouse'}</DialogTitle>
            <DialogDescription>Manage your warehouse locations</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={whModal.name} onChange={(e) => setWhModal({ ...whModal, name: e.target.value })} placeholder="e.g. Main Warehouse" />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={whModal.location} onChange={(e) => setWhModal({ ...whModal, location: e.target.value })} placeholder="City / Address" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWhModal({ open: false, editing: null, name: '', location: '' })} disabled={saving}>Cancel</Button>
            <Button onClick={saveWH} disabled={saving}>
              {saving ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>) : (<><Save className="w-4 h-4 mr-2" />Save</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Modal */}
      <Dialog open={userModal.open} onOpenChange={(o) => !saving && setUserModal({ ...userModal, open: o })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{userModal.editing ? 'Edit User' : 'Create User'}</DialogTitle>
            <DialogDescription>Manage user access and roles</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Username *</Label>
              <Input value={userModal.username} onChange={(e) => setUserModal({ ...userModal, username: e.target.value })} disabled={!!userModal.editing} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={userModal.email} onChange={(e) => setUserModal({ ...userModal, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{userModal.editing ? 'New Password (optional)' : 'Password *'}</Label>
              <Input type="password" value={userModal.password} onChange={(e) => setUserModal({ ...userModal, password: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={userModal.role} onValueChange={(v) => setUserModal({ ...userModal, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff (view-only)</SelectItem>
                  <SelectItem value="manager">Manager (edit data)</SelectItem>
                  <SelectItem value="owner">Owner (full access)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assigned Warehouses</Label>
              <div className="space-y-2 border rounded-lg p-3 max-h-40 overflow-y-auto">
                {warehouses.map((w) => (
                  <label key={w.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={userModal.warehouse_ids.includes(w.id)}
                      onCheckedChange={(c) => {
                        const next = c ? [...userModal.warehouse_ids, w.id] : userModal.warehouse_ids.filter((x) => x !== w.id);
                        setUserModal({ ...userModal, warehouse_ids: next });
                      }}
                    />
                    <span>{w.name}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Owners automatically get access to all warehouses.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserModal({ open: false, editing: null, username: '', email: '', password: '', role: 'staff', warehouse_ids: [] })} disabled={saving}>Cancel</Button>
            <Button onClick={saveUser} disabled={saving}>
              {saving ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>) : (<><Save className="w-4 h-4 mr-2" />Save</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDeleteWH} onOpenChange={(o) => { if (!o && !deleting) setToDeleteWH(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete warehouse?</AlertDialogTitle>
            <AlertDialogDescription>This will delete <strong>"{toDeleteWH?.name}"</strong> and ALL its items, categories, sales, and purchases. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmDeleteWH(); }} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting...</>) : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!toDeleteUser} onOpenChange={(o) => { if (!o && !deleting) setToDeleteUser(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove <strong>{toDeleteUser?.username}</strong>.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmDeleteUser(); }} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting...</>) : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage warehouses and users. Role: <Badge variant="secondary">{currentUser?.role}</Badge></p>
        </div>

        <Tabs defaultValue="warehouses">
          <TabsList className="mb-6">
            <TabsTrigger value="warehouses"><Warehouse className="w-4 h-4 mr-2" /> Warehouses</TabsTrigger>
            {canU && <TabsTrigger value="users"><Users className="w-4 h-4 mr-2" /> Users</TabsTrigger>}
          </TabsList>

          <TabsContent value="warehouses">
            <Card className="shadow-sm border-border/50">
              <CardHeader className="bg-muted/30 border-b pb-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">All Warehouses</CardTitle>
                  <CardDescription>{warehouses.length} warehouses configured</CardDescription>
                </div>
                {canWH && (
                  <Button onClick={() => setWhModal({ open: true, editing: null, name: '', location: '' })}>
                    <Plus className="w-4 h-4 mr-2" /> New Warehouse
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="space-y-3 p-6">{[1, 2].map((i) => <div key={i} className="h-12 bg-muted/50 rounded animate-pulse" />)}</div>
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/10">
                      <TableRow>
                        <TableHead className="pl-6">Name</TableHead>
                        <TableHead>Location</TableHead>
                        {canWH && <TableHead className="text-right pr-6">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {warehouses.map((w) => (
                        <TableRow key={w.id}>
                          <TableCell className="pl-6 font-medium">{w.name}</TableCell>
                          <TableCell className="text-muted-foreground">{w.location || '—'}</TableCell>
                          {canWH && (
                            <TableCell className="text-right pr-6">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => setWhModal({ open: true, editing: w, name: w.name, location: w.location || '' })} className="h-8 w-8"><Pencil className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => setToDeleteWH(w)} className="h-8 w-8 text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4" /></Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {canU && (
            <TabsContent value="users">
              <Card className="shadow-sm border-border/50">
                <CardHeader className="bg-muted/30 border-b pb-4 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">User Management</CardTitle>
                    <CardDescription>{users.length} users</CardDescription>
                  </div>
                  <Button onClick={() => setUserModal({ open: true, editing: null, username: '', email: '', password: '', role: 'staff', warehouse_ids: [] })}>
                    <Plus className="w-4 h-4 mr-2" /> New User
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="space-y-3 p-6">{[1, 2].map((i) => <div key={i} className="h-12 bg-muted/50 rounded animate-pulse" />)}</div>
                  ) : (
                    <Table>
                      <TableHeader className="bg-muted/10">
                        <TableRow>
                          <TableHead className="pl-6">Username</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Warehouses</TableHead>
                          <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell className="pl-6 font-medium">{u.username}</TableCell>
                            <TableCell className="text-muted-foreground">{u.email || '—'}</TableCell>
                            <TableCell>
                              <Badge variant={u.role === 'owner' ? 'default' : u.role === 'manager' ? 'secondary' : 'outline'}>
                                {u.role}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {u.role === 'owner' ? 'All' : (u.warehouse_ids || []).length}
                            </TableCell>
                            <TableCell className="text-right pr-6">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => setUserModal({ open: true, editing: u, username: u.username, email: u.email || '', password: '', role: u.role, warehouse_ids: u.warehouse_ids || [] })} className="h-8 w-8"><Pencil className="w-4 h-4" /></Button>
                                {u.id !== currentUser?.id && (
                                  <Button variant="ghost" size="icon" onClick={() => setToDeleteUser(u)} className="h-8 w-8 text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4" /></Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </>
  );
};

export default SettingsPage;
