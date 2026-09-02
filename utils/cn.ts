import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

// Application Architecture || Define Exports
// =======================================================================================
// =======================================================================================
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
