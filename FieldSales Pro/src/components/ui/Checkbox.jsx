import React, { useEffect, useRef } from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "../../utils/cn";

const sizeClasses = {
  sm: "h-4 w-4",
  default: "h-4 w-4",
  lg: "h-5 w-5"
};

const Checkbox = React.forwardRef(
  (
    {
      className,
      id,
      checked = false,
      indeterminate = false,
      disabled = false,
      required = false,
      label,
      description,
      error,
      size = "default",
      ...props
    },
    ref
  ) => {
    const inputRef = useRef(null);
    const mergedRef = ref || inputRef;
    const checkboxId = id || `checkbox-${Math.random().toString(36).slice(2, 9)}`;

    useEffect(() => {
      if (mergedRef && "current" in mergedRef && mergedRef.current) {
        mergedRef.current.indeterminate = indeterminate;
      }
    }, [indeterminate, mergedRef]);

    return (
      <div className={cn("flex items-start space-x-2", className)}>
        <div className="relative flex items-center">
          <input
            type="checkbox"
            ref={mergedRef}
            id={checkboxId}
            checked={checked}
            disabled={disabled}
            required={required}
            className="sr-only"
            {...props}
          />

          <label
            htmlFor={checkboxId}
            className={cn(
              "peer shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground cursor-pointer transition-colors flex items-center justify-center",
              sizeClasses[size] || sizeClasses.default,
              (checked || indeterminate) && "bg-primary text-primary-foreground border-primary",
              error && "border-destructive",
              disabled && "cursor-not-allowed opacity-50"
            )}
          >
            {checked && !indeterminate && <Check className="h-3 w-3 text-current" />}
            {indeterminate && <Minus className="h-3 w-3 text-current" />}
          </label>
        </div>

        {(label || description || error) && (
          <div className="flex-1 space-y-1">
            {label && (
              <label
                htmlFor={checkboxId}
                className="text-sm font-medium leading-none text-foreground"
              >
                {label}
              </label>
            )}
            {description && (
              <p className="text-sm text-muted-foreground leading-tight">{description}</p>
            )}
            {error && (
              <p className="text-sm text-destructive leading-tight">{error}</p>
            )}
          </div>
        )}
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox";

export { Checkbox };
export default Checkbox;
