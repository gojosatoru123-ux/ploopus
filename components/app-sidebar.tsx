"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Calendar,
  StickyNote,
  Lightbulb,
  Folder,
  Share2,
  Settings,
  ChevronUp,
  ChevronDown,
  Network,
  Layers,
  LogOut,
  CreditCard,
  User,
  ExternalLink,
  BrainCircuitIcon
} from "lucide-react";
import { Sidebar } from "./ui/sidebar";
import { authClient } from "@/lib/auth-client";
import Image from "next/image";
import ploopusLogo from '@/public/ploopus_logo.webp';

const MotionLink = motion.create(Link);

const AppSidebar = () => {
  const pathname = usePathname();
  const [noteExpanded, setNoteExpanded] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navItems = [
    { id: "home", icon: Home, label: "Home", href: "/dashboard" },
    { id: "calendar", icon: Calendar, label: "Calendar", href: "/calendar" },
    { id: "flashcards", icon: Layers, label: "Flashcards", href: "/flashcards" },
    { id: "graph", icon: Network, label: "Graph View", href: "/graphview" },
  ];

  const memoryItems = [
    { id: "feed", icon: BrainCircuitIcon, label: "Memory Hub", href: "/memory-feed" },
  ];

  const noteSubItems = [
    { id: "ideas", icon: Lightbulb, label: "Ideas", href: "/note/ideas" },
    { id: "folder", icon: Folder, label: "Folder", href: "/note/folder" },
  ];

  const bottomNavItems = [
    // { id: "shared", icon: Share2, label: "Shared", href: "/shared" },
    { id: "setting", icon: Settings, label: "Settings", href: "/settings" },
  ];

  const {
    data: session,
    isPending, //loading state
    error, //error object
    refetch //refetch the session
  } = authClient.useSession()

  const router = useRouter();
  const logout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/");
        }
      }
    })
  }

  const isActive = (path: string) => pathname === path;
  const isNoteSection = pathname.startsWith("/note");

  return (
    <Sidebar>
      <aside className="w-full h-full bg-sidebar-gradient backdrop-blur-xl border-r border-white/10 flex flex-col shrink-0 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-[80px] pointer-events-none" />

        {/* Logo */}
        <div className="px-6 py-8 relative z-10">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 hover:opacity-90 transition-opacity w-fit"
          >
            <div className="relative w-12 h-12 flex border-2 rounded-full">
              <Image
                src={ploopusLogo}
                alt="Ploopus"
                fill
                className="object-contain"
                priority
              />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight leading-none">
              Ploo<span className="text-amber-400">pus</span>
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto scrollbar-none relative z-10">
          {navItems.map((item) => (
            <MotionLink
              key={item.id}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${isActive(item.href)
                ? "bg-white/15 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
                : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
            >
              <item.icon className={`w-5 h-5 ${isActive(item.href) ? "text-amber-400" : ""}`} />
              <span className="font-medium text-lg">{item.label}</span>
            </MotionLink>
          ))}

          {/* Note Section */}
          <div className="pt-2">
            <motion.button
              onClick={() => setNoteExpanded(!noteExpanded)}
              className={`flex items-center justify-between px-4 py-2.5 rounded-lg transition-all duration-200 w-full ${isNoteSection ? "bg-white/15 text-white" : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center gap-3">
                <StickyNote className={`w-5 h-5 ${isNoteSection ? "text-amber-400" : ""}`} />
                <span className="font-medium text-lg">Note</span>
              </div>
              <motion.div animate={{ rotate: noteExpanded ? 0 : -90 }} transition={{ duration: 0.2 }}>
                <ChevronDown className="w-4 h-4 opacity-60" />
              </motion.div>
            </motion.button>

            <AnimatePresence>
              {noteExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="ml-6 mt-1 space-y-1 border-l border-white/10 pl-3">
                    {noteSubItems.map((item, index) => (
                      <MotionLink
                        key={item.id}
                        href={item.href}
                        className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-200 text-sm ${isActive(item.href) ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5"
                          }`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <item.icon className={`w-4 h-4 ${isActive(item.href) ? "text-amber-400" : ""}`} />
                        <span className="text-lg">{item.label}</span>
                      </MotionLink>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Memory Section */}
          <div className="pt-4 border-t border-white/5 mt-4 space-y-1">
            {memoryItems.map((item) => (
              <MotionLink
                key={item.id}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${isActive(item.href) ? "bg-white/15 text-white" : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
              >
                <item.icon className={`w-5 h-5 ${isActive(item.href) ? "text-amber-400" : ""}`} />
                <span className="font-medium text-lg">{item.label}</span>
              </MotionLink>
            ))}
          </div>

          {/* Bottom Items */}
          <div className="pt-4 border-t border-white/5 mt-4 space-y-1">
            {bottomNavItems.map((item) => (
              <MotionLink
                key={item.id}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${isActive(item.href) ? "bg-white/15 text-white" : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
              >
                <item.icon className={`w-5 h-5 ${isActive(item.href) ? "text-amber-400" : ""}`} />
                <span className="font-medium text-lg">{item.label}</span>
              </MotionLink>
            ))}
          </div>
        </nav>

        {/* Profile Card */}
        <div className="p-4 shrink-0 relative z-50" ref={profileRef}>
          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="absolute bottom-full left-4 right-4 mb-2 bg-black/80 backdrop-blur-2xl border border-white/15 rounded-2xl overflow-hidden shadow-2xl z-50"
              >
                <div className="p-2 space-y-1">
                  <MotionLink
                    href={"/billings"}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 `}
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <CreditCard className={`w-5 h-5`} />
                    <span>Billings</span>
                  </MotionLink>
                  <motion.button
                    onClick={logout}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm transition-colors text-red-400 hover:bg-red-500/10"
                    whileHover={{ x: 2 }}
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="font-medium">Logout</span>
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            onClick={() => setProfileOpen(!profileOpen)}
            className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border ${profileOpen ? "bg-white/15 border-white/20" : "bg-white/5 border-white/10 hover:bg-white/10"
              }`}
            whileHover={{ scale: 1.02, translateY: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="relative">
              <img
                src={session?.user.image || "https://avatars.dicebear.com/api/initials/default.svg"}
                alt="User avatar"
                className="w-10 h-10 rounded-full object-cover ring-2 ring-amber-500/20"
              />
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#1a1a1a] rounded-full" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{session?.user.name}</p>
              <p className="text-[11px] text-white/50 tracking-wider font-medium truncate">{session?.user.email}</p>
            </div>
            <motion.div animate={{ rotate: profileOpen ? 180 : 0 }}>
              <ChevronUp className="w-4 h-4 text-white/40" />
            </motion.div>
          </motion.div>
        </div>
      </aside>
    </Sidebar>
  );
};

export default AppSidebar;