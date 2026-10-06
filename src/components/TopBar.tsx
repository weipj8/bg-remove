import { Wordmark } from "./ui";

const NAV = [
  { href: "#how", label: "How it works" },
  { href: "#compare", label: "Results" },
  { href: "#privacy", label: "Privacy" },
  { href: "#faq", label: "FAQ" },
];

export function TopBar() {
  return (
    <header className="border-b border-line/70">
      <div className="mx-auto flex max-w-page items-center justify-between gap-6 px-5 py-4 sm:px-8">
        <a href="#top" className="flex items-center" aria-label="bg-remove — home">
          <Wordmark />
        </a>
        <nav aria-label="Sections">
          <ul className="hidden items-center gap-6 md:flex">
            {NAV.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="readout text-xs text-mute transition-colors hover:text-paper"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
