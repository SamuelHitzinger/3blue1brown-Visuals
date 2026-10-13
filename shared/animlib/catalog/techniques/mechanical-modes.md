# Mechanical vibration and modal superposition

## Inputs and truth
Provide mode shapes, amplitudes, angular frequencies, phases and equilibrium coordinates. Modes are supplied mathematical data: `s.modalState` does not solve the eigenproblem or recover a structure's material properties.

## Construction
Use `s.modalState({modes, equilibrium})`. Its `at(time)` returns displacement, velocity and individual contributions. Begin with one mode and locally indicate stationary nodes and direction. Add a second contribution to the same material points; then let their sum move the structure. Keep material-point identities and draw comparison vectors from the same result.

The [modal-state recipe](../recipes/modal-state.js) gives a compact executable example. With `read_animlib_reference`, request `scientific-modal-state` and `scientific-state-guide`. The [scientific-state contract](../../docs/scientific-state.md) defines bounds and units. Extend the visual from a few masses to a supplied beam shape with `s.path` or fixed-topology `s.deform`; changing representation does not calculate new mechanics.

## Fast path and checks
Build the helper and geometry once. Reuse modal coordinates across all views and inspect motion at quarter-period phases and direct seeks. Test the zero-amplitude state, displacement sums and velocity against finite differences. If claiming orthogonality or modal energy, provide the relevant mass/stiffness matrices and check the correct weighted relationship. Label exaggerated displacement scale.

## Sources and limits
[MIT: normal modes in computational science](https://ocw.mit.edu/courses/18-085-computational-science-and-engineering-i-summer-2020/b1743654e72946982b5c380d02b607f0_MIT18_085Summer20_lec_w4.pdf) motivates supplied-mode superposition. The helper computes undamped prescribed modes. It does not add forcing, contact, damping, resonance response or finite-element analysis. Mathematical tests do not visually approve every beam or machine rendered from them.
