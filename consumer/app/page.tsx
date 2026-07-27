import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { HeroSection } from "@/components/HeroSection";
import { FeaturedDestinations } from "@/components/FeaturedDestinations";
import { FeaturedVenues } from "@/components/FeaturedVenues";

export default function Home() {
  return (
    <main className="flex-1">
      <Container>
        <HeroSection />
      </Container>
      <div className="border-t border-gray-200">
        <Section>
          <Container>
            <FeaturedDestinations />
          </Container>
        </Section>
      </div>
      <div className="border-t border-gray-200">
        <Section>
          <Container>
            <FeaturedVenues />
          </Container>
        </Section>
      </div>
    </main>
  );
}
