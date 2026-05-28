import React from "react";
import Header from "./Header";
import Footer from "./Footer";
import AICanteenBot from "@/components/ai/AICanteenBot";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <AICanteenBot />
      <Footer />
    </div>
  );
};

export default Layout;
