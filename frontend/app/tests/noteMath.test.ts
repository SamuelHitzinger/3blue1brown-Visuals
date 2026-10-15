import test from 'node:test'
import assert from 'node:assert/strict'
import { noteMathImage } from '../src/noteMath.ts'

test('equations render fractions and subscripts as inert SVG images, invalid math falls back', () => {
  const image = noteMathImage('\\Delta S_{surr} = -\\frac{\\Delta H}{T}')
  assert.ok(image?.src.startsWith('data:image/svg+xml,'))
  assert.ok(image!.width > image!.height)
  assert.equal(noteMathImage('\\unknownNotebookCommand{a}'), null)
  assert.equal(noteMathImage('\\href{https://example.com}{click}'), null)
  assert.equal(noteMathImage('a'.repeat(1001)), null)
  const chain = noteMathImage('\\Delta S_{surr} = \\frac{92.4\\,\\mathrm{kJ\\,mol^{-1}}}{298\\,\\mathrm{K}} = +310\\,\\mathrm{J\\,mol^{-1}\\,K^{-1}}')
  assert.ok(chain!.height > 60, 'long equalities stack vertically')
  assert.ok(chain!.width < 400, 'long equalities fit a notebook column')
})
