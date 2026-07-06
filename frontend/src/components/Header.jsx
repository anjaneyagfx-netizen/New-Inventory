import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from './ui/sheet';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Menu, User, LogOut, LayoutDashboard, Package, ShoppingCart,
  ShoppingBag, FolderOpen, Settings, Warehouse,
} from 'lucide-react';

const Header = () => {
  const { currentUser, currentWarehouse, availableWarehouses, isAuthenticated, logout, switchWarehouse } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/inventory', label: 'Inventory', icon: Package },
    { to: '/sales', label: 'Sales', icon: ShoppingCart },
    { to: '/purchases', label: 'Purchases', icon: ShoppingBag },
    { to: '/categories', label: 'Categories', icon: FolderOpen },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const isActive = (path) => location.pathname === path;

  const NavLinks = ({ mobile = false }) => (
    <>
      {navLinks.map((link) => {
        const Icon = link.icon;
        return (
          <Link
            key={link.to}
            to={link.to}
            onClick={() => mobile && setMobileOpen(false)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors duration-200 ${
              isActive(link.to)
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Icon className="w-4 h-4" />
            {link.label}
          </Link>
        );
      })}
    </>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link to={isAuthenticated ? '/dashboard' : '/'} className="flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            <span className="text-xl font-bold tracking-tight">StockFlow</span>
          </Link>

          {isAuthenticated && (
            <>
              <nav className="hidden md:flex items-center gap-1">
                <NavLinks />
              </nav>

              <div className="flex items-center gap-4">
                {availableWarehouses.length > 0 && (
                  <div className="hidden lg:flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-lg border border-border/50">
                    <Warehouse className="w-4 h-4 text-muted-foreground" />
                    <Select value={currentWarehouse?.id || ''} onValueChange={switchWarehouse}>
                      <SelectTrigger className="h-8 border-0 bg-transparent shadow-none focus:ring-0 font-medium min-w-[150px]">
                        <SelectValue placeholder="Select warehouse" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableWarehouses.map((w) => (
                          <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full bg-muted/50 hover:bg-muted border border-border/50">
                      <User className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 p-2">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-semibold leading-none">{currentUser?.username}</p>
                        <p className="text-xs text-muted-foreground leading-none">{currentUser?.email}</p>
                        <p className="text-xs text-primary leading-none mt-2 font-medium uppercase tracking-wider">{currentUser?.role}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer rounded-md">
                      <LogOut className="w-4 h-4 mr-2" /> Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                  <SheetTrigger asChild className="md:hidden">
                    <Button variant="ghost" size="icon"><Menu className="w-5 h-5" /></Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[80vw] sm:w-[350px]">
                    <SheetHeader className="mb-6 text-left">
                      <SheetTitle>Navigation Menu</SheetTitle>
                    </SheetHeader>
                    <div className="mb-6 space-y-3">
                      {availableWarehouses.length > 0 && (
                        <div className="space-y-2 p-3 bg-muted/30 rounded-xl border border-border/50">
                          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Active Warehouse</p>
                          <Select value={currentWarehouse?.id || ''} onValueChange={switchWarehouse}>
                            <SelectTrigger className="w-full bg-background">
                              <SelectValue placeholder="Select warehouse" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableWarehouses.map((w) => (
                                <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    <nav className="flex flex-col gap-1"><NavLinks mobile /></nav>
                  </SheetContent>
                </Sheet>
              </div>
            </>
          )}

          {!isAuthenticated && (
            <Link to="/login">
              <Button>Sign In</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
