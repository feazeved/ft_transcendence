# An applied migration is never edited

On 2026-09-18 every `GET /api/games/` returned 500, and Home listed no rooms at all. The cause was that `game_api_game` had no `name` and no `allow_spectators` column, although `0001_initial.py` creates both: someone added the fields by editing `0001_initial.py` after it had already been applied. Django had that migration recorded in `django_migrations`, so it never ran it again, and the table stayed as it was first created. The error it produced — `column game_api_game.name does not exist` — names the symptom and never the cause, and the whole thing cost an evening.

**A migration that has been applied anywhere is history, and history is not edited.** A new or changed field means `make makemigrations`, which writes `0002_…`, `0003_…` and so on. This holds even when the new migration looks redundant, even when the change is one column, and even when "it's only my machine" — because it is not: a teammate who pulls an edited `0001_initial.py` has already applied the old one, so their database drifts exactly the same way, and each person discovers it separately through an error that points somewhere else.

`make re` does not rescue a drifted database, because it keeps the volume. Only `make reset-db` does (`down -v`), and it costs every local account.

To check a database against the models, `make check-drift` prints any table whose model has columns the table lacks. It ignores `TournamentParticipant`'s composite primary key, which has no column of its own and would otherwise report forever.

The rule is worth more than the tidiness: a squashed or rewritten migration is also the one kind of change that passes review, passes tests on the author's machine, and breaks everyone else's.
