import { describe, it, expect } from "vitest";
import { safeImageSrc, safeHttpUrl } from "./imageSrc";

describe("safeImageSrc", () => {
  it("allows http(s) URLs", () => {
    expect(safeImageSrc("https://example.com/a.png")).toBe("https://example.com/a.png");
    expect(safeImageSrc("http://example.com/a.png")).toBe("http://example.com/a.png");
  });

  it("allows data:image URIs (base64 and URL-encoded SVG)", () => {
    expect(safeImageSrc("data:image/png;base64,iVBOR")).toBe("data:image/png;base64,iVBOR");
    expect(safeImageSrc("data:image/svg+xml,%3Csvg%3E")).toBe("data:image/svg+xml,%3Csvg%3E");
  });

  it("rejects injection / non-image schemes", () => {
    expect(safeImageSrc("javascript:alert(1)")).toBeUndefined();
    expect(safeImageSrc("data:text/html,<script>1</script>")).toBeUndefined();
    expect(safeImageSrc("data:application/json;base64,e30=")).toBeUndefined();
    expect(safeImageSrc("file:///etc/passwd")).toBeUndefined();
    expect(safeImageSrc("blob:https://x")).toBeUndefined();
    expect(safeImageSrc("")).toBeUndefined();
    expect(safeImageSrc(undefined)).toBeUndefined();
  });

  it("trims surrounding whitespace", () => {
    expect(safeImageSrc("  https://x/a.png  ")).toBe("https://x/a.png");
  });
});

describe("safeHttpUrl", () => {
  it("allows http(s) only", () => {
    expect(safeHttpUrl("https://ada.example.com")).toBe("https://ada.example.com");
    expect(safeHttpUrl("http://x")).toBe("http://x");
  });

  it("rejects everything else", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeHttpUrl("data:image/png;base64,iVBOR")).toBeUndefined();
    expect(safeHttpUrl("mailto:a@b.c")).toBeUndefined();
    expect(safeHttpUrl("/relative")).toBeUndefined();
    expect(safeHttpUrl(null)).toBeUndefined();
  });
});
