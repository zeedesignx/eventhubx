# Architecture SOP: Speaker & Person Management

## 1. Goal
Manage attendee and speaker profiles in Swapcard through the API, facilitating the SaaS platform's "People" management feature.

## 2. Inputs
- `personId` (String): The unique identifier.
- `eventId` (String): Contextual event ID.
- `role` (String): Speaker, Attendee, VIP, etc.
- `firstName`, `lastName`, `email` (Strings): Profile details.

## 3. Tool Logic (Layer 3 mapping)
- **`tools/get_people.py`**: Fetches a paginated list of people in an event. Returns an array matching the Data Schema in `gemini.md`.
- **`tools/upsert_person.py`**: Creates a person if they don't exist, or updates their profile and `role` if they do.

## 4. Edge Cases & Error Handling
- **Duplicate Emails:** Swapcard heavily keys users via email. A mutation attempting to overwrite an existing email might trigger a conflict error. The tool will parse for this specific error and fall back to a modification `Mutation`.
- **Pagination:** `get_people.py` must support cursor-based pagination as large events will not return all profiles in one query.

## 5. Architecture Invariant Reminder
The system does not generate profile images; rather, it handles metadata. Any media handling will be coordinated through Exhibitor logic or Future enhancements.
