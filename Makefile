COMPOSE = docker compose

.PHONY: all up down re build logs ps fclean backend-shell frontend-shell db-shell migrate makemigrations superuser

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
	$(COMPOSE) backend python manage.py makemigrations

superuser:
	$(COMPOSE) backend python manage.py createsuperuser
