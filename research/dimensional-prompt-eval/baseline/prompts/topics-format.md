JSON format:
{
  "source_title": str,
  "audience": str,          # who the material is written for and what it assumes
  "assumed": [str],         # prerequisites the material takes for granted
  "topics": [{
    "id": "t01_snake_case",
    "title": str,           # short, e.g. "Matrix multiplication"
    "summary": str,         # 1-2 sentences: what a student should understand afterwards
    "why_visual": str,      # what picture or motion makes this topic click
    "key_ideas": [str],     # the ideas the film must cover, in teaching order
    "requires": [str],      # ids of earlier topics this one builds on
    "source_refs": str,     # where in the source (pages/sections/headings)
    "notes": str            # faithful condensed notes from the source for this topic:
                            # definitions, formulas, worked examples, notation, caveats
  }]
}

Rules:
- Cover the material's main ideas in teaching order; skip administrative text,
  exercises without new ideas, and pure bookkeeping.
- One topic = one film of a few minutes with one central question. Split big chapters;
  merge tiny fragments into the topic they belong to.
- "requires" may only name earlier topic ids.
- Notes must stay faithful to the source's definitions and notation; do not invent
  content the source does not support.
- Return at most {max_topics} topics.
