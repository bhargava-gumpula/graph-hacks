import { slug } from "../lib/utils";

export const ABOUT_TITLE = "About team notes";

export function renderAbout(teamName: string): { title: string; handle: string } {
  return {
    title: ABOUT_TITLE,
    handle: slug(teamName),
  };
}

export function aboutText(teamName: string): string {
  const view = renderAbout(teamName);
  return view.title + " / " + view.handle;
}
