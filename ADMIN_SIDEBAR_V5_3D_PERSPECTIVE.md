# Admin Sidebar V5 - Subtle 3D Perspective Layer

Implemented a restrained 3D command-center treatment inspired by the provided sketch.

## Changes
- Expanded desktop admin grid from 22rem to 23rem to give the sidebar more horizontal breathing room.
- Added `admin-perspective-layout`, `admin-sidebar-3d`, and `admin-content-plane` classes.
- Added a subtle prism/side-face layer between sidebar and dashboard content.
- Added a very light rotateY treatment on the sidebar shell for depth, with a calmer hover correction.
- Added a soft gradient bridge from the sidebar into the dashboard content plane.
- Kept the effect desktop-only and disabled transform motion for reduced-motion users.

## Design intent
The sidebar now reads as a slightly elevated command column while the main dashboard appears as a connected dynamic plane. The effect is intentionally subtle to avoid a gaming/neon aesthetic.
