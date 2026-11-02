import { LandingPage } from "@/features/landing/components/landing-page";

export const metadata = {
  title: "FerreSaaS · Tu ferretería, en orden",
  description:
    "Conoce FerreSaaS: inventario, ventas, compras y caja en un solo lugar para administrar tu ferretería.",
};

export default function Home() {
  return <LandingPage />;
}
