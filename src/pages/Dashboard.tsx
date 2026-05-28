import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { Shop, MenuItem } from "@/types";
import { Store, Clock, ArrowRight, Sparkles, Brain, Plus } from "lucide-react";
import { toast } from "sonner";

interface RecommendedItem extends MenuItem {
  aiReason?: string;
  score?: number;
}

const Dashboard: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const { addToCart } = useCart();
  const [shopsList, setShopsList] = useState<Shop[]>([]);
  const [recs, setRecs] = useState<RecommendedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "student") return;

    const loadDashboardData = async () => {
      try {
        const token = localStorage.getItem("token");
        
        // 1. Fetch Shops
        const shopsRes = await fetch("http://localhost:5000/api/shops");
        if (shopsRes.ok) {
          const data = await shopsRes.json();
          setShopsList(data);
        }

        // 2. Fetch AI Recommendations
        const recsRes = await fetch("http://localhost:5000/api/ai/recommendations", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (recsRes.ok) {
          const data = await recsRes.json();
          setRecs(data);
        }
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [isAuthenticated, user]);

  if (!isAuthenticated || user?.role !== "student") {
    return <Navigate to="/login" replace />;
  }

  const handleQuickAdd = (item: RecommendedItem) => {
    const formattedItem: MenuItem = {
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      image: item.image,
      category: item.category,
      available: item.available,
      preparationTime: item.preparationTime,
      shopId: item.shopId
    };
    addToCart(formattedItem);
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              Hey, <span className="gradient-text">{user.name?.split(" ")[0]}</span>! 👋
            </h1>
            <p className="text-muted-foreground">
              Choose a canteen shop to start ordering
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-xl border border-primary/20 animate-pulse text-sm text-primary font-semibold">
            <Sparkles className="h-4 w-4" />
            AI Assistant Active
          </div>
        </div>

        {/* AI Recommendations Section */}
        {!loading && recs.length > 0 && (
          <div className="mb-10 animate-slide-up">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Brain className="text-primary h-5 w-5" />
              AI Recommendations for You
              <Badge variant="outline" className="text-xs border-primary/45 bg-primary/5 text-primary ml-1 font-normal">
                Personalized
              </Badge>
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {recs.map((item) => (
                <Card key={item.id} className="relative overflow-hidden border-2 border-primary/25 bg-card supports-[backdrop-filter]:bg-card/45 backdrop-blur-md transition-all duration-300 hover:border-primary">
                  <div className="absolute top-2 left-2 z-10">
                    <Badge className="bg-primary/95 text-primary-foreground font-semibold text-[10px] tracking-wide uppercase shadow-sm">
                      ✨ AI Match {item.score ? `${Math.round(item.score * 100)}%` : '98%'}
                    </Badge>
                  </div>
                  <div className="relative aspect-[16/9] overflow-hidden">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <h3 className="font-bold text-base line-clamp-1">{item.name}</h3>
                      <span className="text-primary font-bold text-base flex items-center">
                        ₹{item.price}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                      {item.description}
                    </p>
                    
                    {/* Speech bubble style reason explanation */}
                    <div className="mb-4 p-2 bg-muted/65 rounded-lg border border-border/50 text-[10px] italic text-muted-foreground line-clamp-2">
                      🧠 {item.aiReason}
                    </div>

                    <button
                      onClick={() => handleQuickAdd(item)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Quick Add to Cart
                    </button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Shops Listing */}
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Store className="h-5 w-5 text-primary" />
          Canteen Shops
        </h2>

        {loading ? (
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="h-72 animate-pulse bg-muted/30" />
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6 animate-slide-up">
            {shopsList.map((shop) => (
              <Link key={shop.id} to={`/shop/${shop.id}`}>
                <Card className="overflow-hidden card-hover group cursor-pointer h-full">
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <img
                      src={shop.image}
                      alt={shop.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <Badge
                      className={`absolute top-3 right-3 ${
                        shop.isOpen
                          ? "bg-success text-success-foreground"
                          : "bg-destructive text-destructive-foreground"
                      }`}
                    >
                      {shop.isOpen ? "Open" : "Closed"}
                    </Badge>
                  </div>
                  <CardContent className="p-5">
                    <h3 className="font-bold text-lg mb-1 group-hover:text-primary transition-colors">
                      {shop.name}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {shop.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>5-15 min prep</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm font-medium text-primary">
                        View Menu
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Dashboard;
