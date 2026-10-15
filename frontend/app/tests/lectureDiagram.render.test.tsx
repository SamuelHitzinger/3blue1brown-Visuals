import test from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import LectureDiagram from '../src/LectureDiagram'

test('plots and shaded regions render as inert SVG geometry with accessible descriptions', () => {
  const markup = renderToStaticMarkup(<LectureDiagram diagram={{ alt: 'Signed contributions', elements: [
    { type: 'polyline', points: [[30, 90], [80, 20], [120, 60]], color: 'blue' },
    { type: 'polygon', points: [[30, 90], [80, 20], [120, 90]], color: 'teal' },
    { type: 'text', x: 80, y: 110, text: '<script> is text' },
  ] }}/>)
  assert.match(markup, /<polyline[^>]+points="30,90 80,20 120,60"/)
  assert.match(markup, /<polygon[^>]+points="30,90 80,20 120,90"/)
  assert.match(markup, /<title[^>]*>Signed contributions<\/title>/)
  assert.match(markup, /&lt;script&gt; is text/)
  assert.doesNotMatch(markup, /<script>/)
})
