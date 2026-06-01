"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

/**
 * Clean, responsive loading skeleton matching the dashboard layout geometry.
 * Used as an organic placeholder while verifying the session.
 */
const DashboardSkeleton = () => {
    const skeletonStats = Array.from({ length: 4 });
    const skeletonNotes = Array.from({ length: 3 });
    const sidebarNavItems = Array.from({ length: 6 });
  
    return (
      <div className="flex min-h-screen w-full bg-background text-foreground overflow-hidden">
        
        {/* 1. SIDEBAR SKELETON (Hidden on Mobile/Tablet, visible on Large screens) */}
        <aside className="hidden lg:flex flex-col w-64 h-screen bg-card border-r border-border shrink-0 justify-between p-4">
          <div className="space-y-6">
            {/* Logo / Brand Placeholder */}
            <div className="flex items-center gap-3 px-2 py-3">
              <div className="w-8 h-8 rounded-lg bg-muted animate-pulse shrink-0" />
              <div className="h-5 bg-muted rounded-md animate-pulse w-28" />
            </div>
  
            {/* Navigation Items */}
            <nav className="space-y-2">
              {sidebarNavItems.map((_, i) => (
                <div 
                  key={`side-nav-${i}`} 
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                >
                  <div className="w-5 h-5 rounded-md bg-muted/80 animate-pulse shrink-0" />
                  <div className="h-4 bg-muted/70 rounded-md animate-pulse w-24" />
                </div>
              ))}
            </nav>
          </div>
  
          {/* User Profile / Footer Box in Sidebar */}
          <div className="flex items-center gap-3 p-2 border-t border-border/60 pt-4">
            <div className="w-10 h-10 rounded-full bg-muted animate-pulse shrink-0" />
            <div className="space-y-1.5 w-full">
              <div className="h-3.5 bg-muted rounded-md animate-pulse w-3/4" />
              <div className="h-2.5 bg-muted/60 rounded-md animate-pulse w-1/2" />
            </div>
          </div>
        </aside>
  
        {/* 2. MAIN CONTENT AREA */}
        <div className="flex-1 h-screen flex flex-col min-w-0 bg-background overflow-y-auto scrollbar-thin">
          
          {/* Responsive Header */}
          <header className="sticky top-0 z-20 backdrop-blur-md bg-background/70 border-b border-border px-4 sm:px-8 py-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
              
              {/* Left side: Mobile menu trigger + Title */}
              <div className="flex items-center gap-4 min-w-0">
                {/* Sidebar Mobile Trigger (Visible ONLY on mobile/tablet to mock the menu button) */}
                <div className="lg:hidden w-9 h-9 rounded-md bg-muted animate-pulse shrink-0 border border-border/40" />
                
                {/* Title & Subtitle */}
                <div className="space-y-2 min-w-0">
                  <div className="h-6 sm:h-7 bg-muted rounded-md animate-pulse w-32 sm:w-48" />
                  <div className="h-3.5 bg-muted/60 rounded-md animate-pulse w-20 sm:w-32 hidden sm:block" />
                </div>
              </div>
  
              {/* Right side: Actions / Profile Placeholder */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-8 h-8 rounded-full bg-muted/80 animate-pulse hidden sm:block" /> {/* Notification bell placeholder */}
                <div className="w-9 h-9 rounded-full bg-muted animate-pulse border border-border/60" /> {/* User avatar placeholder */}
              </div>
  
            </div>
          </header>
  
          {/* Main Dashboard Grid Body */}
          <main className="max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-10 flex-1">
            
            {/* Stats Grid: Scales from 1 col (mobile) -> 2 cols (tablet) -> 4 cols (desktop) */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {skeletonStats.map((_, i) => (
                <div
                  key={`stat-skel-${i}`}
                  className="bg-card rounded-xl p-5 border border-border/60 shadow-sm flex flex-col gap-4"
                >
                  <div className="flex justify-between items-start">
                    <div className="w-10 h-10 rounded-xl bg-muted/80 animate-pulse border border-border/40" />
                    <div className="w-12 h-4 bg-muted/40 rounded-full animate-pulse" /> {/* Trend indicator placeholder */}
                  </div>
                  <div className="space-y-2">
                    <div className="h-6 bg-muted rounded-md animate-pulse w-2/5" />
                    <div className="h-3.5 bg-muted/60 rounded-md animate-pulse w-3/5" />
                  </div>
                </div>
              ))}
            </section>
  
            {/* Content Section (e.g., Recent Notes / Projects) */}
            <section className="space-y-5">
              {/* Section Header */}
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <div className="flex items-center gap-2.5 w-40">
                  <div className="w-4 h-4 rounded bg-muted animate-pulse shrink-0" />
                  <div className="h-4 bg-muted rounded-md animate-pulse w-full" />
                </div>
                <div className="h-4 bg-muted/60 rounded-md animate-pulse w-16" />
              </div>
  
              {/* Items Grid: Scales from 1 col -> 2 cols -> 3 cols */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {skeletonNotes.map((_, index) => (
                  <div
                    key={`note-skel-${index}`}
                    className="bg-card rounded-xl border border-border/60 p-5 flex flex-col justify-between h-40 shadow-sm hover:border-border/80 transition-colors"
                  >
                    <div className="space-y-3">
                      <div className="h-4 bg-muted rounded-md animate-pulse w-5/6" />
                      <div className="space-y-1.5">
                        <div className="h-3 bg-muted/40 rounded-md animate-pulse w-full" />
                        <div className="h-3 bg-muted/40 rounded-md animate-pulse w-4/5" />
                      </div>
                    </div>
                    
                    {/* Card Footer tags */}
                    <div className="flex gap-2 pt-4 border-t border-border/40">
                      <div className="h-5 bg-muted/60 rounded-full animate-pulse w-14" />
                      <div className="h-5 bg-muted/60 rounded-full animate-pulse w-16" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
  
          </main>
        </div>
  
      </div>
    );
  };

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, isPending, error, refetch } = authClient.useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/");
    }
  }, [session, isPending, router]);

  // While checking auth or redirecting, smoothly display the dashboard's structural layout
  if (isPending || !session) {
    return (
      <div className="flex h-screen w-screen bg-background overflow-hidden">
        <DashboardSkeleton />
      </div>
    );
  }

  // If authenticated, seamlessly render the layout/pages
  return <>{children}</>;
}