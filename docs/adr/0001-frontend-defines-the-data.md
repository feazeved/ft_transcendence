# The frontend defines the data, and the backend matches it

For the redesign, the screens were designed and built before the backend could feed them: tournaments, the lobby message, and several `game_state` fields. We decided that the frontend's fake data (`frontend/src/lib/fakeGameState.js`, and the mock data in `frontend/src/lib/tournaments.js`) is the contract, and the backend changes to match it (tracked in `BACKEND_REDESIGN_TASKS.md`). The alternative, the frontend adapting to whatever the serializers send, would have blocked the redesign on backend work spread across several teammates.

## Consequences

- When the frontend and a serializer disagree on a field name, fix the backend, not the page, unless the team agrees to change the contract (then update the fixture or mock too).
- A screen must fail gently when a field is still missing (a default photo, a hidden badge), never crash.
- The tournament mock stays in production until the tournament backend matches it. Delete it then, not before.
