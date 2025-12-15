import { UserButton } from "@clerk/clerk-react"; // Import the button
import Header from "@/components/dashboard/Header";
import StatusCard from "@/components/dashboard/StatusCard";
import ActivityLog from "@/components/dashboard/ActivityLog";
import StatsGrid from "@/components/dashboard/StatsGrid";

const Index = () => {
  return (
    <div className="min-h-screen bg-background relative">
      {/* FLOATING LOGOUT BUTTON (Top Right) */}
      <div className="absolute top-6 right-6 z-50">
        <UserButton afterSignOutUrl="/" />
      </div>
      
      {/* HEADER */}
      <Header />
      
      <main className="container mx-auto px-6 py-8 space-y-8">
        {/* Stats Overview */}
        <StatsGrid />

        {/* Main Status Card */}
        <StatusCard />

        {/* Activity Log */}
        <ActivityLog />

        {/* Footer */}
        <footer className="text-center py-6 border-t border-border">
          <p className="text-xs text-muted-foreground font-mono">
            Cloud Audit Zero v1.0.0 • Enterprise Security Platform • © 2024
          </p>
        </footer>
      </main>
    </div>
  );
};

export default Index;