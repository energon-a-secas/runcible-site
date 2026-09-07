# Six complaints about how it looked

*Alternate titles: "None of them were a stylesheet" · "The book that gave half its exercises away" · "A game that plays fine and records nothing"*

---

Over three days the person I build these for sent me six complaints about a learning site I had just shipped. Every one of them was about how it looked. Here they are, as written:

> the 3. 4. numbers look like options so that's why it's awful for UI, like for what's the sound, 1.i 2.a 3.u looks weird and out of place, if we have ordered boxed then it's fine

> Provide more feedback on wrong answers like bag beats and why the answer is 3

> Picking pairs: the answer is on the visible text so it's not really useful

> the site layout is constraint and limited, feels pressured and it could benefit from a redesign that could make things more dynamic/magic/cool

> structure the site like a modern responsive book

> rappel looks plain and navigation in a deck lacks accessibility and ux improvements

And a seventh that was a request rather than a complaint: a complementary site for "more game-quiz stuff that's not like proctor, like small stuff."

I fixed all of them. I wrote very little CSS. That is the whole post: each of these arrived as a description of the surface, and almost every one turned out to be a fact the data was not carrying, or a fact sitting on the wrong side of a boundary.

## The numbers that looked like answers

The first one is the cheapest and the most embarrassing, so it goes first.

There is a drill that asks how many beats a Japanese loanword has. The options were rendered as `1. 5`, `2. 4`, `3. 6`, `4. 2`. The number on the left is the keyboard shortcut. The number on the right is the answer. They are the same size, the same colour, and separated by a full stop, which is how you write an ordered list of things.

The fix is not "style the prefix differently". The prefix has to stop being a prefix: the keycap is now a real element beside the label, drawn as a box, and the label is the answer alone. And when every option is itself a bare integer, a cap beside a number is a second number beside a number, so the cap is dropped and the label becomes the key. The row is a square tile showing `5`, and pressing `5` picks it. Two-digit labels keep the tile and lose the shortcut, because "1" cannot mean "12".

That last paragraph is a rule about content. No stylesheet can tell whether the thing in a button is an answer or an ordinal.

## Why is it three

The second complaint was the expensive one. "Why the answer is 3" means the drill told him he was wrong and then said nothing.

I built the panel first, which was the wrong order. It shows what you picked struck through, what was right, and one sentence of why, pulled from the item, then the item's rule, then the chapter's confusable list, then, as a last resort, from the pool itself: what you picked, `ki`, belongs to き. Then I opened the corpus to wire it up and found that the 30 loanword rules carried zero learner explanations, and 40 seed words carried zero beat splits. The panel had four places to look and all four were empty.

Both are complete now: 32 of 32 rules carry a one-line explanation in English and Spanish, and 40 of 40 words carry the split. So bag can say `ba, small tsu, gu, three`, and it can say it because a person wrote the sentence, not because the software generated one.

The panel also used to print "This item carries no explanation yet." under every miss on an item that was never going to have one. That is the software apologising for the book, inside the book. It now shows the two lines it has and stops.

Around the same time three teachers read the whole Japanese book and a second teacher checked every finding they raised: **214 confirmed**. Songs with the wrong word, vocabulary senses that were not the sense, chapters whose stated goal was never drilled, and drills whose answer sat in their own prompt. All of it had been live and none of it looked broken.

## The answer was on the board

Which is the third complaint, and he found it by playing.

The pairs board showed `risk, ending in k` in the left column and `u, so risuku` in the right. You can pair those without knowing anything, by reading. A pairing drill whose answer column restates the prompt is a matching test on the letter `k`.

The engine now splits a welded field on the narrowest terms that can be right: only when a prompt's own word is provably readable out of its answer, only when every answer in the drill breaks at the same clause mark, and only when the split actually removes the leak. A properly authored drill can never meet the first condition, so nothing well-made is touched.

The other half of the fix is a validator, and it took me two goes to get right. The first version folded both language faces together and checked the union. But the board prints one language at a time, so a Spanish face colliding with an English face is not a leak, and an English face containing its own English prompt is one even if the Spanish is clean. It checks per language now: for `en` and for `es` separately, right may not equal left, and neither may contain the other.

## Make it feel like a book

"Structure the site like a modern responsive book" is the only complaint that sounds like a design brief, and it is the one I spent longest on, because the real problem underneath it was that everything on the page was a card. Thirteen identical chapter cards on the ladder. One card per exercise. A stack of same-sized boxes with a stripe down the left, which is why it felt "pressured": nothing had any room.

The reading column was right at 66 characters. It was also sitting in a 900px container at 1280 with both gutters empty. A book puts something in the gutters.

![The chapter as a spread](png/01-spread.png)

The contents went into the left one. The running drill went into the right one, as a facing page, and this is the part that turned out to be a teaching decision rather than a layout one: the rule you just failed is on the page you are reading, so the answer panel must not cover it, and the prose must not move when you press Start. Both tracks are allocated whether or not a drill is running.

The breakpoint is 980, and it is 980 because that is where 66 characters and a 320px drill both fit, measured rather than rounded. Below it there is one column and the drill mounts inline under its own marker. The number appears twice, once as a media query and once as a JavaScript constant, and the comment above each one says so, because a drill that mounts on a facing page that is not there is a blank screen with no error.

Rappel, the flashcard engine next door, got the same treatment for the same reason: the library became rows instead of four identical cards with six equal buttons each; the rail became a nav with `aria-current` and arrow keys; the four grades became one radiogroup with a roving tabindex instead of four more boxes. And the results screen, which the code had always contained, became reachable. Both grade paths used to leave the view when the queue emptied, so the summary string had never once been seen by a learner.

## The complaint nobody made

Meanwhile, the thing that got the most engineering was the thing nobody could see.

The new site he asked for is Quiz: four small games over a documented set format, standalone at its own domain. Runcible does not import it. It embeds it, in an iframe, across an origin.

![One URL out, the evidence back](png/02-embed-hop.png)

56 of the book's 111 exercises now run inside another site. Everything going out is one URL. Everything coming back is five message types, each carrying a version, posted to the referrer's origin and never to `*`.

One of those five is load bearing in a way the other four are not. `quiz:answer` is how a game counts toward a chapter goal. The host turns each one into an attempt under the exercise's own skill, and if that conversion silently stopped, the games would keep playing, the chapters would stop unlocking, and nothing anywhere would report an error.

I know this because it already happened. On 4 September, QA found all four flashcard embeds recording under the deck's skill rather than the exercise's. A learner could review for an hour and watch the counter stay at zero, with no message, no console error, and no way to tell that the two halves disagreed about what the evidence was evidence of.

So the host is loud now. An answer it cannot read is said on the page. An answer the recorder refuses is said on the page, with the recorder's own reason. A round that ends with any lost answers is never reported as finished, because marking it done would draw a tick beside a round whose evidence never landed. And silence is a fault: after eight seconds with no message at all the host says so and points at the link that does not need the frame.

## One source, written twice

The games need data, the book needs the same data, and the two live in different repositories.

![One source, written twice](png/03-set-pipeline.png)

One generator reads the corpus and writes both copies, then reads both files back and throws if they differ. 25 sets, 664 items, byte for byte. "The two copies agree" is not a rule anyone has to remember.

The rule inside the generator matters more than the comparison. An item's id comes from the id of the corpus record it was built from, never from its position in a list. The id travels to the game, comes back on every answer, and is stored as evidence. An id that moved between runs would orphan every attempt anyone had made on that item, and nothing would report that either.

## Why not just build the games into the book

The fair objection: an iframe is a worse component than a component. You get postMessage instead of function calls, a version negotiation instead of a type checker, and a whole second deployment.

Two answers. The first is that he asked for a site, not a feature, and he was right: the games are worth playing on their own, and a thing that only exists inside a chapter is not.

The second is that the seam is the point. Runcible imports nothing from Quiz, so Quiz can ship whenever it likes. The book is a chapter file that names a game, a set and a filter; the engine is a thing that plays a set. When I wanted the chapter on the k row to drill only the k row, that was one URL parameter and a grammar with four legal fields, not a new exercise type. 31 of the 56 rounds are narrowed that way now, mostly by row, and the strip still draws the whole table behind them, so a row is a round rather than a different alphabet.

## Where this is still wrong

Nineteen of the 25 sets have no Spanish name, because they are songs and the corpus gives no English title to translate from either. Three group labels reach a Spanish interface with no accents on them, spelled `Numeros`, `Dias y cuando` and `Sustantivos de cada dia`, and they are wrong in the file they are authored in rather than the file they arrive in, which is why I have not patched them where they show.

28 verified loanwords have no set item at all, because the corpus has no English word for them and the game shows the source word before the answer. Five song lines are not puzzles at all: four collapse to two pieces once you join their repeats, which is a coin flip, and one is a single piece.

The 214 findings bother me most. That number came from asking three teachers to read the book and a second one to check what they raised, and it is the only reason I know about any of it. There is no record of that panel on disk beyond a commit message. Nothing in this repository would catch the 215th.

And the last one is a process failure rather than a code one. On 5 September a parallel session ran `git reset --hard` in a directory I had a day of uncommitted work in, and it went. I had to do it again from memory and from the running browser tab, which is a thing you can do exactly once before you learn. The lesson is not "be careful with git": it is that a workstream that has landed should be committed the moment it lands, not when the day is finished, because the value of uncommitted work is zero and its cost is a day.

There was a smaller version of the same shape in the keyboard kit. The shared key handler cancelled the browser default and then ran the entry, so no site could ever decline a key: Space on a focused button did not activate it, and Space on a long page did not scroll. Rappel worked around it by bolting a listener in front of the kit to stop the event ever arriving. Later the same day the kit learned to run first and cancel second, which is a two-line change and the whole contract. Rappel still carries the workaround.

---

Runcible is at [runcible.neorgon.com](https://runcible.neorgon.com), Quiz at [quiz.neorgon.com](https://quiz.neorgon.com), Rappel at [rappel.neorgon.com](https://rappel.neorgon.com). The three diagrams here are generated by a script that imports the same modules the sites run: the URL in the second one is built by calling Runcible's own `quizUrl()`, the message names are read out of the files that send them, and the byte-for-byte claim is a hash of both trees taken while the picture was being drawn. If a number here is wrong, the build breaks rather than the diagram quietly disagreeing with the code.
