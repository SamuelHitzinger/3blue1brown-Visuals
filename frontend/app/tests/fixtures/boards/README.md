# Real board detection fixtures

Public-domain photos, resized to 640 pixels wide and JPEG encoded for local,
offline regression tests. Bounds in `boardDetection.test.ts` were marked by
visual inspection, independently of the detector output.

- `teaching-whiteboard.jpg`: [A white board.jpg](https://commons.wikimedia.org/wiki/File:A_white_board.jpg), Umar2z, CC0. Faint metal frame, skew, uneven lighting, handwritten diagrams.
- `classroom-blackboard.jpg`: [Gfp-classroom-and-blackboard.jpg](https://commons.wikimedia.org/wiki/File:Gfp-classroom-and-blackboard.jpg), Yinan Chen, public domain. Perspective, room clutter, board near image edge.
- `office-whiteboard.jpg`: [Whiteboard.jpg](https://commons.wikimedia.org/wiki/File:Whiteboard.jpg), asteinme, public domain. No visible outer board boundary; expected whole-photo fallback rather than cropping an internal drawing.

These are regression examples, not a representative accuracy dataset or a
substitute for testing the user's camera.
