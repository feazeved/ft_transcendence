COMPOSE = docker compose

define CHECK_DRIFT
from django.apps import apps
from django.db import connection
cursor = connection.cursor()
drifted = False
for model in apps.get_app_config("game_api").get_models():
    in_db = {c.name for c in connection.introspection.get_table_description(cursor, model._meta.db_table)}
    # `f.column` is None for a CompositePrimaryKey, which has no column of its
    # own — that is TournamentParticipant, and it is not drift.
    missing = {f.column for f in model._meta.local_fields if f.column} - in_db
    if missing:
        drifted = True
        print(model._meta.db_table, "lacks", sorted(missing))
print("No drift." if not drifted else "Drifted -- see docs/adr/0003-applied-migrations-are-never-edited.md")
endef
export CHECK_DRIFT

.PHONY: all check-env up down re build reset-db logs ps fclean backend-shell frontend-shell db-shell migrate makemigrations check-drift test-api test-engine backend-tests superuser

all: up

check-env:
	@test -f .env || { \
		echo ""; \
		echo "  ERROR: .env is missing."; \
		echo ""; \
		echo "  cp .env.example .env"; \
		echo ""; \
		echo "  Then set DJANGO_SECRET_KEY, and make sure the user/password/db inside"; \
		echo "  DATABASE_URL match POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB."; \
		echo ""; \
		exit 1; \
	}

up: check-env
	$(COMPOSE) up --build -d

down:
	$(COMPOSE) down

re: down up

build:
	$(COMPOSE) build --no-cache

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

fclean:
	$(COMPOSE) down -v --rmi all --remove-orphans

backend-shell:
	$(COMPOSE) exec backend sh

frontend-shell:
	$(COMPOSE) exec frontend sh

db-shell:
	$(COMPOSE) exec db psql -U $$POSTGRES_USER -d $$POSTGRES_DB

migrate:
	$(COMPOSE) exec backend python manage.py migrate

makemigrations:
	$(COMPOSE) exec backend python manage.py makemigrations

# Every model column the database is missing. An applied migration that was
# edited afterwards drifts silently until a query fails somewhere unrelated —
# see docs/adr/0003-applied-migrations-are-never-edited.md.
check-drift:
	$(COMPOSE) exec backend python manage.py shell -c "$$CHECK_DRIFT"

# A one-second disconnect grace, for the tests only.
#
# A player who drops out of a pending room has their seat held for
# GAME_DISCONNECT_GRACE_SECONDS (ten, so a page refresh does not lose it) by a
# thread that sleeps it out. The socket tests run last, so the last of those
# threads are still sleeping when the run finishes — they wake up to a test
# database that has just been destroyed and print a stack trace underneath the
# result, which reads as a failure and is not one.
#
# Nothing in the suite asserts on how long the grace is, so one second is
# enough: every thread has woken, done its work against a database that still
# exists, and finished, before the run ends.
test-api:
	$(COMPOSE) exec -e DJANGO_GAME_DISCONNECT_GRACE_SECONDS=1 backend python manage.py test -v 3 game_api

test-engine:
	$(COMPOSE) exec backend pytest -vvv game_engine/tests

backend-tests: test-engine test-api

superuser:
	$(COMPOSE) exec backend python manage.py createsuperuser

reset-db: check-env
	$(COMPOSE) down -v
	$(COMPOSE) up --build -d
