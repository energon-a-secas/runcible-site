.DEFAULT_GOAL := help

PORT = 8878

# ── Help ──────────────────────────────────────────────────────────────────────
.PHONY: help
help:
	@echo ""
	@echo "  make serve    Start dev server → http://localhost:$(PORT)"
	@echo "  make kill     Kill this project's HTTP server"
	@echo "  make validate Run every validator. Required before any data/ change lands."
	@echo ""

# ── Dev server ────────────────────────────────────────────────────────────────
# scripts/serve.py is http.server plus Cache-Control: no-cache; a plain
# http.server sends only Last-Modified, so browsers keep stale ES modules after
# edits. Falls back to plain http.server outside the monorepo.
.PHONY: serve
serve:
	@echo "Serving → http://localhost:$(PORT)"
	@if [ -f ../../scripts/serve.py ]; then python3 ../../scripts/serve.py $(PORT); else python3 -m http.server $(PORT); fi

# ── Kill ──────────────────────────────────────────────────────────────────────
.PHONY: kill
kill:
	@lsof -ti :$(PORT) | xargs kill 2>/dev/null && echo "Stopped server on port $(PORT)" || echo "No server running on port $(PORT)"

# ── Validate ──────────────────────────────────────────────────────────────────
# It exits 0, or it exits 1 and names the file and the line. Nothing runs it for
# you: it is not in root `make smoke`. Running it is part of the definition of
# done for any change under data/ or books/.
#
# One target per validator. To wire in another one, add a .PHONY target and a
# bare `validate: <your-target>` line of your own: make collects prerequisites
# from every rule for a target as long as only one of them carries a recipe, so
# two workstreams can each add a validator without editing the other's line.
.PHONY: validate
validate: validate-licence
	@echo "validate: every check passed"

# The banned-song and licence-block gate. DESIGN.md section 6.2: the highest
# consequence rule in this campaign, and this is the only thing that detects it.
.PHONY: validate-licence
validate-licence:
	@node tools/check-licence.mjs

# The Book validator: neo-book-index/1, neo-book/1, neo-chapter/1 (C1 and C3).
# Nothing in this fleet validates a JSON schema (DESIGN.md 6.2), and the shell
# imports this same module at load time, so there is one notion of valid.
validate: validate-books
.PHONY: validate-books
validate-books:
	@node tools/validate-book.mjs

# The four shell rules DESIGN.md 6.2 lists as detected by nothing: module size,
# app.js size, inline onclick, and JSON file size. Each one is a PLAN constraint
# that no smoke check can see.
validate: validate-shell
.PHONY: validate-shell
validate-shell:
	@big=$$(find js books -name '*.js' -not -name 'neorgon-*' -not -path '*/vendor/*' -not -path '*/neokeys/*' 2>/dev/null | xargs wc -l 2>/dev/null | awk '$$1 > 500 && $$2 != "total" { print "  " $$2 " is " $$1 " lines" }'); \
	if [ -n "$$big" ]; then echo "JS modules over 500 lines:"; echo "$$big"; exit 1; fi
	@n=$$(wc -l < js/app.js); \
	if [ $$n -ge 50 ]; then echo "js/app.js is $$n lines, the cap is 50"; exit 1; fi
	@hits=$$(grep -rnE ' on[a-z]+="' index.html 404.html js books 2>/dev/null || true); \
	if [ -n "$$hits" ]; then echo "inline on* handler, which is never allowed:"; echo "$$hits"; exit 1; fi
	@fat=$$(find data books -name '*.json' -size +150k 2>/dev/null); \
	if [ -n "$$fat" ]; then echo "JSON over the 150 KB cap (C11.6):"; echo "$$fat"; exit 1; fi
	@echo "  shell rules ok: module sizes, app.js, no onclick, JSON under 150 KB"

# The derived corpus, workstream Cb: neo-vocab/1, neo-kanji/1, neo-strokes/1
# and neo-sentences/1, plus the two rules that cut across every JSON file in
# the project, the C11.6 size budget and the house dash rule inside string
# values. The deck and ledger schemas belong to Rappel's validator and the
# licence block to check-licence.mjs, so there is one notion of valid per
# schema. Added as its own bare prerequisite line, per the note above.
validate: validate-corpus
.PHONY: validate-corpus
validate-corpus:
	@node tools/validate-corpus.mjs

# The one authored corpus file, data/phrases/ch14.json (neo-phrases/1): the
# sentence patterns and two-turn exchanges chapter 14 shows as prose. Nothing
# in it is ever scored, which is exactly why it needs a gate: an authored line
# is the one place a word the Book never taught can enter. Added as its own
# bare prerequisite line, per the note above.
validate: validate-phrases
.PHONY: validate-phrases
validate-phrases:
	@node tools/validate-phrases.mjs
