import { Logo } from "@/components/Logo";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { CargoTimeline } from "@/components/CargoTimeline";
import { ShipmentForm } from "@/components/ShipmentForm";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Logo />
            <WalletConnectButton />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-primary/20 to-accent/20" />
        <div className="relative container mx-auto px-6 py-16 text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 tracking-tight">
            Move Goods, Protect Data.
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Enterprise-grade cargo tracking with end-to-end encryption. Reveal sensitive fields only to authorized partners with blockchain verification.
          </p>
          <div className="mb-8">
            <ShipmentForm />
          </div>
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span>Real-time tracking</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span>Encrypted data</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent" />
              <span>Blockchain verified</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        <CargoTimeline />
      </main>
    </div>
  );
};

export default Index;


