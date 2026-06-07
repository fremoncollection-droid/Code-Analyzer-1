---
name: Wouter Switch remount trap
description: Dynamic route children inside Wouter Switch cause active page remounts when the array reference changes, resetting all local state.
---

## Rule
Never generate `<Route>` children dynamically inside a `<Switch>` based on async data (e.g. permissions loading from an API). Keep route lists static.

**Why:** When the array of Switch children changes (e.g. after a permissions query resolves), Wouter re-evaluates which Route matches the current path. If the matching Route element is at a different position or has a new identity, Wouter unmounts and remounts it — resetting all local component state (cart contents, form values, etc.). This was the root cause of "can't add items to cart": clicking added items, but when `useListPermissions` resolved milliseconds later, `CashierApp` re-rendered with new route children, Wouter remounted `POSPage`, and `cart` reset to `[]`.

**How to apply:** Always define a full static list of `<Route>` elements in Switch. Use permissions only to control *sidebar visibility* or to render "Access Denied" content *inside* a page — never to conditionally include/exclude Route elements from the Switch.
