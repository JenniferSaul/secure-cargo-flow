import { Package, Lock } from "lucide-react";

export const Logo = () => {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Package className="h-8 w-8 text-primary" strokeWidth={2} />
        <Lock className="h-4 w-4 text-accent absolute -bottom-1 -right-1" strokeWidth={2.5} />
      </div>
      <span className="text-xl font-bold text-foreground">
        Secure Cargo Flow
      </span>
    </div>
  );
};


