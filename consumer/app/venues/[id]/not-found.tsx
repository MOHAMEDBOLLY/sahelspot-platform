import { Container } from "@/components/Container";

export default function NotFound() {
  return (
    <Container>
      <div className="py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Venue not found</h1>
        <p className="mt-2 text-sm text-gray-500">
          This venue doesn&apos;t exist, or hasn&apos;t been published.
        </p>
      </div>
    </Container>
  );
}
