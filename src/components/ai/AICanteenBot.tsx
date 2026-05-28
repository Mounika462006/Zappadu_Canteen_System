import React, { useState, useRef, useEffect } from "react";
import { Brain, MessageSquare, X, Send, Sparkles, ShoppingCart, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Message {
  sender: "bot" | "user";
  text: string;
}

const AICanteenBot: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "bot",
      text: "👋 Hi! I am **ZappaBot**, your AI Canteen Assistant! Ask me for recommendations, search by price/category (e.g. *'spicy under ₹50'*), or type *'add [item name]'* to quickly place an item in your cart! How can I help you today?"
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([
    "Recommend some food",
    "Spicy food under ₹50",
    "Help me choose breakfast",
    "Where is Medu Vada?"
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    // Add user message
    setMessages((prev) => [...prev, { sender: "user", text }]);
    setInputValue("");
    setIsTyping(true);

    try {
      const res = await fetch("http://localhost:5000/api/ai/chatbot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: text,
          studentId: user?.id || null
        })
      });

      if (res.ok) {
        const data = await res.json();
        
        // Simulate slight typing delay for realism
        setTimeout(async () => {
          setIsTyping(false);
          setMessages((prev) => [...prev, { sender: "bot", text: data.responseText }]);
          
          if (data.suggestedPrompts && data.suggestedPrompts.length > 0) {
            setSuggestions(data.suggestedPrompts);
          }

          // Handle automatic AI Actions
          if (data.action) {
            const { type } = data.action;
            
            // Action 1: Add item directly to React Cart
            if (type === "add_to_cart") {
              try {
                // Fetch full item details from API to add properly
                const menuRes = await fetch(`http://localhost:5000/api/shops/${data.action.shopId}/menu`);
                if (menuRes.ok) {
                  const menu = await menuRes.json();
                  const foundItem = menu.find((item: any) => item.id === data.action.itemId);
                  if (foundItem) {
                    addToCart(foundItem);
                  }
                }
              } catch (err) {
                console.error("Chatbot failed to trigger add to cart:", err);
              }
            } 
            
            // Action 2: Navigate Client Routes
            else if (type === "navigate") {
              toast.info(`Navigating to ${data.action.path === "/cart" ? "Cart" : "Orders"}...`);
              setTimeout(() => {
                navigate(data.action.path);
                setIsOpen(false);
              }, 800);
            }
          }
        }, 600);
      } else {
        setIsTyping(false);
        setMessages((prev) => [
          ...prev,
          { sender: "bot", text: "Oops, I had a small connection glitch! Please try again in a moment." }
        ]);
      }
    } catch (error) {
      console.error("Chatbot submission failed:", error);
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "Oops! The backend canteen server seems to be offline. Make sure node server.js is running!" }
      ]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSendMessage(inputValue);
    }
  };

  // Helper to render basic markdown bold syntax (**text**) into elements
  const formatMessageText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="text-primary font-bold">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  // Do not show the chatbot for Shop Owners, only for Students/Guests
  if (user?.role === "shop_owner") return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Expanded Chat Window */}
      {isOpen && (
        <Card className="w-[340px] md:w-[380px] h-[500px] mb-4 flex flex-col overflow-hidden border-2 border-primary/30 bg-card/90 supports-[backdrop-filter]:bg-card/75 backdrop-blur-lg shadow-2xl animate-scale-in">
          {/* Header */}
          <div className="p-4 bg-primary text-primary-foreground flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary-foreground/10 flex items-center justify-center">
                <Brain className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-bold text-sm leading-tight">ZappaBot</h3>
                <p className="text-[10px] text-primary-foreground/75 flex items-center gap-0.5">
                  <Sparkles className="h-2.5 w-2.5 animate-pulse" /> AI Canteen Assistant
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex gap-2 max-w-[85%] ${
                  msg.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                }`}
              >
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 border ${
                    msg.sender === "user"
                      ? "bg-primary border-primary text-primary-foreground"
                      : "bg-card border-border text-primary"
                  }`}
                >
                  {msg.sender === "user" ? <User className="h-4.5 w-4.5" /> : <Brain className="h-4.5 w-4.5" />}
                </div>
                <div
                  className={`p-3 rounded-2xl text-xs shadow-sm leading-relaxed whitespace-pre-line ${
                    msg.sender === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-none"
                      : "bg-card border border-border text-foreground rounded-tl-none"
                  }`}
                >
                  {formatMessageText(msg.text)}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-2 max-w-[85%] mr-auto">
                <div className="h-7 w-7 rounded-full bg-card border border-border flex items-center justify-center shrink-0 text-primary">
                  <Brain className="h-4.5 w-4.5" />
                </div>
                <div className="bg-card border border-border p-3 rounded-2xl rounded-tl-none flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                  <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                  <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Dynamic Suggestion Badges */}
          {suggestions.length > 0 && (
            <div className="px-4 py-2 bg-muted/30 border-t border-border flex flex-wrap gap-1.5 overflow-x-auto max-h-[70px]">
              {suggestions.map((sug, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(sug)}
                  className="px-2 py-1 bg-card hover:bg-primary/5 hover:text-primary text-[10px] font-semibold text-muted-foreground border border-border rounded-full transition-colors whitespace-nowrap"
                >
                  💡 {sug}
                </button>
              ))}
            </div>
          )}

          {/* Input Panel */}
          <div className="p-3 border-t border-border bg-card flex gap-2 items-center">
            <Input
              placeholder="Ask anything or add foods..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              className="text-xs focus-visible:ring-primary focus-visible:ring-1"
            />
            <Button
              size="icon"
              disabled={!inputValue.trim()}
              onClick={() => handleSendMessage(inputValue)}
              className="h-9 w-9 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Floating Action Button */}
      <Button
        size="lg"
        onClick={() => setIsOpen(!isOpen)}
        className="h-14 w-14 rounded-full shadow-2xl bg-primary hover:bg-primary/95 text-primary-foreground border-2 border-primary-foreground/15 flex items-center justify-center p-0 transition-transform duration-300 hover:scale-105"
      >
        {isOpen ? (
          <X className="h-6 w-6 animate-scale-in" />
        ) : (
          <Brain className="h-6 w-6 animate-scale-in" />
        )}
      </Button>
    </div>
  );
};

export default AICanteenBot;
