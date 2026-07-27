import { Container } from "./Container";

export function Footer() {
  return (
    <footer className="border-t border-gray-200">
      <Container>
        <div className="flex h-16 items-center text-sm text-gray-500">
          © {new Date().getFullYear()} SahelSpot
        </div>
      </Container>
    </footer>
  );
}
