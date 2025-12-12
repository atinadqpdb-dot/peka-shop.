from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator

class SiteSetting(models.Model):
    site_name = models.CharField(max_length=100, default="Peka", verbose_name="نام سایت")
    site_logo = models.ImageField(upload_to='settings/', blank=True, null=True)
    primary_color = models.CharField(max_length=7, default="#ef394e")
    secondary_color = models.CharField(max_length=7, default="#0071e3")
    top_bar_text = models.CharField(max_length=200, blank=True)
    is_top_bar_active = models.BooleanField(default=False)
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    def __str__(self): return "تنظیمات اصلی"

class Category(models.Model):
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    def __str__(self): return self.name

class Product(models.Model):
    category = models.ForeignKey(Category, related_name='products', on_delete=models.CASCADE)
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    image = models.ImageField(upload_to='products/', blank=True)
    description = models.TextField(blank=True)
    ai_description = models.TextField(blank=True, verbose_name='توضیحات AI')
    price = models.PositiveIntegerField()
    stock = models.PositiveIntegerField(default=0)
    available = models.BooleanField(default=True)
    created = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)
    def __str__(self): return self.name

class Coupon(models.Model):
    code = models.CharField(max_length=50, unique=True)
    discount = models.IntegerField(validators=[MinValueValidator(0), MaxValueValidator(100)])
    products = models.ManyToManyField(Product, blank=True)
    active = models.BooleanField(default=True)
    valid_from = models.DateTimeField()
    valid_to = models.DateTimeField()
    def __str__(self): return self.code

class Order(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    full_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=20)
    address = models.TextField()
    total_price = models.PositiveIntegerField(default=0)
    discount_amount = models.PositiveIntegerField(default=0)
    final_price = models.PositiveIntegerField(default=0)
    created = models.DateTimeField(auto_now_add=True)
    paid = models.BooleanField(default=False)
    def __str__(self): return f'سفارش {self.id}'

class OrderItem(models.Model):
    order = models.ForeignKey(Order, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, related_name='order_items', on_delete=models.CASCADE)
    price = models.PositiveIntegerField()
    quantity = models.PositiveIntegerField(default=1)
    def get_cost(self): return self.price * self.quantity

class Slider(models.Model):
    title = models.CharField(max_length=100)
    image = models.ImageField(upload_to='slides/')
    link = models.URLField(max_length=200, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created = models.DateTimeField(auto_now_add=True)

class Review(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='reviews')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    rating = models.PositiveIntegerField(default=5)
    comment = models.TextField()
    admin_reply = models.TextField(blank=True, null=True)
    created = models.DateTimeField(auto_now_add=True)
    active = models.BooleanField(default=True)