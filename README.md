**ClientLibrary**
Indigo's Client Library 
# Indigo's Client Library

A centralized repository for Indigo's client builds, assets, and tools. This library serves as the primary archive for distributed versions and specialized Minecraft content.

---

## Domain Reference
**Primary Access:** [mca.glacierclient.xyz](https://mca.glacierclient.xyz)

---

## Structure
The library is organized by version-specific directories located within the `ClientLibrary/` root path. Each directory contains binary assets and configuration files for that specific release.

---

## Supported File Types
The following asset types are officially supported and archived within this library:

| Category | Extensions |
| :--- | :--- |
| **Executables & Libraries** | `.dll`, `.so`, `.apk` |
| **Archives** | `.zip` |
| **Minecraft Specific** | `.mcpack`, `.mcaddon` |

---

## Usage
This repository is designed to be interfaced with via the **Client Archive** web interface. The interface fetches contents dynamically from the main branch, providing:

* **Tabbed Navigation:** Easily switch between different client versions.
* **Global Search:** Find specific archived assets across the entire library.

---

## Contributing
When adding new assets to the library, please adhere to the following guidelines:

* **Validation:** Ensure the file extension is included in the supported list above.
* **Organization:** Place version-specific files into their corresponding folder using the naming convention `Version_X_X`.
* **Filtering:** Avoid including documentation files (like `.md`) inside version folders, as they are filtered out by the automated delivery system.

---

> © 2025 Indigo Tools
