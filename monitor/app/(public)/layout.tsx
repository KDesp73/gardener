import { PublicNav } from "@/components/public-nav";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PublicNav />
      <main className="flex-1">{children}</main>
    </>
  );
}
