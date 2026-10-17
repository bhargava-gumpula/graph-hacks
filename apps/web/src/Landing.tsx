import { Hero } from "./landing/Hero";
import { Nav } from "./landing/Nav";

export function Landing() {
  return (
    <div className="grain min-h-[100dvh]">
      <Nav />
      <main>
        <Hero />
        {/* U2: storyline, object breakdown, benchmark, competitors, try it. */}
      </main>
    </div>
  );
}
