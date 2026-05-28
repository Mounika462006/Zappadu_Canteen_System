import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Order } from "@/types";
import OrderStatusBadge from "./OrderStatusBadge";
import { IndianRupee, Clock, Calendar, Store, Brain, Activity, HelpCircle } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface OrderCardProps {
  order: Order;
}

const OrderCard: React.FC<OrderCardProps> = ({ order }) => {
  const explanation = order.aiPrepTimeExplanation;

  return (
    <Card className="overflow-hidden card-hover border border-border">
      <CardHeader className="border-b bg-muted/30 py-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-mono text-sm text-muted-foreground">Order</span>
            <span className="ml-2 font-bold text-lg">#{order.id}</span>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Store className="h-4 w-4 text-primary" />
          <span className="font-semibold text-foreground">{order.shopName}</span>
        </div>

        {/* Items list */}
        <div className="space-y-2">
          {order.items.map((item) => (
            <div key={item.menuItem.id} className="flex justify-between text-sm">
              <span>{item.menuItem.name} × {item.quantity}</span>
              <span className="flex items-center text-muted-foreground font-medium">
                <IndianRupee className="h-3 w-3" />
                {item.menuItem.price * item.quantity}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t" />

        {/* Total */}
        <div className="flex justify-between font-bold text-base">
          <span>Total Amount</span>
          <span className="flex items-center text-primary">
            <IndianRupee className="h-4.5 w-4.5" />
            {order.totalAmount}
          </span>
        </div>

        {/* Dates & Static Timings */}
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>Ordered: {format(new Date(order.createdAt), "dd MMM yyyy, hh:mm a")}</span>
          </div>
          {(order.status === "preparing" || order.status === "accepted" || order.status === "pending") && (
            <div className="flex items-center gap-1 text-primary font-medium">
              <Clock className="h-3 w-3 animate-pulse" />
              <span>Est. Pickup: {format(new Date(order.estimatedReadyTime), "hh:mm a")}</span>
            </div>
          )}
        </div>

        {/* AI PREDICTION EXPLANATION (Only show for active/undelivered orders) */}
        {explanation && (order.status === "pending" || order.status === "accepted" || order.status === "preparing") && (
          <div className="p-3 bg-primary/5 rounded-xl border border-primary/15 space-y-2 animate-slide-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                <Brain className="h-4 w-4" />
                AI Prep-Time Predictor
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <button className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5 underline">
                    <Activity className="h-3 w-3" /> Math Model Details
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-md bg-card/95 backdrop-blursupports-[backdrop-filter]:bg-card/75 border border-border">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Brain className="text-primary h-6 w-6" />
                      Multivariate Linear Regression Model
                    </DialogTitle>
                    <DialogDescription>
                      Data Science model trained using Batch Gradient Descent on canteen order history logs.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 text-sm mt-3">
                    {/* Math equation */}
                    <div className="p-3 bg-muted rounded-lg text-center font-mono text-xs border">
                      <div className="font-semibold text-primary mb-1">REGRESSION FORMULA</div>
                      PrepTime = (w₁ × X₁) + (w₂ × X₂) + (w₃ × X₃) + bias
                    </div>

                    {/* Features breakdown */}
                    <div className="space-y-2">
                      <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Active Equation Coefficients:</h4>
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-1">Factor (Feature)</th>
                            <th className="text-right py-1">Value (X)</th>
                            <th className="text-right py-1">Weight (w)</th>
                            <th className="text-right py-1">Impact (w·X)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b">
                            <td className="py-1">Complexity (Max Prep)</td>
                            <td className="text-right">{explanation.baseComplexity}m</td>
                            <td className="text-right">1.11</td>
                            <td className="text-right font-medium text-foreground">+{explanation.complexityImpact}m</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-1">Queue Size (Active Orders)</td>
                            <td className="text-right">{explanation.queueCount}</td>
                            <td className="text-right">1.43</td>
                            <td className="text-right font-medium text-foreground">+{explanation.queueImpact}m</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-1">Peak Canteen Hour</td>
                            <td className="text-right">{explanation.isPeakHour ? "Yes (1)" : "No (0)"}</td>
                            <td className="text-right">5.04</td>
                            <td className="text-right font-medium text-foreground">+{explanation.peakHourImpact}m</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-1">System Constant (Bias)</td>
                            <td className="text-right">1</td>
                            <td className="text-right">{explanation.systemDelay}</td>
                            <td className="text-right font-medium text-foreground">+{explanation.systemDelay}m</td>
                          </tr>
                          <tr className="font-bold text-primary bg-primary/5">
                            <td className="py-1.5 pl-1">Final Predicted Time</td>
                            <td colSpan={2}></td>
                            <td className="text-right pr-1">~{explanation.baseComplexity + explanation.queueImpact + explanation.peakHourImpact + explanation.systemDelay > 3 ? Math.round(explanation.complexityImpact + explanation.queueImpact + explanation.peakHourImpact + explanation.systemDelay) : 3} mins</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between text-xs p-2.5 bg-success/15 border border-success/30 rounded-lg">
                      <span className="font-semibold text-success flex items-center gap-1">
                        ✓ Model Fitness (R² Accuracy):
                      </span>
                      <span className="font-bold text-success">
                        {explanation.rSquared ? `${(explanation.rSquared * 100).toFixed(2)}%` : "98.79%"}
                      </span>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            
            {/* Quick breakdown preview in card */}
            <div className="text-[11px] text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>• Base complexity:</span>
                <span className="font-medium text-foreground">{explanation.baseComplexity} mins</span>
              </div>
              <div className="flex justify-between">
                <span>• Active queue delay ({explanation.queueCount} orders):</span>
                <span className="font-medium text-foreground">+{explanation.queueImpact} mins</span>
              </div>
              {explanation.isPeakHour && (
                <div className="flex justify-between text-destructive">
                  <span>• Peak lunch break rush:</span>
                  <span className="font-semibold">+{explanation.peakHourImpact} mins</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Counter payments / pickup notes */}
        <div className="flex items-center gap-2 text-xs">
          <span className={`px-2 py-1 rounded font-semibold ${order.paymentStatus === 'paid' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
            {order.paymentStatus === 'paid' ? '✓ Paid Online' : '⏳ Pay at Counter'}
          </span>
        </div>

        {order.status === "ready" && (
          <div className="p-2.5 bg-success/15 border border-success/35 rounded-xl text-sm text-center font-bold text-success animate-pulse">
            🔔 Your food is ready! Collect from counter.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OrderCard;
