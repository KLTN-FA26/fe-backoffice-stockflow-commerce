/**
 * Feature `home` — trang chủ tĩnh, là cổng vào hệ thống.
 *
 * Cố ý KHÔNG có api.ts / schemas.ts / queries.ts / mutations.ts / lifecycle.ts /
 * selectors.ts như quy định 7 file của feature-architecture.md: home không gọi backend,
 * không có chứng từ nên không có vòng đời, và không phải một module trong docs nghiệp vụ.
 */

export { HomeFooter } from "./components/HomeFooter";
export { HomeHero } from "./components/HomeHero";
export { HomeIllustration } from "./components/HomeIllustration";
