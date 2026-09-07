import uuid
import random

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.core.validators import FileExtensionValidator, MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone


def avatar_upload_to(instance, filename):
    ext = filename.rsplit('.', 1)[-1].lower()
    return f'avatars/{instance.public_id}.{ext}'


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

    DEFAULT_AVATAR_URL = f'{settings.STATIC_URL}avatars/default.png'
    ONLINE_THRESHOLD = timezone.timedelta(minutes=5)

    @property
    def avatar_url(self):
        """Uploaded avatar URL, or the site default if the user has not set one."""
        if self.avatar:
            return self.avatar.url
        return self.DEFAULT_AVATAR_URL

    @property
    def is_online(self):
        if self.last_seen_at is None:
            return False
        return timezone.now() - self.last_seen_at < self.ONLINE_THRESHOLD

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


class Tournament(models.Model):
    public_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
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
        players = list(players)
        random.shuffle(players)

        bye_player = players.pop() if len(players) % 2 == 1 else None
        for i in range(0, len(players), 2):
            player_a, player_b = players[i], players[i + 1]
            game = Game.objects.create(
                host=player_a, tournament=self, tournament_round=round_number,
                max_seats=2, starting_hand_size=7,
            )
            GamePlayer.objects.create(game=game, user=player_a, seat=0)
            GamePlayer.objects.create(game=game, user=player_b, seat=1)

        if bye_player is not None:
            bye_game = Game.objects.create(
                host=bye_player, tournament=self, tournament_round=round_number,
                max_seats=2, starting_hand_size=7,
                status=GameStatus.FINISHED, winner=bye_player, finished_at=timezone.now(),
            )
            GamePlayer.objects.create(game=bye_game, user=bye_player, seat=0, finish_position=1)

    def maybe_advance(self, finished_round):
        round_games = self.games.filter(tournament_round=finished_round)
        if round_games.filter(status__in=[GameStatus.PENDING, GameStatus.IN_PROGRESS]).exists():
            return

        winners = [g.winner for g in round_games if g.winner_id is not None]
        if len(winners) <= 1:
            self.status = GameStatus.FINISHED
            self.winner = winners[0] if winners else None
            self.finished_at = timezone.now()
            self.save(update_fields=['status', 'winner', 'finished_at'])
        else:
            self._start_round(finished_round + 1, winners)

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
    join_code = models.CharField(max_length=8, blank=True, null=True)
    max_seats = models.PositiveSmallIntegerField(validators=[MinValueValidator(2), MaxValueValidator(10)])
    starting_hand_size = models.PositiveSmallIntegerField()
    turn_timer_seconds = models.PositiveIntegerField(blank=True, null=True)
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
