import test from 'node:test'
import assert from 'node:assert/strict'
import { catalogInlineTokens, catalogReferenceURL } from '../src/catalogReferences.ts'

const document = 'techniques/linear-algebra-3d.md'
const repository = 'https://github.com/SamuelHitzinger/3blue1brown-Visuals/blob/codex/lecture-visual-catalog/'

test('catalog references resolve relative to the entry document on the requested branch', () => {
  assert.equal(catalogReferenceURL('../../docs/reference.md', document), repository + 'shared/animlib/docs/reference.md')
  assert.equal(catalogReferenceURL('../../../../backend/prompts/scene-craft.md#viewing-mode', document), repository + 'backend/prompts/scene-craft.md#viewing-mode')
  assert.equal(catalogReferenceURL('#inputs', document), repository + 'shared/animlib/catalog/' + document + '#inputs')
})

test('external source links permit HTTPS without credentials', () => {
  assert.equal(catalogReferenceURL('https://www.rcsb.org/structure/1CRN', document), 'https://www.rcsb.org/structure/1CRN')
  assert.equal(catalogReferenceURL('https://www.rcsb.org/?q=protein#results', document), 'https://www.rcsb.org/?q=protein#results')
})

test('unsafe schemes, hidden separators, absolute paths and repository escapes never become links', () => {
  for (const target of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,hello', 'file:///C:/secret', 'http://example.com', '//example.com', 'https://user:password@example.com', '/etc/passwd', '../../../../../../secret', '%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/secret', '..\\..\\secret', 'java\nscript:alert(1)', 'https%3A%2F%2Fevil.example']) {
    assert.equal(catalogReferenceURL(target, document), null, target)
  }
  assert.equal(catalogReferenceURL('guide.md', '../outside.md'), null)
})

test('inline tokens preserve code literally and turn safe Markdown destinations into links', () => {
  assert.deepEqual(catalogInlineTokens('Use `s.plane` and [API reference](../../docs/reference.md).', document), [
    { type: 'text', text: 'Use ' }, { type: 'code', text: 's.plane' }, { type: 'text', text: ' and ' },
    { type: 'link', text: 'API reference', href: repository + 'shared/animlib/docs/reference.md' }, { type: 'text', text: '.' },
  ])
  const unsafe = catalogInlineTokens('[unsafe](data:text/html,bad) <script>alert(1)</script>', document)
  assert.equal(unsafe.some(token => token.type === 'link'), false)
  assert.equal(unsafe.map(token => token.text).join(''), 'unsafe <script>alert(1)</script>')
  assert.deepEqual(catalogInlineTokens('`[literal](https://example.com)`', document), [{ type: 'code', text: '[literal](https://example.com)' }])
})
