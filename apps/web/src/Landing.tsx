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
    <div className="grain min-h-[100dvh]">
      <Nav />
      <main>
        <Hero />
        <Story />
        <Breakdown />
        <Query />
        <Proof />
        <Compare />
      </main>
      <Closing />
    </div>
  );
}
