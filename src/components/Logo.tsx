import Image from "next/image";

export function LogoMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src="/icon.png"
      alt="SM HRMS"
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}

export function LogoFull({ width = 180, className = "" }: { width?: number; className?: string }) {
  return (
    <Image
      src="/logo-full.png"
      alt="SM HRMS — Empowering People. Optimizing Talent."
      width={width}
      height={Math.round((width * 228) / 271)}
      className={className}
      priority
    />
  );
}
