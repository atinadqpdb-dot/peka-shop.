from django.shortcuts import render, get_object_or_404, redirect
from django.db.models import Q
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from django.contrib.admin.views.decorators import staff_member_required
from django.utils import timezone
from django.conf import settings
import json
import requests
from .models import Product, Category, Order, OrderItem, Slider, Review, Coupon
from .forms import ReviewForm

# --- 1. لیست محصولات و اسلایدر ---
def product_list(request, category_slug=None):
    category = None
    categories = Category.objects.all()
    products = Product.objects.select_related('category').filter(available=True)
    sliders = Slider.objects.filter(is_active=True)

    if category_slug:
        category = get_object_or_404(Category, slug=category_slug)
        products = products.filter(category=category)

    search_query = request.GET.get('q')
    if search_query:
        products = products.filter(
            Q(name__icontains=search_query) | 
            Q(description__icontains=search_query)
        )

    sort_by = request.GET.get('sort')
    if sort_by == 'price-asc':
        products = products.order_by('price')
    elif sort_by == 'price-desc':
        products = products.order_by('-price')
    elif sort_by == 'newest':
        products = products.order_by('-created')

    context = {
        'category': category,
        'categories': categories,
        'products': products,
        'sliders': sliders,
    }
    return render(request, 'index.html', context)

# --- 2. جزئیات محصول و نظرات ---
def product_detail(request, id, slug):
    product = get_object_or_404(Product.objects.select_related('category'), id=id, slug=slug, available=True)
    reviews = product.reviews.filter(active=True).select_related('user').order_by('-created')
    
    if request.method == 'POST':
        form = ReviewForm(request.POST)
        if form.is_valid():
            if request.user.is_authenticated:
                review = form.save(commit=False)
                review.product = product
                review.user = request.user
                review.save()
                return redirect('product_detail', id=product.id, slug=product.slug)
            else:
                pass
    else:
        form = ReviewForm()

    return render(request, 'product_detail.html', {
        'product': product,
        'reviews': reviews,
        'form': form
    })

# --- 3. جستجوی زنده ---
def search_suggestions(request):
    query = request.GET.get('q')
    results = []
    if query:
        products = Product.objects.filter(name__icontains=query, available=True).only('id', 'name', 'price', 'image')[:5]
        for product in products:
            results.append({
                'id': product.id,
                'name': product.name,
                'price': product.price,
                'image': product.image.url if product.image else '',
            })
    return JsonResponse({'results': results})

# --- 4. محاسبه تخفیف ---
def calculate_discount(coupon, cart_items):
    discount = 0
    # لیست محصولات مجاز برای این کوپن
    eligible_products = coupon.products.all()
    eligible_ids = [p.id for p in eligible_products]
    
    # اگر لیست خالی بود، یعنی کوپن عمومی است (روی همه محصولات)
    is_global = len(eligible_ids) == 0

    for item in cart_items:
        pid = int(item['id'])
        qty = int(item['quantity'])
        try:
            prod = Product.objects.get(id=pid)
            # اگر کوپن عمومی است یا محصول در لیست مجاز است
            if is_global or (pid in eligible_ids):
                discount += (prod.price * qty * coupon.discount) // 100
        except:
            continue
    return discount

@csrf_exempt
def validate_coupon(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            code = data.get('code')
            items = data.get('items', [])
            now = timezone.now()
            
            try:
                coupon = Coupon.objects.get(code__iexact=code, active=True, valid_from__lte=now, valid_to__gte=now)
                discount_val = calculate_discount(coupon, items)
                
                if discount_val == 0 and coupon.products.exists():
                    return JsonResponse({'success': False, 'message': 'این کد شامل محصولات سبد شما نمی‌شود.'})
                
                return JsonResponse({'success': True, 'discount_amount': discount_val, 'percent': coupon.discount})
            except Coupon.DoesNotExist:
                return JsonResponse({'success': False, 'message': 'کد تخفیف نامعتبر است.'})
        except:
            return JsonResponse({'success': False, 'message': 'خطا در پردازش.'})
    return JsonResponse({'success': False})

# --- 5. ثبت سفارش و درگاه پرداخت ---
@csrf_exempt
def create_order(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            user = request.user if request.user.is_authenticated else None
            cart_items = data['items']
            
            # محاسبه قیمت کل
            total_price = 0
            for item in cart_items:
                try:
                    p = Product.objects.get(id=item['id'])
                    if p.stock < item['quantity']:
                        return JsonResponse({'success': False, 'message': f'موجودی {p.name} کافی نیست.'})
                    total_price += p.price * item['quantity']
                except:
                    return JsonResponse({'success': False, 'message': 'محصول نامعتبر.'})
            
            # محاسبه تخفیف
            discount_amount = 0
            if data.get('coupon_code'):
                try:
                    now = timezone.now()
                    coupon = Coupon.objects.get(code__iexact=data.get('coupon_code'), active=True, valid_from__lte=now, valid_to__gte=now)
                    discount_amount = calculate_discount(coupon, cart_items)
                except:
                    pass
            
            final_price = max(0, total_price - discount_amount)
            
            # ساخت سفارش
            order = Order.objects.create(
                user=user,
                full_name=data['fullname'],
                phone=data['phone'],
                address=data['address'],
                total_price=total_price,
                discount_amount=discount_amount,
                final_price=final_price,
                paid=False
            )
            
            # ثبت آیتم‌ها
            for item in cart_items:
                p = Product.objects.get(id=item['id'])
                OrderItem.objects.create(order=order, product=p, price=p.price, quantity=item['quantity'])
                # فعلا از موجودی کم نمی‌کنیم تا پرداخت تایید شود (یا می‌توان همینجا کم کرد)
            
            # اتصال به زرین‌پال
            if final_price > 0:
                req_data = {
                    "merchant_id": settings.MERCHANT,
                    "amount": final_price * 10, # ریال
                    "callback_url": settings.CALLBACK_URL,
                    "description": settings.DESCRIPTION,
                    "metadata": {"mobile": data['phone']}
                }
                req_header = {"accept": "application/json", "content-type": "application/json'"}
                try:
                    req = requests.post(url=settings.ZP_API_REQUEST, data=json.dumps(req_data), headers=req_header)
                    if len(req.json()['errors']) == 0:
                        authority = req.json()['data']['authority']
                        payment_url = settings.ZP_API_STARTPAY.format(authority=authority)
                        request.session['order_id'] = order.id
                        return JsonResponse({'success': True, 'payment_url': payment_url})
                    else:
                        return JsonResponse({'success': False, 'message': 'خطا در اتصال به بانک'})
                except:
                    return JsonResponse({'success': False, 'message': 'خطای ارتباط با درگاه'})
            else:
                # مبلغ صفر (تخفیف ۱۰۰ درصد)
                order.paid = True
                order.save()
                for item in order.items.all():
                    item.product.stock -= item.quantity
                    item.product.save()
                return JsonResponse({'success': True, 'payment_url': None, 'order_id': order.id}) # بدون لینک بانک

        except Exception as e:
            return JsonResponse({'success': False, 'message': str(e)})
    return JsonResponse({'success': False})

# --- 6. بازگشت از بانک (Verify) ---
def verify_payment(request):
    order_id = request.session.get('order_id')
    if not order_id:
        return HttpResponse("سفارشی یافت نشد.")
    
    order = get_object_or_404(Order, id=order_id)
    t_authority = request.GET.get('Authority')
    t_status = request.GET.get('Status')
    
    if t_status == 'OK':
        req_header = {"accept": "application/json", "content-type": "application/json'"}
        req_data = {
            "merchant_id": settings.MERCHANT,
            "amount": order.final_price * 10,
            "authority": t_authority
        }
        try:
            req = requests.post(url=settings.ZP_API_VERIFY, data=json.dumps(req_data), headers=req_header)
            if len(req.json()['errors']) == 0:
                code = req.json()['data']['code']
                if code == 100:
                    order.paid = True
                    order.save()
                    # کم کردن موجودی
                    for item in order.items.all():
                        item.product.stock -= item.quantity
                        item.product.save()
                    return render(request, 'payment_result.html', {'success': True, 'order': order, 'ref_id': req.json()['data']['ref_id']})
                elif code == 101:
                    return render(request, 'payment_result.html', {'success': True, 'order': order, 'message': 'تراکنش قبلا تایید شده.'})
                else:
                    return render(request, 'payment_result.html', {'success': False, 'message': 'تراکنش ناموفق بود.'})
            else:
                return render(request, 'payment_result.html', {'success': False, 'message': 'خطا در تایید تراکنش.'})
        except:
            return render(request, 'payment_result.html', {'success': False, 'message': 'خطای ارتباط.'})
    else:
        return render(request, 'payment_result.html', {'success': False, 'message': 'تراکنش توسط کاربر لغو شد.'})

# --- 7. هوش مصنوعی ---
@csrf_exempt
def ai_chat_api(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            msg = data.get('message', '').lower()
            response = "متوجه نشدم. لطفاً درباره محصولات سوال کنید."
            
            products = Product.objects.filter(available=True).only('name', 'ai_description', 'price', 'stock')
            for p in products:
                if p.name.lower() in msg:
                    response = p.ai_description if p.ai_description else f"{p.name} با قیمت {p.price} تومان موجود است."
                    break
            return JsonResponse({'response': response})
        except:
            return JsonResponse({'response': "خطا."})
    return JsonResponse({'response': "Error"})

# --- 8. احراز هویت ---
@csrf_exempt
def api_login(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        user = authenticate(request, username=data.get('email'), password=data.get('password'))
        if user:
            login(request, user)
            return JsonResponse({'success': True})
        return JsonResponse({'success': False})

@csrf_exempt
def api_register(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        if User.objects.filter(username=data.get('email')).exists():
            return JsonResponse({'success': False, 'message': 'ایمیل تکراری است.'})
        user = User.objects.create_user(username=data.get('email'), email=data.get('email'), password=data.get('password'), first_name=data.get('name'))
        login(request, user)
        return JsonResponse({'success': True})

def logout_view(request):
    logout(request)
    return redirect('product_list')

# --- 9. پروفایل ---
@login_required(login_url='/')
def profile_view(request):
    orders = Order.objects.filter(user=request.user).order_by('-created').prefetch_related('items__product')
    return render(request, 'profile.html', {'orders': orders})

# --- 10. فاکتور ادمین ---
@staff_member_required
def admin_order_invoice(request, order_id):
    order = get_object_or_404(Order, id=order_id)
    return render(request, 'admin_invoice.html', {'order': order})