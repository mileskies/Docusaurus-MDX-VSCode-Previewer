# Changelog

All notable changes to the **Docusaurus MDX Previewer** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-03-26

### Added
- **Mermaid Diagram Support**: Added support for rendering Mermaid diagrams in MDX previews using an external server (default: `https://kroki.io`).
  - Users can now include Mermaid code blocks (e.g., ````mermaid ... ````) and see them rendered as SVG diagrams.

### Changed
- Improved rendering performance for complex MDX files with multiple diagrams.

---

## [0.5.0] - 2025-03-15

### Added
- **PlantUML Diagram Support**: Introduced support for rendering PlantUML diagrams in MDX previews.
  - Supports PlantUML code blocks (e.g., ````plantuml ... ````) with rendering via an external server (configurable, default: `https://kroki.io`).

### Fixed
- Minor bug fixes in MDX parsing and preview updates.

---

## [0.0.1] - 2025-03-01

### Added
- **Initial Release**: Basic support for previewing Docusaurus MDX files in VSCode.
  - Real-time preview of MDX content in a Webview panel.
  - Applies Docusaurus light theme styling.
  - Supports inline code and basic Markdown syntax.

### Notes
- Initial version focused on core MDX rendering without diagram support.

---

## Unreleased
- *(No unreleased changes yet)*
