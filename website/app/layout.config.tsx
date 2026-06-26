import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

const GITHUB_URL = "https://github.com/ilianAZZ/mutka";
const DISCORD_URL = "https://discord.gg/RKecKnNYxc";

/**
 * Shared layout options used by both the marketing (home) layout and the docs
 * layout, so the nav bar stays consistent across the whole site.
 */
export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon.png"
          alt="Mutka"
          width={28}
          height={28}
          style={{
            display: "inline-block",
            width: 28,
            height: 28,
            borderRadius: 8,
            marginRight: 8,
            verticalAlign: "-6px",
          }}
        />
        <span style={{ fontWeight: 600 }}>Mutka</span>
      </>
    ),
  },
  githubUrl: GITHUB_URL,
  links: [
    {
      text: "Features",
      url: "/features",
      active: "nested-url",
    },
    {
      text: "Documentation",
      url: "/docs",
      active: "nested-url",
    },
    {
      text: "Discord",
      url: DISCORD_URL,
      external: true,
    },
  ],
};

export { GITHUB_URL, DISCORD_URL };
