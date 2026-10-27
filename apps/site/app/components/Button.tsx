import Link from "next/link";
import type { ReactNode } from "react";

type ButtonProps = {
  href: string;
  children: ReactNode;
  variant?: "solid" | "outline";
  className?: string;
};

export function Button({ href, children, variant = "outline", className }: ButtonProps) {
  const variantClass = variant === "solid" ? "btn btn-solid" : "btn";
  return (
    <Link className={`${variantClass}${className ? ` ${className}` : ""}`} href={href}>
      <span>{children}</span>
    </Link>
  );
}
