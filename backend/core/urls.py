"""
URL configuration for core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
import re

from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from game_api.views import csrf, healthz, media_file, spa_index

urlpatterns = [
	path('admin/', admin.site.urls),
	path('healthz/', healthz, name='healthz'),
	path('api/auth/csrf/', csrf, name='csrf'),
	path('api/auth/', include('dj_rest_auth.urls')),
	path('api/auth/registration/', include('dj_rest_auth.registration.urls')),
	path('api/', include('game_api.urls')),
	path('accounts/', include('allauth.urls')),
]

# Uploaded files are rows, not files, so this is the only thing that can serve
# them — nginx has no directory to alias any more, in any environment
# (docs/adr/0005-uploaded-files-live-in-the-database.md). Not gated on DEBUG:
# django.conf.urls.static.static() silently returns no routes when DEBUG=False,
# which is how this would come back as a 404 nobody can explain in production.
urlpatterns += [
	re_path(
		rf'^{re.escape(settings.MEDIA_URL.lstrip("/"))}(?P<path>.*)$',
		media_file,
	),
]

# The single-page app, where this process is the one serving it (Render: one
# origin, because nothing in front of Django can proxy a WebSocket upgrade —
# docs/adr/0004-one-origin-in-production.md). WhiteNoise has already answered
# anything with a real file behind it, so whatever reaches here is a client-side
# route and gets index.html.
#
# The API and the server's own routes are excluded on purpose: a mistyped
# endpoint must still 404, not come back as a 200 page that no caller can parse.
if settings.FRONTEND_DIST:
	urlpatterns += [
		re_path(r'^(?!api/|admin/|accounts/|media/|static/|healthz/).*$', spa_index),
	]
