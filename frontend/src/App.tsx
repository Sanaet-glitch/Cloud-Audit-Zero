import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SignedIn, SignedOut, SignInButton } from "@clerk/clerk-react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />

      {/* 1. IF SIGNED IN: Show your Existing Router & Dashboard */}
      <SignedIn>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      </SignedIn>

      {/* 2. IF SIGNED OUT: Show the "Access Restricted" Screen */}
      <SignedOut>
        <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center text-center p-6 font-sans">
          <div className="p-6 rounded-full bg-slate-900 border border-slate-800 mb-6 shadow-2xl shadow-emerald-500/10">
            <Lock className="h-16 w-16 text-slate-400" />
          </div>
          
          <div className="space-y-3 max-w-md mb-8">
            <h1 className="text-4xl font-bold text-white tracking-tight">Access Restricted</h1>
            <p className="text-slate-400 text-lg">
              This is a secured Cloud Security Environment. <br/>
              Authorized personnel only.
            </p>
          </div>

          <SignInButton mode="modal">
            <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-8 py-6 text-lg shadow-lg hover:shadow-emerald-500/25 transition-all">
              Authenticate Access
            </Button>
          </SignInButton>
          
          <p className="text-xs text-slate-600 font-mono pt-12">
            CLOUD AUDIT ZERO v1.0.0 • PROPRIETARY SYSTEM
          </p>
        </div>
      </SignedOut>

    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
