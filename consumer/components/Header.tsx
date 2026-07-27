import Link from "next/link";
import { Container } from "./Container";

/** M8 — Search now exists, so it's the first real nav link (destinations
 * still don't have their own page, so nothing else is added yet). */
export function Header() {
  return (
    <header className="border-b border-gray-200">
      <Container>
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="text-lg font-semibold tracking-tight text-gray-900">
            SahelSpot
          </Link>
          <Link href="/search" className="text-sm font-medium text-gray-600 hover:text-gray-900">
            Search
          </Link>
        </div>
      </Container>
    </header>
  );
}
