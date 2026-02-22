# Architecture SOP: Exhibitor Management

## 1. Goal
Provide comprehensive, central management of the entire Exhibitor Portal within Swapcard. This includes managing bios, social links, associated booths, and also ensuring proper images (using auto-generated placeholders when needed) exist. The SaaS app replaces the need to edit exhibitors directly in Swapcard.

## 2. Inputs
- `exhibitorId` (String): Database identifier.
- `name` (String): Company or Sponsor name.
- `description` (String): The bio or details.
- `socialLinks` (Array): Website, Twitter, LinkedIn etc.
- `logoUrl` (String): Reference to the image asset.

## 3. Tool Logic (Layer 3 mapping)
- **`tools/get_exhibitors.py`**: Fetch all exhibitors attached to an event including complete details.
- **`tools/upsert_exhibitor.py`**: Handles creation or update of exhibitor details (name, description, links). If `logoUrl` is empty during an upsert, the tool deterministically assigns a placeholder via `ui-avatars.com` and includes it in the mutation payload.

## 4. Edge Cases & Error Handling
- **Asset Upload Errors:** Swapcard GraphQL may require distinct asset upload URLs before mutating the `logoUrl` field or might take direct absolute URLs. The `upsert_exhibitor.py` script must handle a 2-step asset process if required.
- **Placeholder Generation Failure:** If the external placeholder service fails, the tool should log the failure to `progress.md` and skip image assignment, allowing the rest of the profile upsert to parse properly.
- **Partial Updates:** Ensure the GraphQL `Mutation` handles partial profile updates cleanly so existing data is not wiped out unless specified.

## 5. Architecture Invariant Reminder
Rely on Swapcard's Exhibitor schema as the source of truth for active sponsors. If Swapcard introduces new mandatory fields for Exhibitors, this SOP must be updated first.
