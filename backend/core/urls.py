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
from django.views.static import serve
from game_api.views import csrf, healthz

urlpatterns = [
	path('admin/', admin.site.urls),
	path('healthz/', healthz, name='healthz'),
	path('api/auth/csrf/', csrf, name='csrf'),
	path('api/auth/', include('dj_rest_auth.urls')),
	path('api/auth/registration/', include('dj_rest_auth.registration.urls')),
	path('api/', include('game_api.urls')),
	path('accounts/', include('allauth.urls')),
]

# Not gated on DEBUG: locally nginx serves /media/ from the shared volume and
# never reaches this, but Render runs this container standalone with nothing
# else in front of it, so Django has to be the one serving uploaded avatars.
# static() can't be used for this — it silently returns no routes when DEBUG=False.
urlpatterns += [
	re_path(
		rf'^{re.escape(settings.MEDIA_URL.lstrip("/"))}(?P<path>.*)$',
		serve,
		{'document_root': settings.MEDIA_ROOT},
	),
]
