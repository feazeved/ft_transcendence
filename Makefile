COMPOSE = docker compose

.PHONY: all up down re build logs ps fclean backend-shell frontend-shell db-shell migrate makemigrations test-api test-engine backend-tests superuser

all: up

up:
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

test-api:
	$(COMPOSE) exec backend python manage.py test -v 3 game_api

test-engine:
	$(COMPOSE) exec backend pytest -vvv game_engine/tests

backend-tests: test-engine test-api

superuser:
	$(COMPOSE) exec backend python manage.py createsuperuser
