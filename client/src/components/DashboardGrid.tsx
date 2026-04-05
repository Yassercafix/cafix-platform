import React from 'react';
import { LucideIcon } from 'lucide-react';
import { useLocation } from 'wouter';

interface DashboardGridItem {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  href?: string;
  onClick?: () => void;
}

interface DashboardGridProps {
  items: DashboardGridItem[];
  columns?: number;
}

/**
 * Unified Dashboard Grid Component
 * Displays large colored buttons in a grid layout for mobile and desktop
 * Supports RTL and responsive design
 */
export function DashboardGrid({ items, columns = 2 }: DashboardGridProps) {
  const [, setLocation] = useLocation();

  const handleClick = (item: DashboardGridItem) => {
    if (item.onClick) {
      item.onClick();
    } else if (item.href) {
      setLocation(item.href);
    }
  };

  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500 hover:bg-blue-600',
    orange: 'bg-orange-500 hover:bg-orange-600',
    purple: 'bg-purple-500 hover:bg-purple-600',
    green: 'bg-green-500 hover:bg-green-600',
    teal: 'bg-teal-500 hover:bg-teal-600',
    red: 'bg-red-500 hover:bg-red-600',
    yellow: 'bg-yellow-500 hover:bg-yellow-600',
    gray: 'bg-gray-500 hover:bg-gray-600',
    pink: 'bg-pink-500 hover:bg-pink-600',
    indigo: 'bg-indigo-500 hover:bg-indigo-600',
  };

  return (
    <div className={`grid gap-4 md:gap-6 w-full`} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {items.map((item) => {
        const Icon = item.icon;
        const bgColor = colorClasses[item.color] || colorClasses.blue;

        return (
          <button
            key={item.id}
            onClick={() => handleClick(item)}
            className={`${bgColor} text-white rounded-2xl p-6 md:p-8 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95 flex flex-col items-center justify-center gap-3 md:gap-4 min-h-[140px] md:min-h-[160px]`}
          >
            <Icon className="w-10 h-10 md:w-12 md:h-12" strokeWidth={1.5} />
            <div className="text-center">
              <h3 className="font-bold text-sm md:text-base leading-tight">{item.title}</h3>
              <p className="text-xs md:text-sm opacity-90 mt-1 leading-tight">{item.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
