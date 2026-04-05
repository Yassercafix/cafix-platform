import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ActionButtonProps {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'secondary' | 'info';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  badge?: number;
  className?: string;
}

export function ActionButton({
  label,
  icon,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  badge,
  className,
}: ActionButtonProps) {
  const variantStyles = {
    primary: 'bg-blue-500 hover:bg-blue-600 text-white',
    success: 'bg-green-500 hover:bg-green-600 text-white',
    warning: 'bg-amber-500 hover:bg-amber-600 text-white',
    danger: 'bg-red-500 hover:bg-red-600 text-white',
    secondary: 'bg-gray-500 hover:bg-gray-600 text-white',
    info: 'bg-cyan-500 hover:bg-cyan-600 text-white',
  };

  const sizeStyles = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-3 text-base',
    lg: 'px-6 py-4 text-lg',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed relative',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      <div className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10">
        {icon}
      </div>
      <span className="text-center text-xs md:text-sm font-medium leading-tight">
        {label}
      </span>
      {badge && (
        <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );
}

interface ActionGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

export function ActionGrid({
  children,
  columns = 2,
  className,
}: ActionGridProps) {
  const gridColsClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  };

  return (
    <div
      className={cn(
        `grid ${gridColsClass[columns]} gap-3 md:gap-4`,
        className
      )}
    >
      {children}
    </div>
  );
}
