import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

/** One style, no variants — nothing in the app has needed a second one
 * yet. Add a `variant` prop when a real second style is needed, not
 * before. */
export function Button({ className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
