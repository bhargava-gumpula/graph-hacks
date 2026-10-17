import { AsciiField } from "./landing/AsciiField";
import { Breakdown } from "./landing/Breakdown";
import { Closing } from "./landing/Closing";
import { Compare } from "./landing/Compare";
import { Hero } from "./landing/Hero";
import { Nav } from "./landing/Nav";
import { Proof } from "./landing/Proof";
import { Query } from "./landing/Query";
import { Story } from "./landing/Story";

export function Landing() {
  return (
    <div className="grain relative min-h-[100dvh] overflow-x-clip">
      <AsciiField />
      <Nav />
      <main className="relative z-10">
        <Hero />
        <Story />
        <Breakdown />
        <Query />
        <Proof />
        <Compare />
      </main>
      <div className="relative z-10">
        <Closing />
      </div>
    </div>
  );
}
