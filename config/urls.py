from django.contrib import admin
from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from store import views

urlpatterns = [
    # ادمین و فاکتور
    path('admin/order/<int:order_id>/invoice/', views.admin_order_invoice, name='admin_order_invoice'),
    path('admin/', admin.site.urls),
    
    # صفحات اصلی
    path('', views.product_list, name='product_list'),
    path('category/<slug:category_slug>/', views.product_list, name='product_list_by_category'),
    path('product/<int:id>/<slug:slug>/', views.product_detail, name='product_detail'),
    
    # عملیات AJAX
    path('search-suggestions/', views.search_suggestions, name='search_suggestions'),
    path('api/validate-coupon/', views.validate_coupon, name='validate_coupon'),
    path('api/ai-chat/', views.ai_chat_api, name='ai_chat_api'),
    
    # درگاه پرداخت و سفارش
    path('create-order/', views.create_order, name='create_order'),
    path('order/verify/', views.verify_payment, name='verify_payment'),
    
    # کاربری
    path('api/login/', views.api_login, name='api_login'),
    path('api/register/', views.api_register, name='api_register'),
    path('logout/', views.logout_view, name='logout'),
    path('profile/', views.profile_view, name='profile'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)