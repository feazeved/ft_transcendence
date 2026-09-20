import uuid
import math
import random
import string

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.core.validators import FileExtensionValidator, MaxValueValidator, MinValueValidator
from django.db import models, transaction
from django.db.models import Q
from django.utils import timezone


def avatar_upload_to(instance, filename):
    ext = filename.rsplit('.', 1)[-1].lower()
    return f'avatars/{instance.public_id}.{ext}'


class StoredFile(models.Model):
    """An uploaded file's bytes, kept in the database.

    Nothing that runs this app has a disk worth writing to: the container's
    filesystem is thrown away on every deploy and every restart, which is how a
    whole team's avatars disappeared at once and everybody silently fell back to
    the default picture (docs/adr/0005-uploaded-files-live-in-the-database.md).
    The database is the only thing here that outlives a deploy, so that is where
    an upload goes. `game_api.storage.DatabaseStorage` is what reads and writes
    these rows; nothing else should touch them directly.
    """

    name = models.CharField(max_length=255, unique=True)
    content = models.BinaryField()
    content_type = models.CharField(max_length=100, blank=True)
    size = models.PositiveIntegerField()
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
JOIN_CODE_LENGTH = 4

def _generate_code(model):
    while True:
        code = ''.join(random.choices(JOIN_CODE_ALPHABET, k=JOIN_CODE_LENGTH))
        if not model.objects.filter(join_code=code).exists():
            return code


def generate_code():
    return _generate_code(Game)


def generate_tournament_code():
    """
    Tournaments need a code people can read out, exactly as rooms do.

    `public_id` is a UUID: it cannot go in the badge on a card, it cannot be
    said out loud, and `/tournament/<uuid>` is not a link anybody pastes to a
    friend. Codes are unique per model and the two namespaces are separate —
    a room and a tournament may share a code, because they are never looked up
    in the same place.
    """
    return _generate_code(Tournament)


# --- Enums -------------------------------------------------------------

class LanguageCode(models.TextChoices):
    EN = 'en', 'English'
    ES = 'es', 'Spanish'
    FR = 'fr', 'French'
    PT = 'pt', 'Portuguese'


class UiTheme(models.TextChoices):
    LIGHT = 'light', 'Light'
    DARK = 'dark', 'Dark'


class FriendshipStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    ACCEPTED = 'accepted', 'Accepted'
    DECLINED = 'declined', 'Declined'
    BLOCKED = 'blocked', 'Blocked'


class GameStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    IN_PROGRESS = 'in_progress', 'In progress'
    FINISHED = 'finished', 'Finished'
    CANCELLED = 'cancelled', 'Cancelled'


class CardColor(models.TextChoices):
    RED = 'red', 'Red'
    YELLOW = 'yellow', 'Yellow'
    GREEN = 'green', 'Green'
    BLUE = 'blue', 'Blue'
    WILD = 'wild', 'Wild'


class PlayerKind(models.TextChoices):
    HUMAN = 'human', 'Human'
    AI = 'ai', 'AI'


class AiDifficulty(models.TextChoices):
    EASY = 'easy', 'Easy'
    MEDIUM = 'medium', 'Medium'
    HARD = 'hard', 'Hard'


class ChatMessageType(models.TextChoices):
    TEXT = 'text', 'Text'
    GAME_INVITE = 'game_invite', 'Game invite'
    SYSTEM = 'system', 'System'


# --- Tables --------------------------------------------------------------

class User(AbstractUser):
    public_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    email = models.EmailField(unique=True)
    display_name = models.CharField(max_length=40, blank=True)
    avatar = models.ImageField(
        upload_to=avatar_upload_to,
        blank=True,
        null=True,
        validators=[FileExtensionValidator(['png', 'jpg', 'jpeg'])],
    )
    oauth_provider = models.CharField(max_length=20, blank=True, null=True)
    oauth_id = models.TextField(blank=True, null=True)
    totp_secret_encrypted = models.BinaryField(blank=True, null=True)
    language = models.CharField(max_length=5, choices=LanguageCode.choices, default=LanguageCode.EN)
    theme = models.CharField(max_length=5, choices=UiTheme.choices, default=UiTheme.LIGHT)
    accepted_privacy_at = models.DateTimeField(blank=True, null=True)
    last_seen_at = models.DateTimeField(blank=True, null=True)
    deleted_at = models.DateTimeField(blank=True, null=True)

    DEFAULT_AVATAR_URL = f'{settings.STATIC_URL}avatars/default.jpg'

    @property
    def avatar_url(self):
        """Uploaded avatar URL, or the site default if the user has not set one."""
        if self.avatar:
            return self.avatar.url
        return self.DEFAULT_AVATAR_URL

    @property
    def is_online(self):
        """
        A live presence connection, not "seen in the last five minutes":
        `PresenceConsumer` stamps `last_seen_at` on the way out too, so that
        answered the wrong question. The socket's Redis count is the one answer.
        """
        from . import presence

        return presence.is_online(self.pk)

    def accepted_friend_ids(self):
        accepted = Friendship.objects.filter(Q(requester=self) | Q(addressee=self), status=FriendshipStatus.ACCEPTED).values_list("requester_id", "addressee_id")
        return [addressee_id if requester_id == self.pk else requester_id for requester_id, addressee_id in accepted]

    def is_blocked_with(self, other):
        return Friendship.objects.filter(
            Q(requester=self, addressee=other) | Q(requester=other, addressee=self),
            status=FriendshipStatus.BLOCKED,
        ).exists()

    def __str__(self):
        return self.username


class Friendship(models.Model):
    requester = models.ForeignKey(User, on_delete=models.CASCADE, related_name='friendships_sent')
    addressee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='friendships_received')
    status = models.CharField(max_length=10, choices=FriendshipStatus.choices, default=FriendshipStatus.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['requester', 'addressee'], name='unique_friendship_pair'),
        ]

    def __str__(self):
        return f'{self.requester_id} -> {self.addressee_id} ({self.status})'


# The mirror of `computeStructure()` in frontend/src/lib/tournamentStructure.js.
#
# The create dialog previews the rounds live from that function and refuses to
# promise a shape that never comes down to one table. The server has to reach the
# same verdict, for anything that is not the dialog — and reach it the same way,
# or a host would be shown one tournament and given another.
#
# `floor(x + 0.5)` on purpose: Python's `round` rounds a half to the nearest even
# number, so `round(2.5)` is 2 here and 3 in JavaScript.
HARD_ITERATION_CAP = 64


def tables_for(player_count, players_per_table):
    if player_count <= players_per_table:
        return 1
    return max(1, math.floor(player_count / players_per_table + 0.5))


def tournament_converges(players, players_per_table, advance_per_table):
    """Whether these settings ever reduce to a single final table."""
    per_table = max(2, int(players_per_table or 0))
    advance = max(1, int(advance_per_table or 0))
    remaining = max(0, int(players or 0))

    if remaining <= per_table:
        return True

    for _ in range(HARD_ITERATION_CAP):
        tables = tables_for(remaining, per_table)
        advancing = tables * advance
        if advancing >= remaining:
            return False
        if advancing <= per_table:
            return True
        remaining = advancing
    return False


class TournamentFormat(models.TextChoices):
    KNOCKOUT = 'knockout', 'Knockout'
    BESTOF = 'bestof', 'Best of 3'


class Tournament(models.Model):
    public_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    # The short code the design puts in a badge and in the URL. See
    # generate_tournament_code() for why a UUID could not do this job.
    join_code = models.CharField(max_length=10, unique=True, db_index=True, default=generate_tournament_code)
    name = models.CharField(max_length=80)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='tournaments_created'
    )
    status = models.CharField(max_length=15, choices=GameStatus.choices, default=GameStatus.PENDING)
    max_participants = models.PositiveSmallIntegerField()
    winner = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='tournaments_won'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(blank=True, null=True)

    # How the tournament is shaped and how its games are played. Flat on the
    # model, not a nested blob, because a tournament *is* its own config: the
    # structure function and the settings panel both read it directly, with no
    # unwrapping step (frontend/src/lib/tournamentStructure.js).
    format = models.CharField(max_length=10, choices=TournamentFormat.choices, default=TournamentFormat.KNOCKOUT)
    players_per_table = models.PositiveSmallIntegerField(
        default=5, validators=[MinValueValidator(4), MaxValueValidator(7)]
    )
    advance_per_table = models.PositiveSmallIntegerField(
        default=2, validators=[MinValueValidator(1), MaxValueValidator(3)]
    )
    starting_hand_size = models.PositiveSmallIntegerField(
        default=7, validators=[MinValueValidator(1), MaxValueValidator(20)]
    )
    turn_timer_seconds = models.PositiveIntegerField(
        default=30, validators=[MinValueValidator(5), MaxValueValidator(300)]
    )
    # Knockout only.
    final_best_of_3 = models.BooleanField(default=True)
    # Best-of only.
    matches_per_round = models.PositiveSmallIntegerField(default=3)
    matches_in_final = models.PositiveSmallIntegerField(default=5)
    # The same five house rules a room has, handed to every game the tournament
    # creates.
    draw_stacking = models.BooleanField(default=False)
    jump_in = models.BooleanField(default=False)
    draw_until_playable = models.BooleanField(default=False)
    seven_swap = models.BooleanField(default=False)
    zero_swap = models.BooleanField(default=False)

    def table_count(self, player_count):
        """How many tables `player_count` people sit at. See `tables_for`."""
        return tables_for(player_count, self.players_per_table)

    def start(self):
        participants = list(self.participants.select_related('user'))
        random.shuffle(participants)
        for i, participant in enumerate(participants, start=1):
            participant.seed = i
        TournamentParticipant.objects.bulk_update(participants, ['seed'])

        self.status = GameStatus.IN_PROGRESS
        self.save(update_fields=['status'])
        self._start_round(1, [p.user for p in participants])

    def _start_round(self, round_number, players):
        """
        Seat everybody still in at tables of `players_per_table`.

        The old version paired people off two at a time with `max_seats=2` and a
        hardcoded hand of seven, which is a knockout ladder and not the thing the
        host set up: the structure panel promises rounds of tables seating four
        to seven with one to three advancing from each. Every table now carries
        the tournament's own settings — hand size, turn timer and the five house
        rules — so the games are played the way the tournament says.
        """
        players = list(players)
        random.shuffle(players)

        tables = self.table_count(len(players))
        # Round-robin rather than slicing, so the tables come out within one
        # player of each other instead of leaving a last table of one.
        seatings = [[] for _ in range(tables)]
        for index, player in enumerate(players):
            seatings[index % tables].append(player)

        for seating in seatings:
            if not seating:
                continue
            if len(seating) == 1:
                # Nobody to play: this person goes through without a game. It can
                # only happen with fewer players than tables, which the structure
                # never asks for, but a tournament must not stall on it.
                Game.objects.create(
                    host=seating[0], tournament=self, tournament_round=round_number,
                    max_seats=2, starting_hand_size=self.starting_hand_size,
                    turn_timer_seconds=self.turn_timer_seconds,
                    status=GameStatus.FINISHED, winner=seating[0], finished_at=timezone.now(),
                    **{field: getattr(self, field) for field in MODIFIER_FIELDS},
                )
                continue

            game = Game.objects.create(
                host=seating[0], tournament=self, tournament_round=round_number,
                max_seats=len(seating), starting_hand_size=self.starting_hand_size,
                turn_timer_seconds=self.turn_timer_seconds,
                **{field: getattr(self, field) for field in MODIFIER_FIELDS},
            )
            GamePlayer.objects.bulk_create([
                GamePlayer(game=game, user=player, seat=seat,
                           display_name=getattr(player, 'display_name', '') or player.username)
                for seat, player in enumerate(seating)
            ])
            self._notify_table(game, seating)

        # A single table is the final: whoever wins it wins the tournament.
        return tables

    def _notify_table(self, game, seating):
        """Tell everyone seated here that their match is ready, once it exists."""
        from . import consumers

        notice = {
            'kind': 'tournament_match',
            'tournament': self.join_code,
            'tournament_name': self.name,
            'round': game.tournament_round,
            'room_code': game.join_code,
            'game_id': str(game.public_id),
        }
        user_ids = [player.pk for player in seating if player is not None]
        transaction.on_commit(lambda: [consumers.notify_user(user_id, notice) for user_id in user_ids])

    def _advancing_from(self, game):
        """The top `advance_per_table` of one table, best placing first."""
        seats = (
            GamePlayer.objects
            .filter(game=game, finish_position__isnull=False)
            .select_related('user')
            .order_by('finish_position')
        )
        movers = [seat.user for seat in seats if seat.user_id is not None]
        if not movers and game.winner_id is not None:
            # A walkover has a winner but no placings.
            movers = [game.winner]
        return movers[:self.advance_per_table]

    def maybe_advance(self, finished_round):
        round_games = list(self.games.filter(tournament_round=finished_round))
        if any(g.status in (GameStatus.PENDING, GameStatus.IN_PROGRESS) for g in round_games):
            return

        # One table means that was the final.
        if len(round_games) <= 1:
            self._finish(round_games[0] if round_games else None)
            return

        movers = []
        for game in round_games:
            movers.extend(self._advancing_from(game))

        if len(movers) <= 1:
            self._finish(round_games[0] if round_games else None, winner=movers[0] if movers else None)
            return

        self._start_round(finished_round + 1, movers)

    def _finish(self, final_game, winner=None):
        """
        Close the tournament and write the podium.

        `final_position` is what `FinalResults` draws 1st, 2nd and 3rd from, and
        nothing used to write it — the column existed, the serializer sent it,
        and every value was null, so even a finished tournament showed no podium
        at all. The places come from the final table's own finishing order.
        """
        if winner is None and final_game is not None:
            winner = final_game.winner

        if final_game is not None:
            placings = (
                GamePlayer.objects
                .filter(game=final_game, finish_position__isnull=False)
                .order_by('finish_position')
                .values_list('user_id', 'finish_position')
            )
            by_user = {user_id: position for user_id, position in placings if user_id is not None}
            if by_user:
                entries = list(self.participants.filter(user_id__in=by_user))
                for entry in entries:
                    entry.final_position = by_user[entry.user_id]
                TournamentParticipant.objects.bulk_update(entries, ['final_position'])
            elif winner is not None:
                self.participants.filter(user=winner).update(final_position=1)

        self.status = GameStatus.FINISHED
        self.winner = winner
        self.finished_at = timezone.now()
        self.save(update_fields=['status', 'winner', 'finished_at'])

        from . import consumers

        notice = {
            'kind': 'tournament_over',
            'tournament': self.join_code,
            'tournament_name': self.name,
            'winner': winner.username if winner is not None else None,
        }
        user_ids = list(self.participants.values_list('user_id', flat=True))
        transaction.on_commit(lambda: [consumers.notify_user(user_id, notice) for user_id in user_ids])

    def __str__(self):
        return self.name


class TournamentParticipant(models.Model):
    pk = models.CompositePrimaryKey('tournament_id', 'user_id')
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='participants')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tournament_entries')
    seed = models.PositiveSmallIntegerField(blank=True, null=True)
    final_position = models.PositiveSmallIntegerField(blank=True, null=True)

    def __str__(self):
        return f'{self.user_id} in {self.tournament_id}'


MODIFIER_FIELDS = ("draw_stacking", "jump_in", "draw_until_playable", "seven_swap", "zero_swap")


class Game(models.Model):
    public_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    host = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='hosted_games')
    tournament = models.ForeignKey(
        Tournament, on_delete=models.SET_NULL, null=True, blank=True, related_name='games'
    )
    tournament_round = models.PositiveSmallIntegerField(blank=True, null=True)
    status = models.CharField(max_length=15, choices=GameStatus.choices, default=GameStatus.PENDING)
    mode = models.CharField(max_length=32, blank=True)
    name = models.CharField(max_length=64, blank=True, default="")
    join_code = models.CharField(max_length=10, unique=True, db_index=True, default=generate_code)
    allow_spectators = models.BooleanField(default=True)
    max_seats = models.PositiveSmallIntegerField(validators=[MinValueValidator(2), MaxValueValidator(10)])
    starting_hand_size = models.PositiveSmallIntegerField()
    turn_timer_seconds = models.PositiveIntegerField(blank=True, null=True)
    turn_started_at = models.DateTimeField(blank=True, null=True)
    draw_stacking = models.BooleanField(default=False)
    jump_in = models.BooleanField(default=False)
    draw_until_playable = models.BooleanField(default=False)
    seven_swap = models.BooleanField(default=False)
    zero_swap = models.BooleanField(default=False)
    extra_rules = models.JSONField(blank=True, null=True)
    state = models.JSONField(null=True, blank=True)
    winner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='games_won')
    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(blank=True, null=True)

    @classmethod
    def _resolve(cls, code_or_id, queryset=None):
        qs = queryset if queryset is not None else cls.objects
        try:
            val = uuid.UUID(str(code_or_id))
            return qs.get(public_id=val)
        except (ValueError, TypeError, AttributeError):
            pass
        return qs.get(join_code__iexact=code_or_id)

    def __str__(self):
        return f'Game {self.public_id}'


class GamePlayer(models.Model):
    game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name='players')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='game_seats')
    kind = models.CharField(max_length=5, choices=PlayerKind.choices, default=PlayerKind.HUMAN)
    ai_level = models.CharField(max_length=6, choices=AiDifficulty.choices, blank=True, null=True)
    seat = models.SmallIntegerField()
    display_name = models.CharField(max_length=40, blank=True)
    is_connected = models.BooleanField(default=False)
    declared_last_card = models.BooleanField(default=False)
    finish_position = models.SmallIntegerField(blank=True, null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['game', 'seat'], name='unique_game_seat'),
        ]

    def __str__(self):
        return f'seat {self.seat} in game {self.game_id}'

class GameSpectator(models.Model):
    game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name="spectators")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="spectating_games")
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("game", "user")
        ordering = ["joined_at"]

    def __str__(self):
        return f"{self.user.username} spectating {self.game.join_code}"

class Conversation(models.Model):
    user_a = models.ForeignKey(User, on_delete=models.CASCADE, related_name='conversations_as_a')
    user_b = models.ForeignKey(User, on_delete=models.CASCADE, related_name='conversations_as_b')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user_a', 'user_b'], name='unique_conversation_pair'),
            models.CheckConstraint(condition=Q(user_a__lt=models.F('user_b')), name='conversation_canonical_order'),
        ]

    @classmethod
    def between(cls, user1, user2):
        a, b = (user1, user2) if user1.pk < user2.pk else (user2, user1)
        conversation, _ = cls.objects.get_or_create(user_a=a, user_b=b)
        return conversation

    def other_participant(self, user):
        return self.user_b if user.pk == self.user_a_id else self.user_a

    def __str__(self):
        return f'Conversation({self.user_a_id}, {self.user_b_id})'


class ConversationRead(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='read_states')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='conversation_read_states')
    last_read_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['conversation', 'user'], name='unique_conversation_read_state'),
        ]


class ChatMessage(models.Model):
    game = models.ForeignKey(
        Game, on_delete=models.CASCADE, related_name='chat_messages', null=True, blank=True
    )
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name='messages', null=True, blank=True
    )
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='chat_messages')
    message_type = models.CharField(max_length=15, choices=ChatMessageType.choices, default=ChatMessageType.TEXT)
    body = models.CharField(max_length=500, blank=True)
    invited_game = models.ForeignKey(
        Game, on_delete=models.SET_NULL, null=True, blank=True, related_name='chat_invites'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(game__isnull=False, conversation__isnull=True)
                    | Q(game__isnull=True, conversation__isnull=False)
                ),
                name='chat_message_exactly_one_of_game_or_conversation',
            ),
        ]

    def __str__(self):
        return f'{self.user_id}: {self.body[:30]}'
