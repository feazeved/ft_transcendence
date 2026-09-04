import environ

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings
from django.urls import reverse
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
env = environ.Env()
environ.Env.read_env(BASE_DIR / '.env')
FRONTEND_URL = env('FRONTEND_URL', default='http://localhost:5173')
User = get_user_model()

class RegistrationTests(TestCase):
	def test_signup_creates_a_user_with_a_hashed_password_and_logs_them_in(self):
		response = self.client.post(
			reverse('rest_register'),
			{
				'username': 'alice',
				'email': 'alice@example.com',
				'password1': 'a very unguessable one!',
				'password2': 'a very unguessable one!',
			},
		)
		self.assertEqual(response.status_code, 204)
		user = User.objects.get(username='alice')
		self.assertNotEqual(user.password, 'a very unguessable one!')
		self.assertTrue(user.check_password('a very unguessable one!'))
		self.assertIn('_auth_user_id', self.client.session)

	def test_signup_rejects_mismatched_passwords(self):
		response = self.client.post(
			reverse('rest_register'),
			{
				'username': 'alice',
				'email': 'alice@example.com',
				'password1': 'a very unguessable one!',
				'password2': 'a different one!',
			},
		)
		self.assertEqual(response.status_code, 400)
		self.assertFalse(User.objects.filter(username='alice').exists())

	def test_signup_rejects_duplicate_email(self):
		User.objects.create_user(username='bob', email='dupe@example.com', password='x')
		response = self.client.post(
			reverse('rest_register'),
			{
				'username': 'alice',
				'email': 'dupe@example.com',
				'password1': 'a very unguessable one!',
				'password2': 'a very unguessable one!',
			},
		)
		self.assertEqual(response.status_code, 400)


class LoginLogoutTests(TestCase):
	def setUp(self):
		self.user = User.objects.create_user(
			username='alice', email='alice@example.com', password='correct horse battery staple'
		)

	def test_login_establishes_a_session(self):
		response = self.client.post(
			reverse('rest_login'),
			{'username': 'alice', 'password': 'correct horse battery staple'},
		)
		self.assertEqual(response.status_code, 204)
		self.assertIn('_auth_user_id', self.client.session)
		self.assertEqual(str(self.user.pk), self.client.session['_auth_user_id'])

	def test_login_rejects_wrong_password(self):
		response = self.client.post(
			reverse('rest_login'),
			{'username': 'alice', 'password': 'wrong'},
		)
		self.assertEqual(response.status_code, 400)
		self.assertNotIn('_auth_user_id', self.client.session)

	def test_logout_clears_the_session(self):
		self.client.login(username='alice', password='correct horse battery staple')
		self.assertIn('_auth_user_id', self.client.session)
		response = self.client.post(reverse('rest_logout'))
		self.assertEqual(response.status_code, 200)
		self.assertNotIn('_auth_user_id', self.client.session)

	def test_me_endpoint_requires_authentication(self):
		response = self.client.get(reverse('rest_user_details'))
		self.assertEqual(response.status_code, 403)

	def test_me_endpoint_returns_the_logged_in_user(self):
		self.client.login(username='alice', password='correct horse battery staple')
		response = self.client.get(reverse('rest_user_details'))
		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data['username'], 'alice')
		self.assertEqual(response.data['email'], 'alice@example.com')


class OAuthRoutingTests(TestCase):
	_FAKE_APP = {'client_id': 'test-client-id', 'secret': 'test-secret'}

	@override_settings(SOCIALACCOUNT_PROVIDERS={
		'google': {'SCOPE': ['profile', 'email'], 'APP': _FAKE_APP},
		'fortytwo': {'APP': _FAKE_APP},
	})
	def test_google_login_redirects_to_google(self):
		response = self.client.get('/accounts/google/login/')
		self.assertEqual(response.status_code, 302)
		self.assertIn('accounts.google.com', response.url)

	@override_settings(SOCIALACCOUNT_PROVIDERS={
		'google': {'SCOPE': ['profile', 'email'], 'APP': _FAKE_APP},
		'fortytwo': {'APP': _FAKE_APP},
	})
	def test_fortytwo_login_redirects_to_42_intra(self):
		response = self.client.get('/accounts/fortytwo/login/')
		self.assertEqual(response.status_code, 302)
		self.assertIn('api.intra.42.fr', response.url)


class EmailTests(TestCase):
	def test_password_reset_email_links_to_the_frontend(self):
		User.objects.create_user(username='alice', email='alice@example.com', password='x')
		response = self.client.post(reverse('rest_password_reset'), {'email': 'alice@example.com'})
		self.assertEqual(response.status_code, 200)
		self.assertEqual(len(mail.outbox), 1)
		body = mail.outbox[0].body
		self.assertIn(FRONTEND_URL + '/reset-password/', body)
		self.assertNotIn('password_reset_confirm', body)

	def test_signup_confirmation_email_links_to_the_frontend(self):
		response = self.client.post(
			reverse('rest_register'),
			{
				'username': 'carol',
				'email': 'carol@example.com',
				'password1': 'a very unguessable one!',
				'password2': 'a very unguessable one!',
			},
		)
		self.assertEqual(response.status_code, 204)
		self.assertEqual(len(mail.outbox), 1)
		body = mail.outbox[0].body
		self.assertIn(FRONTEND_URL + '/confirm-email/', body)
		self.assertNotIn('account_confirm_email', body)

	def test_login_works_before_verifying_email(self):
		self.client.post(
			reverse('rest_register'),
			{
				'username': 'dave',
				'email': 'dave@example.com',
				'password1': 'a very unguessable one!',
				'password2': 'a very unguessable one!',
			},
		)
		self.client.logout()

		response = self.client.post(
			reverse('rest_login'),
			{'username': 'dave', 'password': 'a very unguessable one!'},
		)
		self.assertEqual(response.status_code, 204)
		self.assertIn('_auth_user_id', self.client.session)