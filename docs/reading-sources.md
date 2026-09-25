# Reading history

`src/data/goodreads.json` is a local snapshot of Conor Svensson's public Goodreads
**read** shelf (user 43402717), retrieved on 24 September 2026. The public RSS feed
was fetched with `shelf=read&per_page=200` for pages 1 and 2, yielding 230 unique
book IDs. This matches the 230-book count in the supplied Goodreads PDF capture.

Source: https://www.goodreads.com/review/list_rss/43402717?shelf=read&per_page=200

Book IDs, titles, authors, completion years and ISO completion dates (`readAt`)
are stored. Dates come from `user_read_at`; missing completion dates remain null.
The RSS feed may encode month-only dates as the first day of the month; dates
are used for sorting, not displayed as assertions of day-level precision. Added dates and publication
years are never used as reading dates. Whitespace in names and titles is normalised.
No ratings, reviews, descriptions or account details are imported.

The existing hand-maintained reading page remains authoritative for its current
lists. Supremacy (202951438) and Breakneck (228303045) already appear under 2026,
so the Goodreads component omits those two duplicate entries. The remaining 228
books are grouped by completion year, with undated books in their own section.
The snapshot builds offline and does not automatically sync with Goodreads.

## Author additions

`src/data/reading-additions.json` records Conor's additions supplied on 25 September
2026. Completion dates were transcribed from his six supplied book photos, interpreting
the handwritten dates as day/month/year and using the end of each reading range.
The untitled photo is Dreamer of Dune; Books 1, 2 and 3 are Dune, Dune Messiah and
Children of Dune. These entries are merged with the Goodreads entries and sorted
by completion date descending within each year. Ties and undated entries retain
source order; no alphabetical sorting is applied.

The ten supplied entries add nine reading events: Book of Lost Tales Part I
replaces its existing 2024 entry. The three 2024 Dune re-reads remain separate
from their earlier reading years and are labelled explicitly. After excluding cookbooks, there are 236
earlier-reading entries, including repeat readings. Goodreads book links identify
the works; they do not assert which editions Conor read.

Photo completion dates:

- Chapterhouse: Dune: 2025-10-03
- The Lays of Beleriand: 2025-06-04
- Dreamer of Dune: 2025-02-27
- Heretics of Dune: 2025-01-04
- God Emperor of Dune: 2024-11-01
- Children of Dune (re-read): 2024-09-13
- The Book of Lost Tales, Part II: 2024-06-30
- Dune Messiah (re-read): 2024-05-03
- The Book of Lost Tales, Part I: 2024-04-05
- Dune (re-read): 2024-03-01

The original Dune completion dates visible in the photos (2020-12-14,
2022-07-02 and 2023-03-26) agree with the Goodreads records.

Cookbooks are excluded from the public list at Conor's request. The current
snapshot contains one: Hawksmoor at Home (13096678). It remains in the source
snapshot but is omitted from the displayed list and search.

## Undated entries and confirmed re-reads

The 94 displayed entries without completion dates now show “Added to Goodreads
in YEAR”, using `user_date_created` from the original feed snapshot. This is
stored as `addedYear`, independently of the completion date. These entries remain
in the undated section; an added year is not treated as a reading year.

Conor confirmed that the 2020 entries for The Hobbit (5907), The Fellowship of
the Ring (3263607), The Two Towers (222910), and The Return of the King (838729)
are re-reads. The component labels them accordingly, alongside the three Dune
re-reads already recorded in the author additions.

## Current presentation

The 142 dated reading events are followed by all 94 undated entries under
“Read — date not recorded”, with a link to Conor's Goodreads read shelf.
Individual added-year labels are omitted. Each year is a level-two heading
continuing the curated 2026 list; there is no “Earlier reading” heading or
separate search. Re-read labels, cookbook exclusion and descending completion-date
ordering remain. The component displays 236 reading events in total.
