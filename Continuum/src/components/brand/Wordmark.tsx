import Link from "next/link";

export function Wordmark({
  href = "/",
  size = "md",
}: {
  href?: string;
  size?: "sm" | "md" | "lg" | "hero";
}) {
  const sizes = {
    sm: "text-lg tracking-tight",
    md: "text-xl tracking-tight",
    lg: "text-3xl tracking-tight",
    hero: "text-5xl sm:text-7xl md:text-8xl tracking-[-0.04em]",
  };

  return (
    <Link
      href={href}
      className={`font-sans font-semibold text-ink ${sizes[size]} transition-opacity hover:opacity-75`}
    >
      Continuum
    </Link>
  );
}
