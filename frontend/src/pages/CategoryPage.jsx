import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import Header from '../components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { FolderOpen, Plus, Pencil, Trash2, Loader2, Save, X } from 'lucide-react';
import { toast } from 'sonner';

const CategoryPage = () => {
  const { currentWarehouse, canEditData } = useAuth();
  const canEdit = canEditData();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!currentWarehouse) return;
    try {
      setLoading(true);
      const data = await api.get('/categories', { params: { warehouse_id: currentWarehouse.id } }).then((r) => r.data);
      setCategories(data);
    } catch { toast.error('Failed to load categories'); }
    finally { setLoading(false); }
  }, [currentWarehouse]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Enter a name');
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/categories/${editing.id}`, { name, warehouse_id: currentWarehouse.id });
        toast.success('Category updated');
      } else {
        await api.post('/categories', { name, warehouse_id: currentWarehouse.id });
        toast.success('Category created');
      }
      setName('');
      setEditing(null);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/categories/${toDelete.id}`);
      toast.success('Category deleted');
      setToDelete(null);
      fetchData();
    } catch { toast.error('Delete failed'); }
    finally { setDeleting(false); }
  };

  return (
    <>
      <Helmet><title>Categories - StockFlow System</title></Helmet>
      <Header />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => { if (!o && !deleting) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>Items in <strong>"{toDelete?.name}"</strong> will become uncategorized. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmDelete(); }} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting...</>) : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
            <p className="text-muted-foreground mt-1">Organize inventory for {currentWarehouse?.name}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className={`shadow-sm border-border/50 ${!canEdit ? 'lg:col-span-3' : 'lg:col-span-2'}`}>
            <CardHeader className="bg-muted/30 border-b pb-4">
              <CardTitle className="text-lg">All Categories</CardTitle>
              <CardDescription>{categories.length} categories in this warehouse</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {loading ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-muted/50 rounded animate-pulse" />)}</div>
              ) : categories.length === 0 ? (
                <div className="text-center py-12 border border-dashed rounded-lg bg-muted/20">
                  <FolderOpen className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground font-medium">No categories yet. Create one to get started.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {categories.map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:shadow-sm transition-shadow">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-md"><FolderOpen className="w-4 h-4 text-primary" /></div>
                        <span className="font-medium">{c.name}</span>
                      </div>
                      {canEdit && (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setName(c.name); }} className="h-8 w-8"><Pencil className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => setToDelete(c)} className="h-8 w-8 text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {canEdit && (
            <Card className="shadow-sm border-border/50 h-fit sticky top-[88px]">
              <CardHeader className="bg-muted/30 border-b pb-4">
                <CardTitle>{editing ? 'Edit Category' : 'Create Category'}</CardTitle>
                <CardDescription>Group your items</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="catname">Category Name *</Label>
                    <Input id="catname" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aluminum" required />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1" disabled={saving}>
                      {saving ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>) : (<>{editing ? <Save className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}{editing ? 'Update' : 'Create'}</>)}
                    </Button>
                    {editing && (<Button type="button" variant="outline" onClick={() => { setEditing(null); setName(''); }}><X className="w-4 h-4" /></Button>)}
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
};

export default CategoryPage;
