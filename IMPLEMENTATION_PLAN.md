# Monis Workspace Builder — Implementation Plan

The repository is currently a greenfield scaffold, so implementation can follow the v3 PRD without migration work.

## 1. Recommended MVP decisions

- Use Tailwind CSS for application layout, responsive behavior, spacing, typography, color tokens, and interaction states.
- Use shadcn/ui as the accessible UI foundation for panels, sheets, dialogs, tooltips, menus, inputs, toggles, and buttons.
- Keep projection values and isometric surface transforms in dedicated scene CSS and TypeScript geometry modules; do not encode dynamic geometry in long Tailwind class strings.
- Use one fixed room angle.
- Keep product sprites single-angle; omit object rotation until multi-angle assets exist.
- Ship six focused categories: chair, monitor, keyboard, lamp, plant, and decor.
- Include two curated presets, but label them generically until real Monis bundle contents are confirmed.
- Use a composed OG card for MVP, not a DOM screenshot.
- Implement duplicate, delete, and move in MVP; show rotate only for products that explicitly provide sprite variants.
- Use USD/week throughout, matching the PRD.
- Keep sound out of the initial release.

### Visual direction

Use the supplied isometric workspace screenshot as the canonical composition, mood, and camera-angle reference, not as an asset source:

- Dark, enclosed diorama presented against a near-black application background.
- Two tall charcoal walls meeting at the rear corner.
- Warm, medium-dark wood floor for contrast.
- Large fixed dark desk as the visual anchor.
- Mostly graphite furniture and equipment with restrained cyan lighting and warm orange highlights.
- Soft ambient shadows and low-key lighting rather than a bright catalog aesthetic.
- Small personality props, such as wall art, a plant, and a pet, added only after the core workspace reads clearly.
- UI chrome should feel lighter and sharper than the room, using translucent dark panels, subtle borders, and strong focus states.

The screenshot must guide composition, palette, density, lighting, and sprite projection. All production sprites, textures, icons, and props must still be original or appropriately licensed.

### Canonical sprite camera

Every generated item—including the desk, chair, monitor, lamp, plant, and accessories—must visually belong to the same camera used by the supplied screenshot.

Treat the reference as an orthographic or near-orthographic dimetric view:

- Keep vertical edges vertical, with no visible perspective convergence.
- Project the two floor axes diagonally at approximately equal and opposite screen angles.
- Preserve the same elevated three-quarter view and amount of visible top surface.
- Use a 2:1-style isometric footprint as the starting point, then visually calibrate against the screenshot rather than relying on a generic "isometric" label.
- Keep a single canonical facing direction for MVP. Items must not be mirrored unpredictably between generations.
- Match the reference lighting: subdued ambient light, shadows falling consistently across the floor, dark graphite materials, and restrained cyan/orange practical accents.

Create and retain a cropped reference board from the supplied screenshot containing representative angle cues:

- One monitor for bezel and screen-plane direction.
- The chair for seat, back, base, and caster projection.
- The desk for the two horizontal floor axes and visible top-face depth.
- The PC cabinet for vertical-edge and side-face proportions.
- The plant pot for floor contact and shadow direction.

Pass this reference board with every sprite-generation request. Text prompts alone are not sufficient to guarantee a coherent camera angle across the catalog.

Each generated asset must be delivered as an isolated transparent-background sprite. The screenshot should never be cropped into the product or used as production pixels.

### Sprite generation and acceptance workflow

For every product:

1. Generate multiple candidates for the first canonical asset in a category using the same reference board and locked camera block.
2. Reject candidates with perspective convergence, the wrong visible side, mirrored orientation, inconsistent elevation, or mismatched light direction.
3. Compare the candidate beside the reference desk/chair/monitor at the intended stage scale.
4. Remove excess transparent padding without changing the contact-point coordinates.
5. Record its logical footprint, display width, contact anchor, and optional variant key in catalog data.
6. Composite it into a scene test with at least three existing approved sprites before accepting it.

An asset is approved only when it aligns with the scene grid and looks like it was rendered by the same camera as the reference screenshot.

Once a category has an approved canonical geometry, create its color and material variants as precise edits of that approved image rather than independent generations. Preserve camera azimuth, elevation, orthographic projection, silhouette, crop, padding, contact points, and lighting. For example, derive the oak desk from the approved graphite desk and the white monitor from the approved black monitor. This prevents small degree-angle drift between variants.

## 2. Architecture

Use a fixed logical scene inside a responsive viewport:

```text
.stage-viewport        responsive clipping/layout container
└─ .stage-shell        applies one responsive scale transform
   └─ .stage           fixed logical size, e.g. 1200 × 800
      ├─ transformed surfaces and footprints
      └─ upright sprite items
```

The viewport calculates one scale factor:

```ts
scale = Math.min(viewportWidth / 1200, viewportHeight / 800);
```

Apply that scale to `.stage-shell`, leaving `.stage` itself as the untransformed logical coordinate space required by the rendering model. Internally, projection, dragging, sprite placement, and footprints continue using the same 1200 × 800 coordinate system.

`ResizeObserver` only updates the stage scale and pointer normalization. This avoids recalculating every origin and tile size at each breakpoint.

### Core boundaries

- `lib/catalog`: typed product and preset data.
- `lib/geometry`: projection, inverse projection, clamping, occupancy, and depth.
- `lib/store`: serializable Zustand state and history.
- `components/scene`: rendering and scene interaction only.
- `components/catalog`: browsing and product insertion.
- `components/inspector`: selected-object controls.
- `components/rent`: pricing, duration, and mock checkout.
- URL serialization remains separate from UI and store persistence.

### Styling boundary

Use each styling tool for a clear purpose:

- **Tailwind CSS:** page layout, responsive variants, spacing, typography, colors, borders, shadows, focus and hover states, and mobile/desktop visibility.
- **shadcn/ui:** accessible application controls and overlays. Components remain local source code and can be adapted to the Monis visual language.
- **CSS custom properties:** shared design tokens and runtime scene values such as `--stage-scale`, surface colors, light intensity, and selection color.
- **Scene CSS modules or a dedicated scene stylesheet:** wall/floor transforms, transform origins, sprite anchors, ambient keyframes, and footprint-plane styling.
- **Inline style objects:** only runtime geometry such as projected `x/y`, z-index, sprite dimensions, and drag-preview coordinates.

Avoid making the scene itself a collection of shadcn components. shadcn belongs to the surrounding product UI; the stage should stay as lean semantic DOM nodes.

## 3. Proposed file structure

```text
app/
  layout.tsx
  page.tsx
  globals.css
  build/
    page.tsx
  api/
    og/
      route.tsx

components/
  builder/
    WorkspaceBuilder.tsx
    BuilderHeader.tsx
    DesktopLayout.tsx
    MobileLayout.tsx
  scene/
    StageViewport.tsx
    IsoStage.tsx
    RoomSurfaces.tsx
    Desk.tsx
    PlacedItem.tsx
    Footprint.tsx
    DragGhost.tsx
    SelectionControls.tsx
    AccessibleItemList.tsx
  catalog/
    CategoryRail.tsx
    MobileCategoryTabs.tsx
    CatalogPanel.tsx
    CatalogSheet.tsx
    ProductCard.tsx
  inspector/
    InspectorPanel.tsx
    OptionControlRenderer.tsx
  pricing/
    RentPill.tsx
    DurationSelector.tsx
  rent/
    RentDialog.tsx
    OrderConfirmation.tsx
  controls/
    SceneControls.tsx
    ShareButton.tsx
    UndoRedoButtons.tsx
  ui/
    button.tsx
    dialog.tsx
    drawer.tsx
    dropdown-menu.tsx
    input.tsx
    scroll-area.tsx
    select.tsx
    separator.tsx
    sheet.tsx
    slider.tsx
    switch.tsx
    tabs.tsx
    tooltip.tsx

lib/
  catalog/
    products.ts
    presets.ts
    types.ts
  geometry/
    constants.ts
    projection.ts
    placement.ts
    collision.ts
    depth.ts
  store/
    build-store.ts
    selectors.ts
    history.ts
  share/
    schema.ts
    codec.ts
    hydrate.ts
  pricing/
    totals.ts
  delivery/
    dates.ts
  motion/
    preferences.ts
  utils/
    ids.ts

public/
  sprites/
  textures/
  icons/

tests/
  geometry/
  store/
  share/
  e2e/
```

Additional root configuration:

```text
components.json          shadcn/ui configuration
postcss.config.mjs       Tailwind/PostCSS integration
```

Only install shadcn components when a concrete feature needs them. This keeps the generated component surface small and intentional.

## 4. Domain model

Separate catalog definitions from placed instances:

```ts
type Zone = 'desk' | 'floor';
type DurationWeeks = 1 | 4 | 12;

interface PlacedItem {
  instanceId: string;
  productId: string;
  zone: Zone;
  col: number;
  row: number;
  options: Record<string, string>;
  spriteVariant?: string;
}

interface BuildState {
  items: PlacedItem[];
  selectedInstanceId: string | null;
  durationWeeks: DurationWeeks;
  surfaces: {
    floor: string;
    wallLeft: string;
    wallRight: string;
  };
}
```

Store actions:

- `addProduct`
- `moveItem`
- `removeItem`
- `duplicateItem`
- `selectItem`
- `setItemOption`
- `setDuration`
- `setSurface`
- `applyPreset`
- `hydrateBuild`
- `undo`
- `redo`
- `reset`

Derived selectors:

- Weekly total.
- Period total.
- Item count.
- Slot counts.
- Rent eligibility.
- Selected product and instance.
- Occupied cells.

Transient drag state should remain local to scene components so pointer movement does not constantly mutate the global store.

## 5. Geometry contract

Keep all geometry functions pure and independently tested:

```ts
projectCell(col, row, grid): ScreenPoint;
unprojectPoint(x, y, grid): FractionalCell;
snapPoint(x, y, grid): GridCell;
clampPlacement(cell, footprint, bounds): GridCell;
getOccupiedCells(item): GridCell[];
getDepth(item): number;
```

Each zone defines:

```ts
interface GridDefinition {
  originX: number;
  originY: number;
  tileWidth: number;
  tileHeight: number;
  columns: number;
  rows: number;
}
```

Use separate floor and desk definitions. Desk positions project into the same stage coordinate system but use a finer grid and a different origin.

Depth ordering should include a stable tie-breaker:

```ts
const depth = col + row;
// Sort by depth, then zone layer, then instanceId.
```

Sprite placement also needs per-product visual offsets because the PNG bounding box will rarely align perfectly with its logical footprint:

```ts
interface SpriteLayout {
  width: number;
  anchorX: number;
  anchorY: number;
}
```

The anchor represents the sprite's floor-contact point, not the image center.

### Physical scale contract

Meters are the source of truth for room dimensions, product footprints, placement, collision, presets, and share state. Pixels are only a rendering result.

Use one canonical logical density throughout the fixed stage:

```ts
const LOGICAL_PX_PER_METER = 160;
```

For untransformed floor and wall source planes, one square meter is `160 × 160` logical pixels. The floor's CSS projection maps each one-meter axis to screen-space vectors:

```ts
const floorAxisX = { x: 80, y: 40 };  // +1 meter on the first floor axis
const floorAxisY = { x: -80, y: 40 }; // +1 meter on the second floor axis
const verticalAxis = { x: 0, y: -160 };
```

These vectors produce a `160 × 80` projected diamond for a square meter. The source square remains `160 × 160`; the floor transform creates the projected shape.

Store product measurements separately from sprite bounds:

```ts
interface PhysicalDimensions {
  widthM: number;
  depthM: number;
  heightM: number;
}

interface Product {
  // Existing catalog fields...
  dimensions: PhysicalDimensions;
  footprint: {
    widthM: number;
    depthM: number;
  };
  spriteLayout: {
    displayWidth: number;
    displayHeight: number;
    contactAnchorX: number;
    contactAnchorY: number;
  };
}
```

The sprite's transparent bounding box is not its physical footprint. Shadows, chair backs, monitor screens, leaves, and transparent padding may extend beyond the contact area. Collision and containment must only use measurements and projected footprint geometry.

#### Example: 1 × 2 meter desk

For a desk that is 2 meters wide and 1 meter deep, aligned to the canonical floor axes:

```ts
const origin = projectFloor(0, 0);

const projectedCorners = [
  origin,
  add(origin, scale(floorAxisX, 2)),
  add(origin, scale(floorAxisY, 1)),
  add(origin, add(scale(floorAxisX, 2), scale(floorAxisY, 1))),
];
```

Its floor-contact polygon has a screen-space bounding box of `240 × 120` logical pixels:

```text
2 m along X = (160, 80)
1 m along Y = (-80, 40)
combined projected footprint = 240 px wide × 120 px tall
```

With a 25 cm floor grid, the desk occupies exactly `8 × 4` cells. A 5 × 4 meter room similarly remains exactly 20 × 16 quarter-meter cells regardless of screen size.

The desk's visual sprite is positioned by its calibrated contact anchor over this polygon. It is not rotated or skewed in CSS because the sprite already contains the canonical camera projection.

#### Desk-surface coordinates

Desk-surface items use a local meter-based coordinate system whose origin is the desk-top corner. For a desk height of `0.75 m`, project the local desk coordinate and then lift it vertically:

```ts
const topOrigin = add(
  projectFloor(desk.xM, desk.yM),
  scale(verticalAxis, 0.75),
);

const itemPoint = add(
  topOrigin,
  add(
    scale(floorAxisX, item.localXM),
    scale(floorAxisY, item.localYM),
  ),
);
```

Desk containment uses the real usable top dimensions. A monitor with a 22 cm deep stand cannot be placed where its measured footprint crosses the edge of an 80 cm deep desk.

#### Sprite calibration

Generated PNGs cannot be trusted to encode exact measurements by themselves. Every sprite must be calibrated against its physical footprint before approval:

1. Project the product's measured footprint into a four-corner screen-space polygon.
2. Place the untransformed sprite over that polygon using its contact anchor.
3. Uniformly resize the sprite until its visible contact points match the projected footprint.
4. Reject the sprite if matching requires non-uniform stretching, rotation, or skewing; that indicates a camera-angle mismatch.
5. Save the approved display dimensions and contact anchor in product metadata.

Add a development-only measurement overlay that can display:

- Room meter lines and quarter-meter grid cells.
- Projected product footprint polygons.
- Sprite contact anchors.
- Width, depth, and height labels.
- Collision and out-of-bounds cells.

An asset is dimensionally approved only when its contact points align with its projected real-world footprint in this overlay.

#### Responsive behavior

The meter-to-logical-pixel ratio never changes. Responsive layout scales the outer stage shell as one unit, so the room, transformed surfaces, footprints, sprites, and measurement overlays shrink or grow together without changing their physical relationships.

## 6. Implementation phases

### Phase 1 — Foundation, measured room, assets, dragging, and zoom

Deliverables:

- Initialize Next.js using the App Router and strict TypeScript.
- Configure Tailwind CSS and establish semantic theme tokens in `app/globals.css`.
- Initialize shadcn/ui with CSS variables and a neutral base theme suitable for heavy visual customization.
- Add only the shadcn primitives required by this phase, starting with `Button`, `Tooltip`, and `Slider`.
- Add Zustand for serializable scene state. Do not add a drag-and-drop dependency.
- Configure linting, formatting, unit tests, and browser tests.
- Establish design tokens, typography, colors, elevation, focus states, radii, and breakpoints.
- Define the dark diorama palette: near-black shell, charcoal walls and furniture, warm wood, cyan accent light, and orange highlight.
- Add reduced-motion utilities.

#### 1. Stage and measured room

- Create a responsive `.stage-viewport`, scaled `.stage-shell`, and fixed `1200 × 800` logical `.stage`.
- Model the default room at approximately `5 m × 4 m × 2.7 m` using `160 logical px = 1 meter` before surface projection.
- Add one floor plane and two wall planes meeting at the rear corner.
- Apply CSS transforms only to the floor and walls. Keep item sprites as untransformed direct children of `.stage`.
- Implement pure projection and inverse-projection helpers from the same surface matrices.
- Add `ResizeObserver`-based fit scaling and pointer-coordinate normalization.
- Add painter's-order sorting for upright sprites.

#### 2. Default room materials

- Generate one original, seamless charcoal wall material and one original, seamless warm wooden floor material.
- Materials must be flat, tileable source textures without baked isometric projection or room perspective.
- Apply projection only through the surface containers' CSS transforms.
- Confirm texture density is tied to meters so the wood planks and wall pattern remain believable at room scale.

#### 3. Ghost footprints

- Add hidden footprint layers as children of the floor, left wall, right wall, and desk surface.
- Reveal only the active zone's ghost while an item is being dragged.
- Store ghost position and dimensions in the parent surface's local meter coordinates so it inherits the correct transform.
- Use clear valid and invalid states for bounds and collision feedback.
- Floor items use floor footprints, wall-mounted items use the relevant wall footprint, and desk accessories use the desk-surface footprint.
- Do not show a wall ghost for products that cannot be wall-mounted.

#### 4. First measured asset set

Use the supplied screenshot as the camera-angle reference and generate two original variations for each category:

- Monitor: black and white.
- Chair: two distinct variations.
- Desk/table: two distinct variations at the same fixed desk anchor.
- Mouse: two variations.
- Keyboard: two variations.
- Headphones: two variations.
- Floor plant: two variations.

This produces 14 approved transparent sprites. Generate at least three candidates per intended sprite and retain only the candidate that matches the canonical camera.

Define real measurements before generating each asset. Initial measurement targets may use:

| Category | Width | Depth | Height | Zone |
|---|---:|---:|---:|---|
| Desk | 2.00 m | 1.00 m | 0.75 m | Fixed floor anchor |
| Monitor | 0.62 m | 0.22 m | 0.48 m | Desk surface |
| Chair | 0.70 m | 0.70 m | 1.15 m | Floor |
| Mouse | 0.07 m | 0.12 m | 0.04 m | Desk surface |
| Keyboard | 0.44 m | 0.14 m | 0.03 m | Desk surface |
| Headphones on stand | 0.20 m | 0.20 m | 0.32 m | Desk surface |
| Floor plant | 0.45 m | 0.45 m | 1.10 m | Floor |

Measurements must be adjusted when a selected design is materially different. Product data, collision footprints, and usable desk space must use those measurements rather than the PNG bounds.

Calibrate each approved sprite against its projected footprint and contact anchor using the development measurement overlay. Never rotate, skew, or non-uniformly stretch item sprites in CSS.

#### 5. Native drag interaction

- Use native HTML draggable elements and React handlers: `draggable`, `onDragStart`, `onDragOver`, `onDrop`, and `onDragEnd`.
- Put the product or instance ID into `dataTransfer` on drag start.
- Normalize the current pointer through the responsive fit and zoom scales before inverse-projecting it into surface coordinates.
- Update transient ghost state during `onDragOver` without writing every movement into Zustand.
- Commit the measured `(xM, yM)` or integer grid cell only on `onDrop`.
- Clear the ghost and transient state on `onDragEnd`, including cancelled drops.
- Use a transparent custom drag image so the browser's default preview does not obscure the scene ghost.
- Enforce zone bounds, measured footprints, collision rules, and maximum instances before committing.

Native HTML drag behavior is not sufficient for dependable one-finger dragging on all mobile browsers. To preserve the mobile-first requirement without a third-party library, implement a small Pointer Events fallback using `pointerdown`, `pointermove`, `pointerup`, and pointer capture. It must call the same projection, validation, ghost, and commit functions as desktop HTML drag events.

#### 6. Canvas zoom

- Add shadcn-based zoom-out, reset, and zoom-in controls.
- Support wheel or trackpad zoom when the pointer is over the stage; do not hijack normal page scrolling outside it.
- Use a camera zoom range such as `0.6×–1.8×` and clamp every update.
- Apply zoom to `.stage-shell` together with responsive fit scaling; do not alter `LOGICAL_PX_PER_METER` or any product measurement.
- Keep zoom centered on the stage initially. Cursor-centered zoom and panning can follow in a later phase.
- Normalize drag coordinates using `effectiveScale = fitScale * zoom` so snapping remains correct at every zoom level.
- Provide keyboard-accessible buttons and expose the current zoom percentage.

Recommended placement policy:

1. Try the category's preferred default cell.
2. Search outward for the nearest free cell.
3. If no valid cell exists, reject insertion with clear feedback.

Checkpoint:

- Next.js, Tailwind CSS, shadcn/ui, Zustand, linting, unit tests, and production build are configured and passing.
- The stage displays two projected walls and one projected floor using original seamless materials.
- Room dimensions and all 14 sprites are recorded in meters and validated with the measurement overlay.
- The 1 × 2 meter desk occupies exactly its projected 1 × 2 meter footprint.
- Items stay aligned with their footprints while resizing and zooming.
- Sprites remain upright and never inherit a wall or floor transform.
- Projection and inverse-projection round-trip tests pass within the accepted tolerance.
- Drag works through native HTML drag events on desktop and the no-library Pointer Events fallback on touch devices.
- Objects cannot leave their zone or overlap invalid occupied cells.
- Dragging does not cause global-store updates on every pointer event.
- Ghost footprints appear only during drag and on the relevant surface.
- Zoom controls work from `0.6×–1.8×` without changing physical scale or snapping accuracy.

### Phase 2 — Catalog, inspector, and pricing

Deliverables:

- Desktop category rail and floating catalog using local shadcn primitives.
- Mobile category tabs and a shadcn-based sheet or drawer.
- Search and "What's New" filtering.
- Dynamic option renderer for color, toggle, and select controls.
- Product name, thumbnail, and weekly price in the inspector.
- Duration selector.
- Animated weekly and period totals.
- Rent eligibility: fixed desk plus at least one added item.

Checkpoint:

- Adding, editing, duplicating, and deleting always updates totals correctly.
- `maxInstances` is enforced in UI and store logic.
- Full catalog and inspector workflow is keyboard-operable.

### Phase 3 — Visual life and production polish

Deliverables:

- Refine the reusable camera-angle reference board from the supplied screenshot as new categories are introduced.
- Retain one locked sprite-generation prompt block covering projection, facing direction, elevation, lighting, background transparency, and prohibited perspective effects.
- Optimize and normalize the approved isometric sprites from Phase 1.
- Reproduce the reference mood with original assets: warm tileable wood floor, charcoal walls, graphite desk, cyan practical light, and selective orange accents.
- Add tileable floor texture and wall treatments.
- Define visual anchor metadata for every sprite.
- Add spring entrances and exits.
- Add plant sway, monitor glow, and lamp-light overlay.
- Pause ambient animation while offscreen.
- Disable ambient loops under `prefers-reduced-motion`.

Asset acceptance criteria:

- Transparent PNG or WebP with consistent camera direction.
- Camera angle and visible top-face depth match the supplied screenshot.
- Vertical edges remain vertical and corresponding floor-plane edges follow the same diagonal axes as the reference.
- Consistent lighting and shadow direction.
- Tight image bounds.
- Explicit contact-point anchor.
- Optimized dimensions and file size.
- No protected Juddesk assets.

Checkpoint:

- Desk, chair, and monitor pass a side-by-side angle calibration before generating the remaining catalog.
- No visible sprite jumping when placeholders are replaced.
- Mobile scene remains responsive with the complete MVP catalog.

### Phase 4 — Sharing and state recovery

Deliverables:

- Versioned, validated URL payload.
- Compact serialization of items, positions, options, surfaces, and duration.
- Hydrate `/build?s=...`.
- Reject malformed payloads safely.
- Update the URL only on committed actions, not drag frames.
- Add copy-link feedback.
- Add a composed OG card using product summary, item count, and weekly total.

Use a schema version from the start:

```ts
interface SharedBuildV1 {
  v: 1;
  i: PlacedItem[];
  d: DurationWeeks;
  s: BuildState['surfaces'];
}
```

Checkpoint:

- A copied URL recreates an identical build in a clean browser session.
- Unknown product IDs and invalid positions degrade safely.
- Typical preset URLs remain within practical browser URL limits.

### Phase 5 — Rent payoff

Deliverables:

- Rent pill opens the confirmation flow.
- Show duration, totals, item list, and Bali delivery date.
- Generate a deterministic mock order ID.
- Add a celebratory transition with reduced-motion fallback.
- Add a scene-summary visual or composed build card.
- Implement accessible dialog focus trapping and focus return.

Delivery dates should be computed through one isolated helper so weekend or business-day rules can be changed later.

Checkpoint:

- Rent is unavailable for an empty build.
- Confirmation values exactly match store selectors.
- The flow works without network access.

### Phase 6 — Release hardening

Deliverables:

- Undo and redo over committed build actions.
- Empty states, capacity errors, and invalid-share recovery.
- Accessible text alternative for the visual scene.
- Image loading placeholders and error fallbacks.
- Responsive testing across narrow phone, tablet, laptop, and large desktop.
- Metadata, favicon, social preview, and deployment configuration.
- Performance profiling and animation cleanup.

Checkpoint:

- No horizontal overflow at 320 px.
- Touch targets are at least 44 × 44 px.
- Main workflow works with keyboard and screen-reader navigation.
- Production build has no runtime dependency on external services.

## 7. Testing strategy

### Unit tests

Prioritize the logic most likely to produce subtle bugs:

- Projection and inverse projection.
- Grid rounding.
- Footprint bounds.
- Collision detection.
- Nearest-valid-cell search.
- Depth sorting.
- Catalog instance limits.
- Pricing selectors.
- Duplication behavior.
- URL encode/decode round trips.
- Malformed URL recovery.
- Delivery-date calculation.

### Component tests

Cover:

- Option controls generated from schema.
- Rent eligibility.
- Catalog capacity states.
- Duration changes.
- Selected-object actions.
- Reduced-motion behavior.

### End-to-end tests

Core reviewer journey:

1. Open the empty builder.
2. Choose a preset or add a chair.
3. Add a monitor and lamp.
4. Drag one desk item and one floor item.
5. Change an option and duration.
6. Copy the share URL.
7. Reload from that URL.
8. Open Rent.
9. Verify confirmation totals and delivery details.

Run this journey at desktop and mobile viewport sizes.

## 8. Performance guardrails

- Keep one DOM node per item plus only necessary interaction elements.
- Avoid rendering the visible grid outside dragging or debug mode.
- Store drag coordinates locally and update through `requestAnimationFrame`.
- Use transform-based movement, not layout properties, during active dragging.
- Lazy-load catalog images outside the active category.
- Prefer optimized WebP or AVIF where transparency quality permits.
- Pause ambient animations using page visibility and intersection state.
- Avoid subscribing the whole builder to the entire Zustand store; use narrow selectors.

## 9. MVP release boundary

A convincing challenge submission should stop after Phase 5 if it includes:

- Stable two-zone snapping.
- Polished sprites for six categories.
- Live weekly pricing.
- Mobile catalog and dragging.
- Contextual options.
- One strong lamp-light interaction.
- Shareable builds.
- A satisfying mock Rent confirmation.

Undo/redo, sound, wandering pets, four-angle rooms, DOM screenshot generation, and broad SKU coverage should remain stretch work until this path is polished.

## 10. First implementation slice

The first vertical slice should prove the riskiest assumptions:

1. Initialize the application and tests.
2. Render a scaled logical stage with floor, walls, and desk.
3. Define both grids.
4. Add one floor placeholder and one desk placeholder.
5. Drag each with a transformed ghost footprint.
6. Resize the viewport and confirm zero drift.
7. Add unit tests for projection, inverse projection, bounds, and snapping.

Do not begin final sprite production or catalog UI until this slice is stable. It establishes the geometry contract that every later feature depends on.
