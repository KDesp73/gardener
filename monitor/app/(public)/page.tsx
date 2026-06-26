import Link from "next/link";
import {
  Sprout,
  Droplets,
  Thermometer,
  Wifi,
  Clock,
  Smartphone,
} from "lucide-react";

const features = [
  {
    icon: Droplets,
    title: "Automated Watering",
    description:
      "Smart soil moisture sensors trigger precise irrigation — your plants get water exactly when they need it.",
  },
  {
    icon: Thermometer,
    title: "Environment Monitoring",
    description:
      "Track temperature and humidity in real time. Keep your plants in their ideal growing conditions.",
  },
  {
    icon: Clock,
    title: "Scheduled Care",
    description:
      "Set custom watering schedules per zone. Morning, evening, or on-demand — you're in control.",
  },
  {
    icon: Wifi,
    title: "Remote Access",
    description:
      "Monitor and manage your garden from anywhere. Live MQTT updates keep you connected.",
  },
  {
    icon: Smartphone,
    title: "Mobile Ready",
    description:
      "Install as a PWA on your phone for a native-like experience. Water your plants from the garden.",
  },
  {
    icon: Sprout,
    title: "Multi-Zone Support",
    description:
      "Manage multiple plants independently. Each zone has its own sensor, relay, and watering schedule.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:pb-32 sm:pt-24">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        <div className="mx-auto max-w-4xl text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 sm:h-20 sm:w-20">
            <Sprout className="h-8 w-8 text-primary sm:h-10 sm:w-10" />
          </div>
          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-6xl">
            Your Plants,
            <br />
            <span className="text-primary">Intelligently Watered</span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Gardener is an open-source, ESP32-powered automated watering system
            that keeps your plants thriving with real-time monitoring and smart
            scheduling.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-8 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Sign In
            </Link>
            <Link
              href="#features"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-background px-8 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        className="border-t border-border/40 bg-muted/30 px-4 py-20 sm:py-28"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center sm:mb-16">
            <h2 className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Everything your garden needs
            </h2>
            <p className="text-muted-foreground">
              A complete system for modern plant care
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-xl border border-border/60 bg-card p-6 transition-shadow hover:shadow-sm"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 font-semibold">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to get started?
          </h2>
          <p className="mb-8 text-muted-foreground">
            Sign in to monitor your plants, adjust schedules, and keep your
            garden thriving.
          </p>
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-8 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Sign In to Dashboard
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 text-center text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Sprout className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">Gardener</span>
          </div>
          <p>ESP32 automated watering system &mdash; open source</p>
        </div>
      </footer>
    </div>
  );
}
