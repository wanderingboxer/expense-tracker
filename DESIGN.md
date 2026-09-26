# Design System

## Context

Personal (solo-user) expense tracker. Not a marketed product — no landing
page, no growth surfaces. The design goal is that the existing dashboard
pages feel like a considered personal finance tool rather than an
unmodified UI-library starter (the "default Tailwind + shadcn" tell: bright
default `emerald-600` used as both the brand accent *and* the "this is
money" color, generic cool grays, unused semantic tokens).

**The one thing to remember:** this looks like a tool one person built
carefully for themselves, not a template nobody customized.

## Root problem found

`globals.css` already defines a full shadcn-style token system
(`--primary`, `--secondary`, `--accent`, `--border`, etc.) and every UI
primitive (`Button`, `Card`, `Badge`, `Dialog`, `Input`) correctly consumes
those tokens — but the actual page code never uses them. Every page
hardcodes raw Tailwind utilities (`bg-emerald-600`, `text-gray-900`,
`border-gray-200`) directly instead of the semantic tokens, so:

1. The token system is dead code — changing `--primary` in `:root` does
   nothing visible today.
2. The same `emerald-600` is used for two unrelated things: the app's
   brand/action color (nav highlight, primary buttons, logo) *and* the
   semantic "this transaction is income" color. Conflating them means the
   nav highlight and a green income figure read as the same signal.

## Decisions

### Color

- **Brand/action accent → indigo**, not emerald. Used for the sidebar's
  active nav state, primary buttons, links, and focus rings. Wired through
  the *existing* `--primary`/`--ring`/`--sidebar-primary` tokens in
  `globals.css`, not hardcoded per page, so it can be changed once from
  here in future.
- **Neutrals → slate**, not gray. Slate reads slightly warmer/more
  designed and shares an undertone with indigo, so text/borders/cards feel
  like part of the same system as the accent instead of a generic
  Tailwind gray scale sitting next to an arbitrary green.
- **Money semantics stay green/red** (`emerald`/`rose`), but now mean only
  one thing — income vs. expense — instead of also standing in for "this
  is a button." Kept where each page already does this correctly
  (transaction type badges, amount signs).
- **Radius bumped** from `0.5rem` to `0.75rem` — slightly softer corners
  read as more considered than the shadcn default, without going
  full-rounded/playful (this is a finance tool, not a consumer social app).

### Typography

- Kept Geist Sans (already wired via `next/font`) — it's an excellent,
  neutral, modern typeface; the generic feeling wasn't coming from the
  font.
- **Convention adopted: `tabular-nums` on every monetary figure.**
  Proportional numerals in amount columns is one of the most common
  "unpolished" tells in financial UIs — digits don't align, so a column of
  amounts looks ragged instead of scannable. Applied to the transaction
  detail page's headline amount; adopt the same class on any new amount
  display.

### Layout

- No structural layout changes — the existing dashboard shell (sidebar +
  header + content) is a reasonable, standard pattern for this kind of
  app. The fix here was about finishing the token system that was already
  half-built, not replacing the layout.

## Scope of this pass

Given this is a functional-correctness-first session (see
`docs/designs/production-grade-sync-plan.md`), the design pass covers the
shared chrome that's visible on every page — `globals.css` tokens, the
dashboard sidebar/header, and the login page — rather than manually
revisiting every individual page's hardcoded utility classes. Those pages
already use `emerald`/`rose` correctly for money semantics and `gray-*`
neutrals that read fine on their own; the priority fix was decoupling
brand color from money color and actually wiring the token system that
existed but was unused. Future page work should reach for
`bg-primary`/`text-primary`/`bg-secondary` etc. over hardcoded Tailwind
colors, so this doesn't regress back to scattered one-off values.
