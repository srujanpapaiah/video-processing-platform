import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Upload,
  List,
  Monitor,
  Film,
} from "lucide-react";
import { useQueueStats } from "../hooks/useSocket";
import { cn } from "../lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/upload", icon: Upload, label: "Upload & Process" },
  { to: "/jobs", icon: List, label: "Jobs" },
  { to: "/system", icon: Monitor, label: "System" },
];

export function Sidebar() {
  const stats = useQueueStats();

  return (
    <aside className="w-64 bg-dark-900 border-r border-dark-700 flex flex-col h-full shrink-0">
      {/* Logo */}
      <div className="p-5 border-b border-dark-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <Film className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-dark-100">Video Processor</h1>
            <p className="text-xs text-dark-400">FFmpeg Platform</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-dark-400 hover:bg-dark-800 hover:text-dark-200"
              )
            }
          >
            <item.icon className="w-4.5 h-4.5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Queue Stats */}
      <div className="p-4 border-t border-dark-700">
        <p className="text-xs font-medium text-dark-400 uppercase tracking-wider mb-3">Queue</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-dark-800 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-yellow-400">{stats.active}</p>
            <p className="text-xs text-dark-400">Active</p>
          </div>
          <div className="bg-dark-800 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-blue-400">{stats.waiting}</p>
            <p className="text-xs text-dark-400">Waiting</p>
          </div>
          <div className="bg-dark-800 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-emerald-400">{stats.completed}</p>
            <p className="text-xs text-dark-400">Done</p>
          </div>
          <div className="bg-dark-800 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-red-400">{stats.failed}</p>
            <p className="text-xs text-dark-400">Failed</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
