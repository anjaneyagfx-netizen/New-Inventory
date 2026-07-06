import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { LayoutDashboard, Package, ShoppingCart, ShoppingBag, FolderOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import Header from '../components/Header';

const HomePage = () => {
  const features = [
    { icon: LayoutDashboard, title: 'Dashboard', description: 'Get a comprehensive overview of your inventory metrics, recent transactions, and key performance indicators at a glance.' },
    { icon: Package, title: 'Inventory Management', description: 'Track stock levels, manage product details, and receive alerts for low inventory items to maintain optimal stock.' },
    { icon: ShoppingCart, title: 'Sales Tracking', description: 'Record sales transactions, generate bill numbers, and automatically update inventory levels with each sale.' },
    { icon: ShoppingBag, title: 'Purchase Tracking', description: 'Log purchase orders, track incoming stock, and automatically update inventory quantities upon receipt.' },
    { icon: FolderOpen, title: 'Category Management', description: 'Organize your inventory with custom categories for better product classification and streamlined operations.' },
  ];

  return (
    <>
      <Helmet>
        <title>Inventory Management System - Streamline Your Operations</title>
      </Helmet>

      <Header />

      <div className="min-h-screen">
        <section className="relative min-h-[calc(100dvh-64px)] flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          </div>

          <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6">
                <Package className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">Multi-warehouse ready</span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6 text-balance" style={{ letterSpacing: '-0.02em' }}>
                Inventory Management System
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
                Streamline your inventory operations with real-time tracking, automated stock updates, and comprehensive reporting tools.
              </p>
              <Link to="/login">
                <Button size="lg" className="text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-shadow duration-200 active:scale-[0.98]">
                  Login with Username / Password
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>

        <section className="py-20 bg-muted/50">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">
                Everything you need to manage inventory
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Powerful features designed to simplify your inventory workflow
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.08 }}
                    viewport={{ once: true }}
                  >
                    <Card className="h-full hover:shadow-lg transition-shadow duration-200">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className="p-3 bg-primary/10 rounded-xl">
                            <Icon className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                            <p className="text-muted-foreground leading-relaxed">
                              {feature.description}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        <footer className="py-12 border-t bg-card text-card-foreground">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                <span className="font-semibold">Inventory Manager</span>
              </div>
              <p className="text-sm">© 2026 Inventory Manager. All rights reserved.</p>
              <div className="flex gap-6 text-sm">
                <span className="hover:underline cursor-pointer">Privacy Policy</span>
                <span className="hover:underline cursor-pointer">Terms of Service</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default HomePage;
