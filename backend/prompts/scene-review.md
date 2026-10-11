# Review rendered scene

The attached images show sampled frames of the current source. Use any timestamp annotations in the images; never invent the sampling times or claim to have inspected missing frames. Inspect each provided image closely and read the source for transitions between samples.

Report concrete problems: colliding labels or geometry, clipped content, small or low-contrast text, leftover copies or arrowheads, misleading intermediate mathematical states, unexplained snaps, a key point not visibly demonstrated, early answer reveals, inconsistent concept colors, or a mismatch with the actual carried start state. Distinguish a demonstrated problem from something the samples cannot establish. A few still images cannot prove continuous motion or acoustic synchronization.

Check relationships that the plan requires throughout motion: links stay on their endpoints, labels follow their objects, and fixed-length chains do not stretch between poses. Read the source for bindings re-established on carried objects and for transforms that preserve the required distances. s.connect alone does not enforce fixed length; surface connectors intentionally hide when endpoint surfaces overlap. Treat API choice as evidence to investigate, not a defect by itself: report an actual violated requirement, and do not infer changing world-space lengths solely from 3D screen projections.

Fix only demonstrated problems with the smallest change. Prefer removing clutter over adding effects. Keep the same example values, existing object IDs, inherited state, narration, audio asset, end mode, and measured duration. Retain planned interactions and carry/cleanup declarations. The animlib API and timing contract supplied below still apply.

Return one JSON object, without code fences:
{"approved": true, "findings": []}
or
{"approved": false, "findings": [{"timeSec": null, "objectIds": ["affected-id"], "problem": "specific visible problem", "fix": "concrete correction"}], "source": "complete corrected JavaScript source"}

timeSec is scene-local seconds if actually known, otherwise null. A repair must include findings and the entire corrected source. Use validate_output to check the review and corrected source. This is a draft for another render/review, not proof that the changed scene looks correct.
