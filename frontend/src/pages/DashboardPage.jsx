import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import Header from '../components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Package, TrendingUp, TrendingDown, FolderOpen, AlertTriangle, ArrowUpRight } from 'lucide-react';

const DashboardPage = () => {
  const { currentUser, currentWarehouse } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total_items: 0, total_stock: 0, low_stock_count: 0, total_categories: 0 });
  const [recentSales, setRecentSales] = useState([]);
  const [recentPurchases, setRecentPurchases] = useState([]);

  const fetchData = useCallback(async () => {
    if (!currentWarehouse) return;
    try {
      setLoading(true);
      const { data } = await api.get('/dashboard', { params: { warehouse_id: currentWarehouse.id } });
      setStats({
        total_items: data.total_items,
        total_stock: data.total_stock,
        low_stock_count: data.low_stock_count,
        total_categories: data.total_categories,
      });
      setRecentSales(data.recent_sales || []);
      setRecentPurchases(data.recent_purchases || []);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [currentWarehouse]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const StatCard = ({ icon: Icon, title, value, iconColor, onClick, className }) => (
    <Card onClick={onClick} className={`transition-shadow duration-200 border-border/50 shadow-sm ${className || ''}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-2 tabular-nums">{value}</p>
          </div>
          <div className={`p-3 rounded-xl ${iconColor}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <>
      <Helmet><title>Dashboard - StockFlow System</title></Helmet>
      <Header />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-balance">Welcome, {currentUser?.username}</h1>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              Viewing data for <Badge variant="secondary">{currentWarehouse?.name || 'No warehouse'}</Badge>
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard icon={Package} title="Total Inventory Items" value={stats.total_items} iconColor="bg-primary/10 text-primary" />
            <StatCard icon={TrendingUp} title="Total Stock Units" value={stats.total_stock} iconColor="bg-accent/10 text-accent" />
            <StatCard
              icon={AlertTriangle}
              title="Low Stock Items"
              value={stats.low_stock_count}
              iconColor="bg-destructive/10 text-destructive"
              onClick={() => navigate('/inventory?filter=lowStock')}
              className="cursor-pointer hover:-translate-y-0.5 hover:shadow-md"
            />
            <StatCard icon={FolderOpen} title="Categories" value={stats.total_categories} iconColor="bg-secondary/40 text-secondary-foreground" />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-destructive" /> Recent Sales
                </CardTitle>
                <CardDescription>Latest outbound transactions</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/sales')} className="h-8 text-xs">
                View all <ArrowUpRight className="ml-1 w-3 h-3" />
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3 mt-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
              ) : recentSales.length === 0 ? (
                <div className="text-center py-10 bg-muted/20 rounded-lg mt-4 border border-dashed">
                  <p className="text-sm font-medium text-muted-foreground">No sales recorded yet</p>
                </div>
              ) : (
                <Table className="mt-4">
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Bill No</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentSales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="text-xs whitespace-nowrap text-muted-foreground">{new Date(sale.date).toLocaleDateString()}</TableCell>
                        <TableCell className="font-medium text-sm">{sale.bill_number}</TableCell>
                        <TableCell className="text-sm">{sale.item_name || 'N/A'}</TableCell>
                        <TableCell className="text-right text-sm font-medium">₹{Number(sale.total_price || 0).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" /> Recent Purchases
                </CardTitle>
                <CardDescription>Latest inbound inventory</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/purchases')} className="h-8 text-xs">
                View all <ArrowUpRight className="ml-1 w-3 h-3" />
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3 mt-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
              ) : recentPurchases.length === 0 ? (
                <div className="text-center py-10 bg-muted/20 rounded-lg mt-4 border border-dashed">
                  <p className="text-sm font-medium text-muted-foreground">No purchases recorded yet</p>
                </div>
              ) : (
                <Table className="mt-4">
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Bill No</TableHead>
                      <TableHead>Item</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentPurchases.map((purchase) => (
                      <TableRow key={purchase.id}>
                        <TableCell className="text-xs whitespace-nowrap text-muted-foreground">{new Date(purchase.date).toLocaleDateString()}</TableCell>
                        <TableCell className="font-medium text-sm">{purchase.bill_number}</TableCell>
                        <TableCell className="text-sm">{purchase.item_name || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default DashboardPage;
