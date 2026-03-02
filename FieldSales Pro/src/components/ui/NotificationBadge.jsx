import React from 'react';

const NotificationBadge = ({ 
  count = 0, 
  maxCount = 99, 
  showZero = false,
  variant = 'default',
  size = 'default',
  className = '' 
}) => {
  // Don't render if count is 0 and showZero is false
  if (count === 0 && !showZero) {
    return null;
  }

  // Format count display
  const displayCount = count > maxCount ? `${maxCount}+` : count?.toString();

  // Variant styles
  const variantStyles = {
    default: 'bg-error text-error-foreground',
    success: 'bg-success text-success-foreground',
    warning: 'bg-warning text-warning-foreground',
    primary: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground'
  };

  // Size styles
  const sizeStyles = {
    sm: 'min-w-[16px] h-4 text-[10px] px-1',
    default: 'min-w-[20px] h-5 text-xs px-1.5',
    lg: 'min-w-[24px] h-6 text-sm px-2'
  };

  return (
    <span
      className={`
        inline-flex items-center justify-center
        rounded-full font-medium
        ${variantStyles?.[variant]}
        ${sizeStyles?.[size]}
        ${className}
      `}
    >
      {displayCount}
    </span>
  );
};

export default NotificationBadge;