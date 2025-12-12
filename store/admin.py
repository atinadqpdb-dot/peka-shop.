from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from .models import Category, Product, Order, OrderItem, Slider, Review, Coupon, SiteSetting

@admin.register(SiteSetting)
class SiteSettingAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        # فقط اجازه ساخت یک تنظیمات را می‌دهد
        return not self.model.objects.exists()

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug']
    prepopulated_fields = {'slug': ('name',)}

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'price', 'stock', 'available', 'created']
    list_filter = ['available', 'created', 'category']
    list_editable = ['price', 'stock', 'available']
    prepopulated_fields = {'slug': ('name',)}
    fieldsets = (
        (None, {'fields': ('category', 'name', 'slug', 'image', 'description', 'price', 'stock', 'available')}),
        ('تنظیمات هوش مصنوعی', {'fields': ('ai_description',), 'description': 'متن مخصوص ربات'}),
    )

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    raw_id_fields = ['product']

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['id', 'full_name', 'final_price', 'paid', 'invoice_button', 'created']
    list_filter = ['paid', 'created']
    inlines = [OrderItemInline]
    
    def invoice_button(self, obj):
        if obj.id:
            url = reverse('admin_order_invoice', args=[obj.id])
            return format_html('<a class="button" href="{}" target="_blank" style="background-color:#0071e3; color:white; padding:5px 10px; border-radius:5px; text-decoration:none;">چاپ فاکتور</a>', url)
        return "-"
    invoice_button.short_description = "فاکتور"

@admin.register(Slider)
class SliderAdmin(admin.ModelAdmin):
    list_display = ['title', 'is_active', 'created']
    list_editable = ['is_active']

@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ['product', 'user', 'rating', 'active', 'has_reply']
    list_filter = ['active', 'rating']
    list_editable = ['active']
    fields = ['product', 'user', 'rating', 'comment', 'admin_reply', 'active']
    readonly_fields = ['product', 'user', 'rating', 'comment']
    
    def has_reply(self, obj): 
        return bool(obj.admin_reply)
    has_reply.boolean = True
    has_reply.short_description = 'پاسخ داده شده'

@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ['code', 'discount', 'active']
    filter_horizontal = ['products']