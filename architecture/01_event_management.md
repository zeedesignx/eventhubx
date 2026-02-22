# Architecture SOP: Event Management

## 1. Goal
Provide CRUD (Create, Read, Update, Delete) capabilities for Swapcard Events through the GraphQL API, acting as the foundation for the SaaS application's event management dashboard.

## 2. Inputs
- `eventId` (String): The Swapcard identifier for the event.
- `title` (String): The name of the event.
- `timezone` (String): The timezone of the event.

## 3. Tool Logic (Layer 3 mapping)
- **`tools/get_event.py`**: Executes a standard GraphQL `Query` fetching event details by ID.
- **`tools/update_event.py`**: Executes a GraphQL `Mutation` pushing layout or detail changes back to Swapcard. 

## 4. Edge Cases & Error Handling
- **Missing Permissions:** Ensure `ACCESS_TOKEN` has organizer-level privileges for the specified `eventId`.
- **Invalid Timezone:** Swapcard strictly validates IANA Timezone strings. Tools must validate `timezone` before mutating.
- **Rate Limits:** The SaaS application will cache event data locally and periodically sync to avoid hitting GraphQL query limits. Updates should be batched where possible.

## 5. Architecture Invariant Reminder
If the structure of an Event changes or we need to manage sessions, this SOP must be updated BEFORE any Python logic is modified.
